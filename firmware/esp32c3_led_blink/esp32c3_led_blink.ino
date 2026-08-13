// ESP32-C3 Super Mini 내장 LED 핀 (대부분 GPIO 8에 연결되어 있습니다)
const int LED_PIN = 8;

void setup() {
  // 시리얼 통신 시작 (보드레이트 115200)
  Serial.begin(115200);
  
  // 내장 LED 핀을 출력 모드로 설정
  pinMode(LED_PIN, OUTPUT);
  
  // USB CDC 연결 대기 (초기화 문구가 잘리지 않도록 잠시 대기)
  delay(2000);
  Serial.println("\n=== ESP32-C3 Super Mini 연결 성공! ===");
}

void loop() {
  // LED 켜기 (Low Active 방식인 보드가 많아 LOW일 때 점등됩니다)
  digitalWrite(LED_PIN, LOW);
  Serial.println("Status: LED ON / Board Connected!");
  delay(1000);

  // LED 끄기
  digitalWrite(LED_PIN, HIGH);
  Serial.println("Status: LED OFF / Board Connected!");
  delay(1000);
}