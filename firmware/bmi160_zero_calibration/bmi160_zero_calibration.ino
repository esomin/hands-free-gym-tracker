#include <DFRobot_BMI160.h>

DFRobot_BMI160 bmi160;

// 영점(오프셋) 저장 변수
float ax_offset = 0, ay_offset = 0, az_offset = 0;
float gx_offset = 0, gy_offset = 0, gz_offset = 0;

void setup() {
  Serial.begin(115200);
  while (!Serial);

  // BMI160 센서 초기화 (I2C 주소 0x68 또는 0x69)
  if (bmi160.softReset() != BMI160_OK) {
    Serial.println("BMI160 소프트 리셋 실패");
  }
  
  if (bmi160.I2cInit(0x69) != BMI160_OK) { // 주소에 따라 0x68 또는 0x69 사용
    Serial.println("BMI160 센서를 찾을 수 없습니다. 연결 및 I2C 주소를 확인하세요.");
    while (1);
  }

  Serial.println("DFRobot BMI160 센서 초기화 완료.");
  Serial.println("물건에 센서를 고정하고 가만히 둔 상태에서 't'를 입력하면 영점이 잡힙니다.");

  // 시작 시 자동으로 첫 영점 설정
  calibrateZero();
}

void loop() {
  // 시리얼 모니터에 't' 또는 'r' 입력 시 영점 재잡기
  if (Serial.available() > 0) {
    char cmd = Serial.read();
    if (cmd == 't' || cmd == 'T' || cmd == 'r' || cmd == 'R') {
      calibrateZero();
    }
  }

  // 센서 데이터 읽기 (accelGyro[0..2]: Gyro X,Y,Z / accelGyro[3..5]: Accel X,Y,Z)
  int16_t accelGyro[6] = {0};
  bmi160.getAccelGyroData(accelGyro);

  // 자이로 raw 데이터 (gyro)
  float raw_gx = accelGyro[0];
  float raw_gy = accelGyro[1];
  float raw_gz = accelGyro[2];

  // 가속도 raw 데이터 (accel)
  float raw_ax = accelGyro[3];
  float raw_ay = accelGyro[4];
  float raw_az = accelGyro[5];

  // 영점 오프셋을 차감한 실시간 변화량
  float zero_ax = raw_ax - ax_offset;
  float zero_ay = raw_ay - ay_offset;
  float zero_az = raw_az - az_offset;

  float zero_gx = raw_gx - gx_offset;
  float zero_gy = raw_gy - gy_offset;
  float zero_gz = raw_gz - gz_offset;

  // 시리얼 모니터 출력
  Serial.print("Acc [X,Y,Z]: ");
  Serial.print(zero_ax, 2); Serial.print("\t");
  Serial.print(zero_ay, 2); Serial.print("\t");
  Serial.print(zero_az, 2); Serial.print("\t | ");

  Serial.print("Gyro [X,Y,Z]: ");
  Serial.print(zero_gx, 2); Serial.print("\t");
  Serial.print(zero_gy, 2); Serial.print("\t");
  Serial.println(zero_gz, 2);

  delay(100);
}

// 50번의 데이터를 측정하여 평균값으로 영점을 설정하는 함수
void calibrateZero() {
  Serial.println("\n[영점 조절 중... 센서를 움직이지 마세요]");

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

  // 평균값 계산하여 오프셋으로 저장
  gx_offset = sum_gx / samples;
  gy_offset = sum_gy / samples;
  gz_offset = sum_gz / samples;

  ax_offset = sum_ax / samples;
  ay_offset = sum_ay / samples;
  az_offset = sum_az / samples;

  Serial.println("[영점 조절 완료! 이제 물건을 움직여보세요.]\n");
}