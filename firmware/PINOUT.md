# 하드웨어 핀아웃 및 배선 명세서

본 문서는 `firmware/` 프로젝트에서 사용되는 메인 컨트롤러 보드(**ESP32-C3 Super Mini**)와 센서 모듈(**DFRobot BMI160 IMU**)의 핀아웃 및 상호 연동 배선 정보를 정의합니다.

---

## 1. ESP32-C3 Super Mini 핀아웃 (Pinout Diagram)

### 보드 핀 레이아웃 (Top View)

```
                  +-------------------+
            MISO  | GPIO5       5V    | Power In
            MOSI  | GPIO6       GND   | Ground
              SS  | GPIO7       3V3   | 3.3V Out
     [SDA / LED]  | GPIO8       GPIO4 | [A4 / SCK]
    [SCL / BOOT]  | GPIO9       GPIO3 | [A3]
                  | GPIO10      GPIO2 | [A2]
             RX   | GPIO20      GPIO1 | [A1]
             TX   | GPIO21      GPIO0 | [A0]
                  +-------------------+
```

### ESP32-C3 Super Mini 주요 핀 사양

| 핀 명칭 | GPIO 번호 | 기본/내장 기능 | PillBox 프로젝트 내 역할 | 비고 |
| :--- | :--- | :--- | :--- | :--- |
| **3V3** | - | 3.3V 전원 출력 | BMI160 VCC 공급 | 최대 전류 제한 확인 필요 |
| **GND** | - | 접지 (Ground) | BMI160 GND 연결 | 공통 Ground |
| **GPIO 8** | `GPIO 8` | SDA / 내장 Blue LED | **BMI160 I2C SDA** | 내장 LED와 핀 공유 (Active LOW) |
| **GPIO 9** | `GPIO 9` | SCL / 내장 BOOT 버튼 | **BMI160 I2C SCL & 3초 페어링 버튼** | BOOT 버튼과 핀 공유 (Active LOW, Pull-up) |
| **GPIO 4** | `GPIO 4` | SCK / ADC A4 | 여분 핀 (디지털/아날로그) | 필요 시 I2C 대체 또는 외부 LED용 |
| **GPIO 5** | `GPIO 5` | MISO / ADC A5 | 여분 핀 (SPI/GPIO) | 필요 시 I2C 대체 핀 |
| **GPIO 3** | `GPIO 3` | ADC A3 / GPIO | 여분 핀 | 필요 시 외부 버튼/LED 확장용 |

---

## 2. DFRobot BMI160 6축 IMU 센서 핀아웃

DFRobot BMI160 모듈은 3축 가속도계 및 3축 자이로스코프를 탑재한 초저전력 6축 IMU 센서입니다.

```
       +-------------------------+
       |   DFRobot BMI160 IMU    |
       |                         |
       |  [VCC] [GND] [SDA] [SCL]| [INT1] [INT2]
       +--|-----|-----|-----|----+
```

### BMI160 모듈 핀 정의

| Pin Name | 기능 | 설명 | ESP32-C3 연결 |
| :--- | :--- | :--- | :--- |
| **VCC** | Power | 전원 입력 (3.3V ~ 5V 호환) | `3V3` |
| **GND** | Ground | 공통 접지 | `GND` |
| **SDA** | I2C Data | I2C 시리얼 데이터 | `GPIO 8` |
| **SCL** | I2C Clock | I2C 시리얼 클럭 | `GPIO 9` |
| **INT1** | Interrupt 1 | 하드웨어 인터럽트 1 (미사용 시 NC) | N/C |
| **INT2** | Interrupt 2 | 하드웨어 인터럽트 2 (미사용 시 NC) | N/C |

* **I2C 주소**: Default `0x69` (또는 SDO 핀 상태에 따라 `0x68`)

---

## 3. 스마트 약통 하드웨어 상호 배선표 (Interconnection Table)

| ESP32-C3 Super Mini 핀 | BMI160 센서 핀 | 신호 종류 | 비고 및 주요 고려사항 |
| :--- | :--- | :--- | :--- |
| **3V3** | **VCC** | Power (3.3V) | 센서 전원 공급 |
| **GND** | **GND** | Ground | 전원 접지 |
| **GPIO 8** | **SDA** | I2C Data | 내장 Blue LED 공유 (I2C 통신 시 LED flicker 동작) |
| **GPIO 9** | **SCL** | I2C Clock | 내장 BOOT 버튼 공유 (3초 롱프레스 시 I2C 예외 처리 적용) |

---

## 4. 특이사항 및 소프트웨어 처리 지침

1. **BOOT 버튼 누름 시 I2C 동작 보호**:
   - `GPIO 9` BOOT 버튼을 3초간 누를 때 I2C SCL 라인이 LOW로 접지됩니다.
   - 펌웨어(`esp32c3_ble_pillbox.ino`)는 버튼 누름 구간 동안 I2C 측정을 잠시 대기하고, 버튼이 떼어지면 `Wire.begin(8, 9)`를 재호출하여 센서 통신 버스를 즉시 복구합니다.

2. **내장 LED 시각화**:
   - `GPIO 8` SDA 통신 파형으로 인해 데이터 수집 중에는 내장 LED가 은은하게 Flicker 현상을 일으킵니다.
   - BLE 페어링 상태 알림은 시리얼 로그 및 BLE GATT Notify를 통해 앱으로 전송됩니다.
