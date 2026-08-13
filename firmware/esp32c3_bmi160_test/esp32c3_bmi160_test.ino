#include <Wire.h>
#include <DFRobot_BMI160.h>

// DFRobot BMI160 객체 생성
DFRobot_BMI160 bmi160;

// ESP32-C3 Super Mini 기본 I2C 핀 지정
const int SDA_PIN = 8;
const int SCL_PIN = 9;

// BMI160 I2C 주소 (DFRobot 기본값: 0x68 또는 0x69)
const int bmi160_i2c_addr = 0x69;

void setup() {
  Serial.begin(115200);
  
  // USB CDC 초기화 대기
  delay(2000);
  Serial.println("\n=== DFRobot BMI160 센서 테스트 시작 ===");

  // ESP32-C3 I2C 핀 시작
  Wire.begin(SDA_PIN, SCL_PIN);

  // 센서 초기화
  if (bmi160.softReset() != BMI160_OK) {
    Serial.println("ERROR: 센서 리셋 실패");
  }

  // I2C 연결 및 센서 초기화 (0x68 주소 시도)
  if (bmi160.I2cInit(bmi160_i2c_addr) != BMI160_OK) {
    Serial.println("ERROR: BMI160 센서를 찾을 수 없습니다!");
    Serial.println("1. 배선(SDA: GPIO8, SCL: GPIO9)을 확인하세요.");
    Serial.println("2. 안 될 경우 코드의 '0x68'을 '0x69'로 바꿔보세요.");
    while (1); // 실패 시 대기
  }

  Serial.println("SUCCESS: BMI160 센서 연결 성공!");
  Serial.println("----------------------------------------");
}

void loop() {
  int16_t accelGyro[6] = {0}; // 가속도(3축) + 자이로(3축) 데이터를 담을 배열

  // 센서 데이터 한 번에 읽어오기
  // [0]=gyroX, [1]=gyroY, [2]=gyroZ, [3]=accelX, [4]=accelY, [5]=accelZ
  int rslt = bmi160.getAccelGyroData(accelGyro);

  if (rslt == BMI160_OK) {
    // 가속도 값 출력
    Serial.print("Accel [X, Y, Z]: ");
    Serial.print(accelGyro[3]); Serial.print("\t");
    Serial.print(accelGyro[4]); Serial.print("\t");
    Serial.print(accelGyro[5]); Serial.print("\t|\t");

    // 자이로 값 출력
    Serial.print("Gyro [X, Y, Z]: ");
    Serial.print(accelGyro[0]); Serial.print("\t");
    Serial.print(accelGyro[1]); Serial.print("\t");
    Serial.println(accelGyro[2]);
  } else {
    Serial.println("데이터 읽기 실패!");
  }

  delay(500); // 0.5초 간격
}