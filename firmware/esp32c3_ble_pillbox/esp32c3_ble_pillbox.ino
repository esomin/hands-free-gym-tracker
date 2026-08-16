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
const int SCL_PIN = 6;    // GPIO 9(BOOT 버튼)와 충돌 방지 → GPIO 6으로 분리
const int BUTTON_PIN = 9; // BOOT 버튼 (Low Active, 하드와이어드)

const uint8_t bmi160_i2c_addr = 0x69;            // DFRobot 기본 I2C 주소
const unsigned long BUTTON_LONG_PRESS_MS = 3000; // 3초 페어링 버튼 롱프레스
const unsigned long BLE_ADV_TIMEOUT_MS = 180000; // 3분(180초) BLE Advertising 타임아웃
const unsigned long STREAM_INTERVAL_MS = 50;     // 20Hz (50ms) 주기 센서 스트리밍

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
    Serial.println("[BLE] 클라이언트 연결 성공 (Connected)");
  };

  void onDisconnect(BLEServer *pServer) override {
    deviceConnected = false;
    Serial.println("[BLE] 클라이언트 연결 해제 (Disconnected)");
  }
};

// 재부팅 처리 변수 (GATT Write Response 보장)
bool triggerRebootFlag = false;
unsigned long rebootStartTime = 0;

// 헬퍼: 문자열을 16진수 바이트로 시리얼 출력
void printHex(const String& s, const char* label) {
  Serial.printf("[HEX:%s] len=%d bytes: ", label, s.length());
  for (size_t i = 0; i < s.length(); i++) {
    Serial.printf("%02X ", (uint8_t)s[i]);
  }
  Serial.println();
}

class ConfigCharCallbacks : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pCharacteristic) override {
    String value = pCharacteristic->getValue();
    if (value.length() > 0) {
      Serial.printf("[BLE 수신] 총 %d 바이트 수신.\n", value.length());
      printHex(value, "RAW_PAYLOAD");  // ★ 원본 바이트 덤프
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
        Serial.printf("[PARSE] WIFI: 프리픽스 제거 후 payload len=%d\n", payload.length());
        printHex(payload, "WIFI_PAYLOAD");  // ★ WIFI: 이후 바이트 덤프

        int commaIdx = payload.indexOf(',');
        Serial.printf("[PARSE] 첫 번째 쉼표(,) 위치: %d\n", commaIdx);  // ★ 쉼표 위치

        if (commaIdx > 0) {
          wifiSSID = payload.substring(0, commaIdx);
          wifiPass = payload.substring(commaIdx + 1);
          wifiSSID.trim();
          wifiPass.trim();

          Serial.printf("[PARSE] SSID 파싱 결과: [%s] len=%d\n", wifiSSID.c_str(), wifiSSID.length());
          printHex(wifiSSID, "SSID");       // ★ SSID 바이트 덤프
          Serial.printf("[PARSE] PASS 파싱 결과: len=%d (비밀번호는 숨김)\n", wifiPass.length());
          printHex(wifiPass, "PASS");       // ★ 비밀번호 바이트 덤프

          // NVS에 저장
          preferences.begin("pillbox", false);
          preferences.putString("ssid", wifiSSID);
          preferences.putString("pass", wifiPass);
          preferences.end();

          // ★ NVS 저장값 즉시 읽어서 검증
          preferences.begin("pillbox", true);
          String nvsSsid = preferences.getString("ssid", "");
          String nvsPass = preferences.getString("pass", "");
          preferences.end();
          Serial.printf("[NVS 검증] 저장된 SSID: [%s] len=%d\n", nvsSsid.c_str(), nvsSsid.length());
          Serial.printf("[NVS 검증] 저장된 PASS len=%d (일치: %s)\n",
                        nvsPass.length(), (nvsPass == wifiPass) ? "OK" : "MISMATCH!");

          Serial.println("[SYSTEM] Wi-Fi 설정 저장 완료. GATT 쓰기 응답 완료 후 1.5초 뒤 재부팅합니다...");
          triggerRebootFlag = true;
          rebootStartTime = millis();
        }
      }
      // 3. WS:URL 포맷 수신 (예: WS:ws://192.168.0.10:8000/ws/default_user)
      else if (value.startsWith("WS:")) {
        wsUrl = value.substring(3);
        wsUrl.trim();
        Serial.print("[BLE] WebSocket URL 설정: [");
        Serial.print(wsUrl);
        Serial.println("]");

        // NVS에 저장
        preferences.begin("pillbox", false);
        preferences.putString("wsurl", wsUrl);
        preferences.end();

        Serial.println("[SYSTEM] WebSocket 설정 저장 완료. GATT 쓰기 응답 완료 후 1.5초 뒤 재부팅합니다...");
        triggerRebootFlag = true;
        rebootStartTime = millis();
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
  while (!Serial && millis() < 4000);
  delay(500);

  Serial.println("\n=============================================");
  Serial.println(" ESP32-C3 Smart PillBox Firmware");
  Serial.println(" (BLE + Wi-Fi Provisioning + WebSocket 20Hz)");
  Serial.println("=============================================");
  Serial.flush();

  // 1. BOOT 버튼 핀 설정 (GPIO 9, Pull-up)
  pinMode(BUTTON_PIN, INPUT_PULLUP);

  // 2. ESP32-C3 MAC 주소 추출 및 Device Name 설정
  uint8_t mac[6];
  esp_read_mac(mac, ESP_MAC_WIFI_STA);
  char macStr[18];
  snprintf(macStr, sizeof(macStr), "%02X:%02X:%02X:%02X:%02X:%02X", 
           mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);
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
  wsUrl = preferences.getString("wsurl", wsUrl.c_str());
  preferences.end();

  // ★ NVS 로드 직후 검증 로그
  Serial.printf("[NVS Load] SSID len=%d, PASS len=%d\n", wifiSSID.length(), wifiPass.length());
  printHex(wifiSSID, "NVS_SSID");  // ★ 부팅 시 NVS에서 읽은 SSID 바이트 확인
  printHex(wifiPass, "NVS_PASS");  // ★ 부팅 시 NVS에서 읽은 PASS 바이트 확인

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

  // 5. Wi-Fi 연결 (BLE 스택 초기화 전 → RF 충돌 방지)
  if (wifiSSID.length() > 0) {
    Serial.print("[NVS] 저장된 Wi-Fi 정보 발견: ");
    Serial.println(wifiSSID);
    connectWiFi();
  } else {
    Serial.println("[NVS] 저장된 Wi-Fi 정보 없음 (BLE 프로비저닝 대기)");
  }

  // 6. BLE 스택 초기화 및 BLE Advertising 즉시 시작
  initBLE();
  startBLEAdvertising();

  Serial.println("\n[BLE] BLE 페어링 모드(Advertising)가 활성화되었습니다.");
  Serial.println("[안내] 웹 브라우저에서 'WIFI:SSID,PASS' 또는 'WS:ws://IP:PORT/ws/user'를 전송하세요.");
  Serial.println("[안내] 수동 재광고 필요 시 BOOT 버튼(GPIO 9)을 3초간 누르세요.\n");
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
      if (pressDuration >= BUTTON_LONG_PRESS_MS && !isAdvertising && !deviceConnected) {
        Serial.println("\n[EVENT] 버튼 3초 롱프레스 감지! BLE 페어링 모드 시작.");
        startBLEAdvertising();
      }
    }
  } else {
    if (buttonIsPressed) {
      buttonIsPressed = false;
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

  // --- D. WebSocket 클라이언트 이벤트 처리 ---
  if (WiFi.status() == WL_CONNECTED) {
    webSocket.loop();
  }

  // --- E. 영점 조절 플래그 처리 ---
  if (triggerCalibrationFlag) {
    triggerCalibrationFlag = false;
    calibrateZero();
  }

  // --- F. 지연 재부팅 플래그 처리 (GATT 응답 전송 보장) ---
  if (triggerRebootFlag && (millis() - rebootStartTime >= 1500)) {
    triggerRebootFlag = false;
    Serial.println("\n[SYSTEM] ESP32 재부팅을 시작합니다...");
    delay(100);
    esp_restart();
  }

  // --- F. 시리얼 입력 처리 ---
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 't' || cmd == 'T' || cmd == 'r' || cmd == 'R') {
      calibrateZero();
    }
  }

  // --- G. 20Hz (50ms) 주기 센서 읽기 및 백엔드 WebSocket 실시간 스트리밍 ---
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
                 "{\"bottle_id\":\"%s\",\"acc_x\":%.3f,\"acc_y\":%.3f,\"acc_z\":%.3f,\"gyro_x\":%.3f,\"gyro_y\":%.3f,\"gyro_z\":%.3f}",
                 deviceName.c_str(), phys_ax, phys_ay, phys_az, phys_gx, phys_gy, phys_gz);

        // 1. WebSocket 서버로 백엔드 파이프라인 센서 데이터 송신 (20Hz)
        if (wsConnected) {
          webSocket.sendTXT(payload);
        }

        // 2. BLE Connected 상태인 경우 BLE Status Notify 전송
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
// Wi-Fi 상태 코드를 문자열로 변환
const char* wifiStatusToStr(int s) {
  switch (s) {
    case WL_IDLE_STATUS:     return "IDLE(0)";
    case WL_NO_SSID_AVAIL:   return "NO_SSID_AVAIL(1) - SSID 주변에 없음";
    case WL_SCAN_COMPLETED:  return "SCAN_COMPLETED(2)";
    case WL_CONNECTED:       return "CONNECTED(3)";
    case WL_CONNECT_FAILED:  return "CONNECT_FAILED(4) - 비밀번호 오류";
    case WL_CONNECTION_LOST: return "CONNECTION_LOST(5)";
    case WL_DISCONNECTED:    return "DISCONNECTED(6) - 미연결/인증 실패";
    default:                 return "UNKNOWN";
  }
}

void connectWiFi() {
  wifiSSID.trim();
  wifiPass.trim();
  if (wifiSSID.length() == 0)
    return;

  // ★ WiFi.begin() 호출 전 실제 전달되는 값 최종 확인
  Serial.printf("\n[Wi-Fi] ========== WiFi 연결 시도 ==========");
  Serial.printf("\n[Wi-Fi] SSID: [%s] (len=%d)\n", wifiSSID.c_str(), wifiSSID.length());
  Serial.printf("[Wi-Fi] PASS len=%d\n", wifiPass.length());
  printHex(wifiSSID, "CONNECT_SSID");  // ★ WiFi.begin에 넘기는 SSID 바이트
  printHex(wifiPass, "CONNECT_PASS");  // ★ WiFi.begin에 넘기는 PASS 바이트

  // Wi-Fi 드라이버 완전 클린 재초기화
  WiFi.persistent(false);   // NVS에 자격증명 저장 안 함 (내부 캐시 오염 방지)
  WiFi.mode(WIFI_OFF);      // 완전 종료
  delay(300);
  WiFi.mode(WIFI_STA);      // STA 모드 재시작
  WiFi.setTxPower(WIFI_POWER_8_5dBm); // ★ 출력 낮춤: Super Mini LDO 과부하 방지 (19.5→8.5dBm)
  WiFi.setSleep(false);
  delay(300);

  // ★ 재시도 스캔: iPhone 핫스팟 절전 해제 대기 (최대 2회, 2초 간격)
  // BLE 초기화 지연 최소화를 위해 재시도 횟수 축소
  bool ssidFound = false;
  uint8_t targetBSSID[6] = {0};
  int32_t targetChannel = 0;

  for (int scanTry = 1; scanTry <= 2 && !ssidFound; scanTry++) {
    Serial.printf("[Wi-Fi] AP 스캔 시도 %d/5...\n", scanTry);
    int n = WiFi.scanNetworks();
    for (int i = 0; i < n; i++) {
      String scanned = WiFi.SSID(i);
      int32_t rssi = WiFi.RSSI(i);
      int32_t ch = WiFi.channel(i);
      wifi_auth_mode_t enc = WiFi.encryptionType(i);

      // 암호화 타입 문자열 변환
      const char* encStr = "UNKNOWN";
      switch (enc) {
        case WIFI_AUTH_OPEN:        encStr = "OPEN";    break;
        case WIFI_AUTH_WEP:         encStr = "WEP";     break;
        case WIFI_AUTH_WPA_PSK:     encStr = "WPA";     break;
        case WIFI_AUTH_WPA2_PSK:    encStr = "WPA2";    break;
        case WIFI_AUTH_WPA_WPA2_PSK:encStr = "WPA/2";  break;
        case WIFI_AUTH_WPA3_PSK:    encStr = "WPA3";    break;  // ★ WPA3이면 연결 실패 원인
        case WIFI_AUTH_WPA2_WPA3_PSK: encStr = "WPA2/3"; break;
        default: break;
      }

      Serial.printf("  [Scan %d] SSID=[%s] RSSI=%d Ch=%d Enc=%s\n",
                    i, scanned.c_str(), rssi, ch, encStr);

      if (scanned == wifiSSID) {
        ssidFound = true;
        targetChannel = ch;
        uint8_t* bssid = WiFi.BSSID(i);
        memcpy(targetBSSID, bssid, 6);
        Serial.printf("  [★ MATCH] 목표 SSID 발견! RSSI=%d dBm, Ch=%d, Enc=%s\n", rssi, ch, encStr);
        Serial.printf("  [★ BSSID] %02X:%02X:%02X:%02X:%02X:%02X\n",
                      targetBSSID[0], targetBSSID[1], targetBSSID[2],
                      targetBSSID[3], targetBSSID[4], targetBSSID[5]);

        if (enc == WIFI_AUTH_WPA3_PSK || enc == WIFI_AUTH_WPA2_WPA3_PSK) {
          Serial.println("  [★ 경고] WPA3 암호화 감지! ESP32-C3 WPA3 연결 시도. 실패 시 iPhone '호환성 최대화' 재확인.");
        }
      }
    }
    WiFi.scanDelete();

    if (!ssidFound) {
      if (scanTry < 2) {
        Serial.printf("[Wi-Fi] SSID 미발견. 2초 후 재스캔... (iPhone 핫스팟 설정 화면을 열어두세요)\n");
        delay(2000);  // 3초→2초 단축
      } else {
        Serial.println("[Wi-Fi ★경고] 2회 스캔 모두 실패. WiFi.begin() 강행...");
      }
    }
  }

  // iPhone은 핫스팟 BSSID를 MAC Randomization으로 변경하므로 BSSID 지정 없이 연결
  // (BSSID 고정 시 스캔 BSSID ≠ 연결 BSSID → Status 6 무한 대기 발생)
  delay(500); // scanDelete 후 WiFi 스택 안정화 대기

  // ★ WiFi.begin() 재시도 (최대 2회) — BLE 시작 지연 최소화
  for (int connTry = 1; connTry <= 2; connTry++) {
    WiFi.disconnect(false);
    delay(300);

    Serial.printf("[Wi-Fi] WiFi.begin() SSID+PW 연결 (시도 %d/2)...\n", connTry);
    WiFi.begin(wifiSSID.c_str(), wifiPass.c_str());

    int attempts = 0;
    int lastStatus = -1;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
      delay(500);
      int curStatus = (int)WiFi.status();
      if (curStatus != lastStatus) {
        Serial.printf("\n[Wi-Fi] Status변화: %s ", wifiStatusToStr(curStatus));
        lastStatus = curStatus;
      } else {
        Serial.print(".");
      }
      attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
      Serial.print("[Wi-Fi 성공] 할당받은 IP: ");
      Serial.println(WiFi.localIP());
      setupWebSocket(wsUrl);
      return;
    }

    Serial.printf("[Wi-Fi 시도 %d 실패] %s\n", connTry, wifiStatusToStr((int)WiFi.status()));
    if (connTry < 2) {
      Serial.println("[Wi-Fi] 2초 후 재시도...");
      WiFi.disconnect(true);
      delay(2000);
    }
  }

  Serial.printf("[Wi-Fi 최종 실패] %s\n", wifiStatusToStr((int)WiFi.status()));
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

  Serial.println("\n[WebSocket 설정] Host: " + host + ", Port: " + String(port) + ", Path: " + path);
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
  Serial.print("[BLE] Advertising 시작... 디바이스명: ");
  Serial.println(deviceName);
}

void stopBLEAdvertising() {
  BLEDevice::stopAdvertising();
  isAdvertising = false;
  Serial.println("[BLE] Advertising 중단됨.");
}
