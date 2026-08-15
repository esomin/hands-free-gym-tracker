#include <BLE2902.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <DFRobot_BMI160.h>
#include <Preferences.h>
#include <WebSocketsClient.h>
#include <WiFi.h>
#include <Wire.h>
#include <esp_mac.h>
#include <esp_wifi.h>

// ==========================================
// 1. 하드웨어 핀 및 상수 정의 (ESP32-C3 Super Mini)
// ==========================================
const int SDA_PIN = 8;
const int SCL_PIN = 9;
const int BUTTON_PIN = 9; // BOOT 버튼 (Low Active)

const uint8_t bmi160_i2c_addr = 0x69;            // DFRobot 기본 주소
const unsigned long BUTTON_LONG_PRESS_MS = 3000; // 3초 페어링 버튼 롱프레스
const unsigned long BLE_ADV_TIMEOUT_MS =
    180000; // 3분(180초) BLE Advertising 타임아웃
const unsigned long STREAM_INTERVAL_MS = 50; // 20Hz (50ms) 주기 센서 스트리밍

// ==========================================
// 2. BLE UUID 정의 (GATT Profile)
// ==========================================
#define SERVICE_UUID "4fa21234-8e3a-45c2-965e-04f76c3f1234"
#define STATUS_CHAR_UUID "4fa21234-8e3a-45c2-965e-04f76c3f1001"
#define CONFIG_CHAR_UUID "4fa21234-8e3a-45c2-965e-04f76c3f1002"
#define INFO_CHAR_UUID "4fa21234-8e3a-45c2-965e-04f76c3f1003"

// ==========================================
// 3. 전역 변수 및 객체 선언
// ==========================================
DFRobot_BMI160 bmi160;
Preferences preferences;
WebSocketsClient webSocket;

// IMU 영점(오프셋) 저장 변수
float ax_offset = 0, ay_offset = 0, az_offset = 0;
float gx_offset = 0, gy_offset = 0, gz_offset = 0;

// BLE 관련 전역 변수
BLEServer *pServer = nullptr;
BLECharacteristic *pStatusCharacteristic = nullptr;
BLECharacteristic *pConfigCharacteristic = nullptr;
BLECharacteristic *pInfoCharacteristic = nullptr;

bool deviceConnected = false;
bool oldDeviceConnected = false;
bool isAdvertising = false;
unsigned long advStartTime = 0;
String deviceMacAddress = "";
String deviceName = "";

// Wi-Fi & WebSocket & NVS 설정 변수
String wifiSSID = "";
String wifiPass = "";
String wsUrl = "ws://192.168.0.10:8000/ws/default_user";
bool wsConnected = false;
bool triggerWifiConnectFlag = false;
bool triggerWsSetupFlag = false;

// 버튼 및 상태 처리 변수
unsigned long buttonPressStartTime = 0;
bool buttonIsPressed = false;
bool triggerCalibrationFlag = false;
unsigned long lastCalibrationNotifyTime = 0;

// 함수 프로토타입 선언
void calibrateZero();
void initBLE();
void startBLEAdvertising();
void stopBLEAdvertising();
void connectWiFi();
void setupWebSocket(String url);
void webSocketEvent(WStype_t type, uint8_t *payload, size_t length);

// ==========================================
// 4. BLE 서버 및 특성 콜백 클래스 정의
// ==========================================
class MyServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer *pServer) override {
    deviceConnected = true;
    Serial.println("[BLE] 앱 연결 성공 (Client Connected)");
  };

  void onDisconnect(BLEServer *pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] 앱 연결 해제 (Client Disconnected)");
  }
};

class ConfigCharCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String value = pCharacteristic->getValue();
    if (value.length() > 0) {
      Serial.print("[BLE 수신] Config 설정: ");
      Serial.println(value);

      // 1. 0x01 수신 시 영점 재잡기(Calibration) 실행 명령
      if ((uint8_t)value[0] == 0x01 && value.length() == 1) {
        Serial.println("[BLE] 원격 영점 조절 명령 수신!");
        triggerCalibrationFlag = true;
      }
      // 2. WIFI:SSID,PASSWORD 포맷 수신
      else if (value.startsWith("WIFI:")) {
        String payload = value.substring(5);
        int commaIdx = payload.indexOf(',');
        if (commaIdx > 0) {
          wifiSSID = payload.substring(0, commaIdx);
          wifiPass = payload.substring(commaIdx + 1);
          wifiSSID.trim();
          wifiPass.trim();
          Serial.print("[BLE] Wi-Fi SSID: [");
          Serial.print(wifiSSID);
          Serial.println("]");
          Serial.print("[BLE] Wi-Fi Pass 길이: ");
          Serial.println(wifiPass.length());

          // NVS에 저장
          preferences.begin("pillbox", false);
          preferences.putString("ssid", wifiSSID);
          preferences.putString("pass", wifiPass);
          preferences.end();

          triggerWifiConnectFlag = true;
        }
      }
      // 3. WS:URL 포맷 수신 (예: WS:ws://192.168.0.10:8000/ws/default_user)
      else if (value.startsWith("WS:")) {
        wsUrl = value.substring(3);
        wsUrl.trim();
        Serial.print("[BLE] WebSocket URL: [");
        Serial.print(wsUrl);
        Serial.println("]");

        // NVS에 저장
        preferences.begin("pillbox", false);
        preferences.putString("wsurl", wsUrl);
        preferences.end();

        triggerWsSetupFlag = true;
      }
      // 4. CLEAR_CONFIG 수신 시 NVS 정보 삭제
      else if (value == "CLEAR_CONFIG") {
        Serial.println("[BLE] NVS 설정 삭제 명령 수신!");
        preferences.begin("pillbox", false);
        preferences.clear();
        preferences.end();
        wifiSSID = "";
        wifiPass = "";
        WiFi.disconnect(true);
        wsConnected = false;
      }
    }
  }
};

// ==========================================
// 5. setup() 초기화 함수
// ==========================================
void setup() {
  Serial.begin(115200);
  while (!Serial && millis() < 4000)
    ;
  delay(500);

  Serial.println("\n=============================================");
  Serial.println(" ESP32-C3 Smart PillBox Firmware (Phase 2)");
  Serial.println(" (BLE + Wi-Fi Provisioning + WebSocket 20Hz)");
  Serial.println("=============================================");
  Serial.flush();

  // 1. BOOT 버튼 핀 설정 (GPIO 9, Pull-up)
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // 2. ESP32-C3 MAC 주소 추출 및 Device Name 설정
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X", mac[0],
           mac[1], mac[2], mac[3], mac[4], mac[5]);
  deviceMacAddress = String(macStr);

  char nameBuf[30];
  snprintf(nameBuf, sizeof(nameBuf), "SmartPillBox_%02X%02X", mac[4], mac[5]);
  deviceName = String(nameBuf);

  Serial.print("[HW Info] MAC Address: ");
  Serial.println(deviceMacAddress);
  Serial.print("[HW Info] BLE Device Name: ");
  Serial.println(deviceName);

  // 3. NVS 저장된 Wi-Fi 및 WebSocket 설정 로드
  preferences.begin("pillbox", true);
  wifiSSID = preferences.getString("ssid", "");
  wifiPass = preferences.getString("pass", "");
  wsUrl =
      preferences.getString("wsurl", "ws://192.168.0.10:8000/ws/default_user");
  preferences.end();

  if (wifiSSID.length() > 0) {
    Serial.print("[NVS] 저장된 Wi-Fi 정보 발견: ");
    Serial.println(wifiSSID);
    triggerWifiConnectFlag = true;
  } else {
    Serial.println("[NVS] 저장된 Wi-Fi 정보 없음 (BLE 프로비저닝 대기)");
  }

  // 4. I2C 및 BMI160 센서 초기화 (GPIO 8=SDA, GPIO 9=SCL)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (bmi160.softReset() != BMI160_OK) {
    Serial.println("[WARN] BMI160 소프트 리셋 실패");
  }

  if (bmi160.I2cInit(bmi160_i2c_addr) != BMI160_OK) {
    Serial.println("[ERROR] BMI160 센서 초기화 실패! 배선을 확인하세요.");
  } else {
    Serial.println("[SUCCESS] BMI160 센서 연결 성공 (I2C: 0x69)");
    calibrateZero();
  }

  // 5. BLE 스택 초기화
  initBLE();

  Serial.println("\n[안내] BOOT 버튼(GPIO 9)을 3초간 누르면 BLE 페어링 "
                 "모드(Advertising)가 시작됩니다.");
  Serial.println("[안내] BLE Config로 'WIFI:SSID,PASS' 또는 "
                 "'WS:ws://IP:PORT/ws/user'를 전송하세요.\n");
}

// ==========================================
// 6. loop() 메인 루틴
// ==========================================
void loop() {
  // --- A. 3초 버튼 롱프레스 감지 (Non-blocking) ---
  int btnState = digitalRead(BUTTON_PIN);
  if (btnState == LOW) {
    if (!buttonIsPressed) {
      buttonIsPressed = true;
      buttonPressStartTime = millis();
    } else {
      unsigned long pressDuration = millis() - buttonPressStartTime;
      if (pressDuration >= BUTTON_LONG_PRESS_MS && !isAdvertising &&
          !deviceConnected) {
        Serial.println(
            "\n[EVENT] 버튼 3초 롱프레스 감지! BLE 페어링 모드 시작.");
        startBLEAdvertising();
      }
    }
  } else {
    if (buttonIsPressed) {
      buttonIsPressed = false;
      Wire.begin(SDA_PIN, SCL_PIN);
    }
  }

  // --- B. BLE Advertising 타임아웃 ---
  if (isAdvertising && !deviceConnected) {
    if (millis() - advStartTime >= BLE_ADV_TIMEOUT_MS) {
      Serial.println("\n[BLE] Advertising 타임아웃 (3분 경과). BLE 중단.");
      stopBLEAdvertising();
    }
  }

  // --- C. BLE 연결 해제 후 재광고 처리 ---
  if (!deviceConnected && oldDeviceConnected) {
    delay(500);
    pServer->startAdvertising();
    Serial.println("[BLE] 연결 해제 후 Advertising 재개");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // --- D. Wi-Fi 및 WebSocket 연결 요청 처리 ---
  if (triggerWifiConnectFlag) {
    triggerWifiConnectFlag = false;
    connectWiFi();
  }
  if (triggerWsSetupFlag) {
    triggerWsSetupFlag = false;
    setupWebSocket(wsUrl);
  }

  // --- E. WebSocket 클라이언트 이벤트 처리 ---
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.loop();
  }

  // --- F. 영점 조절 플래그 처리 ---
  if (triggerCalibrationFlag) {
    triggerCalibrationFlag = false;
    calibrateZero();
  }

  // --- G. 시리얼 입력 처리 ---
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 't' || cmd == 'T' || cmd == 'r' || cmd == 'R') {
      calibrateZero();
    }
  }

  // --- H. 20Hz (50ms) 주기 센서 읽기 및 백엔드 WebSocket 실시간 스트리밍 ---
  static unsigned long lastStreamTime = 0;
  if (millis() - lastStreamTime >= STREAM_INTERVAL_MS) {
    lastStreamTime = millis();

    if (!buttonIsPressed) {
      int16_t accelGyro[6] = {0};
      if (bmi160.getAccelGyroData(accelGyro) == BMI160_OK) {
        float zero_gx = accelGyro[0] - gx_offset;
        float zero_gy = accelGyro[1] - gy_offset;
        float zero_gz = accelGyro[2] - gz_offset;

        float zero_ax = accelGyro[3] - ax_offset;
        float zero_ay = accelGyro[4] - ay_offset;
        float zero_az = accelGyro[5] - az_offset;

        // Raw LSB -> 물리 단위 변환 (±2g 기준 1g = 16384 LSB, 1g = 9.81 m/s^2)
        float phys_ax = (zero_ax / 16384.0f) * 9.81f;
        float phys_ay = (zero_ay / 16384.0f) * 9.81f;
        float phys_az = (zero_az / 16384.0f) * 9.81f;

        // Gyro rad/s 변환 (±250dps 기준 1dps = 131 LSB, 1dps = 0.01745 rad/s)
        float phys_gx = (zero_gx / 131.0f) * 0.0174533f;
        float phys_gy = (zero_gy / 131.0f) * 0.0174533f;
        float phys_gz = (zero_gz / 131.0f) * 0.0174533f;

        // 백엔드 파이프라인 호환 JSON 생성 (6축 정밀 데이터)
        char payload[256];
        snprintf(payload, sizeof(payload),
                 "{\"bottle_id\":\"%s\",\"acc_x\":%.3f,\"acc_y\":%.3f,\"acc_"
                 "z\":%.3f,\"gyro_x\":%.3f,\"gyro_y\":%.3f,\"gyro_z\":%.3f}",
                 deviceName.c_str(), phys_ax, phys_ay, phys_az, phys_gx,
                 phys_gy, phys_gz);

        // 1. WebSocket 서버로 백엔드 파이프라인 센서 데이터 송신 (20Hz)
        if (wsConnected) {
          webSocket.sendTXT(payload);
        }

        // 2. BLE Connected 상태인 경우 BLE Status Notify 전송 (CALIBRATION_OK
        // 대기 보호)
        if (deviceConnected && (millis() - lastCalibrationNotifyTime > 2500)) {
          pStatusCharacteristic->setValue(payload);
          pStatusCharacteristic->notify();
        }
      }
    }
  }

  delay(1); // CPU 선점 방지
}

// ==========================================
// 7. Wi-Fi 접속 함수
// ==========================================
void connectWiFi() {
  wifiSSID.trim();
  wifiPass.trim();
  if (wifiSSID.length() == 0)
    return;

  Serial.println(
      "\n[Wi-Fi] 기존 연결 초기화 및 2.4GHz AP 접속 시도... Target: [" +
      wifiSSID + "]");
  Serial.print("[Wi-Fi] Password 길이: ");
  Serial.println(wifiPass.length());

  // 1. BLE 라디오 방해 제거 (활성 BLE 연결 및 광고 세션 정리하여 2.4GHz RF 100% 전용 할당)
  if (deviceConnected) {
    Serial.println("[BLE] Wi-Fi WPA2 핸드셰이크를 위해 활성 BLE 연결 세션을 안전하게 정리합니다.");
    pServer->disconnect(0);
    delay(300);
  }
  if (isAdvertising) {
    BLEDevice::stopAdvertising();
    delay(100);
  }

  // 2. Wi-Fi STA 모드 리셋 & Modem Sleep 절전 해제 (WPA2 4-Way Handshake 패킷 드롭 방지)
  WiFi.disconnect(true);
  delay(200);
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  esp_wifi_set_ps(WIFI_PS_NONE);
  delay(200);

  // 3. 주변 2.4GHz AP 스캔 수행
  Serial.println("[Wi-Fi] 주변 2.4GHz AP 스캔 중...");
  int n = WiFi.scanNetworks(false, true);
  int targetChannel = 0;
  int bestRSSI = -100;
  bool foundTarget = false;

  if (n > 0) {
    for (int i = 0; i < n; ++i) {
      String foundSSID = WiFi.SSID(i);
      int rssi = WiFi.RSSI(i);
      Serial.printf("  %d: %s (신호: %d dBm, 채널: %d)\n", i + 1,
                    foundSSID.c_str(), rssi, WiFi.channel(i));
      if (foundSSID == wifiSSID && rssi > bestRSSI) {
        bestRSSI = rssi;
        targetChannel = WiFi.channel(i);
        foundTarget = true;
      }
    }
  }

  if (foundTarget) {
    Serial.printf("  ===> 타깃 AP [%s] 발견! (신호: %d dBm, 채널: %d)\n",
                  wifiSSID.c_str(), bestRSSI, targetChannel);
  }

  WiFi.scanDelete();

  // 4. Wi-Fi 접속 시도 (표준 WPA2 핸드셰이크)
  Serial.println("[Wi-Fi] WPA2 4-Way Handshake 접속 시도 중...");
  WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("[Wi-Fi 성공] 할당받은 IP: ");
    Serial.println(WiFi.localIP());

    // Wi-Fi 성공 후 WebSocket 연결 시도
    setupWebSocket(wsUrl);
  } else {
    Serial.printf("[Wi-Fi 실패] Status 코드: %d\n", (int)WiFi.status());
    Serial.println("  -> 비밀번호가 맞는지 또는 무선 보안 설정을 확인하세요.");
  }
}

// ==========================================
// 8. WebSocket 설정 및 연결 함수
// ==========================================
void setupWebSocket(String url) {
  if (url.length() == 0)
    return;

  String temp = url;
  if (temp.startsWith("ws://")) {
    temp = temp.substring(5);
  } else if (temp.startsWith("wss://")) {
    temp = temp.substring(6);
  }

  int slashIdx = temp.indexOf('/');
  String hostPort = (slashIdx >= 0) ? temp.substring(0, slashIdx) : temp;
  String path = (slashIdx >= 0) ? temp.substring(slashIdx) : "/";

  int colonIdx = hostPort.indexOf(':');
  String host = (colonIdx >= 0) ? hostPort.substring(0, colonIdx) : hostPort;
  int port = (colonIdx >= 0) ? hostPort.substring(colonIdx + 1).toInt() : 80;

  Serial.println("\n[WebSocket 설정] Host: " + host +
                 ", Port: " + String(port) + ", Path: " + path);
  webSocket.begin(host.c_str(), port, path.c_str());
  webSocket.onEvent(webSocketEvent);
  webSocket.setReconnectInterval(5000);
}

void webSocketEvent(WStype_t type, uint8_t *payload, size_t length) {
  switch (type) {
  case WStype_DISCONNECTED:
    wsConnected = false;
    Serial.println("[WS] WebSocket 연결 해제됨");
    break;
  case WStype_CONNECTED:
    wsConnected = true;
    Serial.printf("[WS] 백엔드 WebSocket 서버 연결 성공! URL: %s\n", payload);
    break;
  case WStype_TEXT:
    Serial.printf("[WS 수신] 백엔드 메시지: %s\n", payload);
    break;
  default:
    break;
  }
}

// ==========================================
// 9. 영점 조절 (Calibration) 함수
// ==========================================
void calibrateZero() {
  Serial.println("\n[IMU] 영점 조절 중... 약통을 가만히 두세요.");

  float sum_ax = 0, sum_ay = 0, sum_az = 0;
  float sum_gx = 0, sum_gy = 0, sum_gz = 0;
  int samples = 50;

  for (int i = 0; i < samples; i++) {
    int16_t accelGyro[6] = {0};
    bmi160.getAccelGyroData(accelGyro);

    sum_gx += accelGyro[0];
    sum_gy += accelGyro[1];
    sum_gz += accelGyro[2];
    sum_ax += accelGyro[3];
    sum_ay += accelGyro[4];
    sum_az += accelGyro[5];
    delay(10);
  }

  gx_offset = sum_gx / samples;
  gy_offset = sum_gy / samples;
  gz_offset = sum_gz / samples;
  ax_offset = sum_ax / samples;
  ay_offset = sum_ay / samples;
  az_offset = sum_az / samples;

  Serial.println("[IMU] 영점 조절 완료!");

  if (deviceConnected) {
    pStatusCharacteristic->setValue("CALIBRATION_OK");
    pStatusCharacteristic->notify();
    lastCalibrationNotifyTime = millis();
    Serial.println("[BLE] CALIBRATION_OK 알림(Notify) 전송 완료");
  }
}

// ==========================================
// 10. BLE 초기화 및 제어 함수
// ==========================================
void initBLE() {
  BLEDevice::init(deviceName.c_str());

  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pStatusCharacteristic = pService->createCharacteristic(
      STATUS_CHAR_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pStatusCharacteristic->addDescriptor(new BLE2902());
  pStatusCharacteristic->setValue("IDLE");

  pConfigCharacteristic = pService->createCharacteristic(
      CONFIG_CHAR_UUID, BLECharacteristic::PROPERTY_READ |
                            BLECharacteristic::PROPERTY_WRITE |
                            BLECharacteristic::PROPERTY_WRITE_NR);
  pConfigCharacteristic->addDescriptor(new BLE2902());
  pConfigCharacteristic->setCallbacks(new ConfigCharCallbacks());

  pInfoCharacteristic = pService->createCharacteristic(
      INFO_CHAR_UUID, BLECharacteristic::PROPERTY_READ);
  String infoStr = "MAC:" + deviceMacAddress + ",FW:v2.0.0";
  pInfoCharacteristic->setValue(infoStr.c_str());

  pService->start();
  Serial.println("[BLE] GATT Profile (v2.0.0) 초기화 완료.");
}

void startBLEAdvertising() {
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);

  BLEDevice::startAdvertising();
  isAdvertising = true;
  advStartTime = millis();
  Serial.print("[BLE] Advertising 시작 중... 디바이스명: ");
  Serial.println(deviceName);
}

void stopBLEAdvertising() {
  BLEDevice::stopAdvertising();
  isAdvertising = false;
  Serial.println("[BLE] Advertising 중단됨.");
}
