#include <Wire.h>
#include <DFRobot_BMI160.h>
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#include <esp_mac.h>

// ==========================================
// 1. 하드웨어 핀 및 상수 정의 (ESP32-C3 Super Mini)
// ==========================================
// 핀맵: SDA=GPIO 8 (내장 LED 공유), SCL=GPIO 9 (BOOT 버튼 공유)
const int SDA_PIN = 8;
const int SCL_PIN = 9;
const int BUTTON_PIN = 9;  // BOOT 버튼 (Low Active)

const uint8_t BMI160_I2C_ADDR = 0x69; // DFRobot 기본 주소 (필요 시 0x68로 변경 가능)
const unsigned long BUTTON_LONG_PRESS_MS = 3000; // 3초 페어링 버튼 롱프레스
const unsigned long BLE_ADV_TIMEOUT_MS = 180000;  // 3분(180초) BLE Advertising 타임아웃

// ==========================================
// 2. BLE UUID 정의 (GATT Profile)
// ==========================================
#define SERVICE_UUID           "4fa21234-8e3a-45c2-965e-04f76c3f1234"
#define STATUS_CHAR_UUID       "4fa21234-8e3a-45c2-965e-04f76c3f1001"
#define CONFIG_CHAR_UUID       "4fa21234-8e3a-45c2-965e-04f76c3f1002"
#define INFO_CHAR_UUID         "4fa21234-8e3a-45c2-965e-04f76c3f1003"

// ==========================================
// 3. 전역 변수 및 객체 선언
// ==========================================
DFRobot_BMI160 bmi160;

// IMU 영점(오프셋) 저장 변수
float ax_offset = 0, ay_offset = 0, az_offset = 0;
float gx_offset = 0, gy_offset = 0, gz_offset = 0;

// BLE 관련 전역 변수
BLEServer* pServer = nullptr;
BLECharacteristic* pStatusCharacteristic = nullptr;
BLECharacteristic* pConfigCharacteristic = nullptr;
BLECharacteristic* pInfoCharacteristic = nullptr;

bool deviceConnected = false;
bool oldDeviceConnected = false;
bool isAdvertising = false;
unsigned long advStartTime = 0;
String deviceMacAddress = "";
String deviceName = "";

// 버튼 처리 변수
unsigned long buttonPressStartTime = 0;
bool buttonIsPressed = false;
bool triggerCalibrationFlag = false;

// 함수 프로토타입 선언
void calibrateZero();
void initBLE();
void startBLEAdvertising();
void stopBLEAdvertising();

// ==========================================
// 4. BLE 서버 및 특성 콜백 클래스 정의
// ==========================================
class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) override {
      deviceConnected = true;
      Serial.println("[BLE] 앱 연결 성공 (Client Connected)");
    };

    void onDisconnect(BLEServer* pServer) override {
      deviceConnected = false;
      Serial.println("[BLE] 앱 연결 해제 (Client Disconnected)");
    }
};

class ConfigCharCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) override {
      String value = pCharacteristic->getValue();
      if (value.length() > 0) {
        Serial.print("[BLE 수신] Config 데이터: ");
        for (int i = 0; i < value.length(); i++) {
          Serial.print((int)value[i], HEX);
          Serial.print(" ");
        }
        Serial.println();

        // 0x01 수신 시 영점 재잡기(Calibration) 실행 명령
        if ((uint8_t)value[0] == 0x01) {
          Serial.println("[BLE] 원격 영점 조절 명령 수신!");
          triggerCalibrationFlag = true;
        }
      }
    }
};

// ==========================================
// 5. setup() 초기화 함수
// ==========================================
void setup() {
  Serial.begin(115200);
  delay(2000); // USB CDC 초기화 대기

  Serial.println("\n=============================================");
  Serial.println(" ESP32-C3 Smart PillBox Firmware (BLE + IMU)");
  Serial.println("=============================================");

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

  Serial.print("[HW Info] MAC Address: "); Serial.println(deviceMacAddress);
  Serial.print("[HW Info] BLE Device Name: "); Serial.println(deviceName);

  // 3. I2C 및 BMI160 센서 초기화 (GPIO 8=SDA, GPIO 9=SCL)
  Wire.begin(SDA_PIN, SCL_PIN);
  if (bmi160.softReset() != BMI160_OK) {
    Serial.println("[WARN] BMI160 소프트 리셋 실패");
  }
  
  if (bmi160.I2cInit(BMI160_I2C_ADDR) != BMI160_OK) {
    Serial.println("[ERROR] BMI160 센서 초기화 실패! 배선을 확인하세요.");
  } else {
    Serial.println("[SUCCESS] BMI160 센서 연결 성공 (I2C: 0x69)");
    // 시작 시 영점 가조작 진행
    calibrateZero();
  }

  // 4. BLE 스택 초기화 (기본 상태: Advertising 꺼짐)
  initBLE();

  Serial.println("\n[안내] BOOT 버튼(GPIO 9)을 3초간 누르면 BLE 페어링 모드(Advertising)가 시작됩니다.");
  Serial.println("[안내] 시리얼 모니터에 't' 입력 시 영점 교정이 시작됩니다.\n");
}

// ==========================================
// 6. loop() 메인 루틴
// ==========================================
void loop() {
  // --- A. 3초 버튼 롱프레스 감지 (Non-blocking) ---
  int btnState = digitalRead(BUTTON_PIN);
  if (btnState == LOW) { // 버튼 눌림 상태
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
  } else { // 버튼 해제 상태
    if (buttonIsPressed) {
      buttonIsPressed = false;
      // 버튼 누름 해제 후 I2C Bus 재동기화 (SCL line 정돈)
      Wire.begin(SDA_PIN, SCL_PIN);
    }
  }

  // --- B. BLE Advertising 타임아웃 (180초 후 자동 중단) ---
  if (isAdvertising && !deviceConnected) {
    if (millis() - advStartTime >= BLE_ADV_TIMEOUT_MS) {
      Serial.println("\n[BLE] Advertising 타임아웃 (3분 경과). 배터리 절약을 위해 BLE 중단.");
      stopBLEAdvertising();
    }
  }

  // --- C. BLE 연결 해제 후 재광고 처리 ---
  if (!deviceConnected && oldDeviceConnected) {
    delay(500); // 버퍼 정리 대기
    pServer->startAdvertising(); // 재연결 대기
    Serial.println("[BLE] 연결 해제 후 Advertising 재개");
    oldDeviceConnected = deviceConnected;
  }
  if (deviceConnected && !oldDeviceConnected) {
    oldDeviceConnected = deviceConnected;
  }

  // --- D. 영점 조절 플래그 처리 ---
  if (triggerCalibrationFlag) {
    triggerCalibrationFlag = false;
    calibrateZero();
  }

  // --- E. 시리얼 입력 처리 ('t' 또는 'r' 입력 시 영점 재잡기) ---
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 't' || cmd == 'T' || cmd == 'r' || cmd == 'R') {
      calibrateZero();
    }
  }

  // --- F. 버튼 누르고 있는 중이 아닐 때만 IMU 센서 데이터 측정 및 출력 ---
  if (!buttonIsPressed) {
    int16_t accelGyro[6] = {0};
    if (bmi160.getAccelGyroData(accelGyro) == BMI160_OK) {
      float zero_gx = accelGyro[0] - gx_offset;
      float zero_gy = accelGyro[1] - gy_offset;
      float zero_gz = accelGyro[2] - gz_offset;

      float zero_ax = accelGyro[3] - ax_offset;
      float zero_ay = accelGyro[4] - ay_offset;
      float zero_az = accelGyro[5] - az_offset;

      // 시리얼 디버그 출력 (필요 시 주석 가능)
      Serial.print("Acc [X,Y,Z]: ");
      Serial.print(zero_ax, 1); Serial.print("\t");
      Serial.print(zero_ay, 1); Serial.print("\t");
      Serial.print(zero_az, 1); Serial.print("\t | Gyro: ");
      Serial.print(zero_gx, 1); Serial.print("\t");
      Serial.print(zero_gy, 1); Serial.print("\t");
      Serial.println(zero_gz, 1);

      // 앱과 BLE 연결되어 있는 경우 STATUS Characteristic으로 데이터 Notify
      if (deviceConnected) {
        char statusPayload[64];
        snprintf(statusPayload, sizeof(statusPayload),
                 "A:%.0f,%.0f,%.0f|G:%.0f,%.0f,%.0f",
                 zero_ax, zero_ay, zero_az, zero_gx, zero_gy, zero_gz);
        pStatusCharacteristic->setValue(statusPayload);
        pStatusCharacteristic->notify();
      }
    }
  }

  delay(100);
}

// ==========================================
// 7. 영점 조절 (Calibration) 함수
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
  }
}

// ==========================================
// 8. BLE 초기화 및 제어 함수
// ==========================================
void initBLE() {
  // BLE 디바이스 초기화
  BLEDevice::init(deviceName.c_str());

  // BLE 서버 생성
  pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  // BLE 서비스 생성
  BLEService *pService = pServer->createService(SERVICE_UUID);

  // Status Characteristic (Read, Notify)
  pStatusCharacteristic = pService->createCharacteristic(
                            STATUS_CHAR_UUID,
                            BLECharacteristic::PROPERTY_READ |
                            BLECharacteristic::PROPERTY_NOTIFY
                          );
  pStatusCharacteristic->addDescriptor(new BLE2902());
  pStatusCharacteristic->setValue("IDLE");

  // Config Characteristic (Read, Write)
  pConfigCharacteristic = pService->createCharacteristic(
                            CONFIG_CHAR_UUID,
                            BLECharacteristic::PROPERTY_READ |
                            BLECharacteristic::PROPERTY_WRITE
                          );
  pConfigCharacteristic->setCallbacks(new ConfigCharCallbacks());

  // Info Characteristic (Read - MAC Address & Firmware version)
  pInfoCharacteristic = pService->createCharacteristic(
                          INFO_CHAR_UUID,
                          BLECharacteristic::PROPERTY_READ
                        );
  String infoStr = "MAC:" + deviceMacAddress + ",FW:v1.0.0";
  pInfoCharacteristic->setValue(infoStr.c_str());

  // 서비스 시작
  pService->start();

  Serial.println("[BLE] GATT Profile 및 서비스 초기화 완료.");
}

void startBLEAdvertising() {
  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06); // iPhone 연결 호환성 설정
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
