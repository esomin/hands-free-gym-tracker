# WebSocket 아키텍처 및 이벤트 프로토콜 (Med Tracker)

## 연결 구조

```text
┌─────────────────┐        ┌───────────────────────────┐        ┌─────────────┐
│  시뮬레이터/디바이스│──연결──▶│                           │◀──연결──│  브라우저     │
│ (ESP32-C3 6축IMU)│  센서   │   /ws/{user_id}           │  이벤트  │ (프론트엔드)  │
│                 │──데이터─▶│   (백엔드 WebSocket 채널)    │──전송──▶│             │
└─────────────────┘        └───────────────────────────┘        └─────────────┘
```

- **시뮬레이터 / 아두이노 보드**: 50Hz 6축 IMU 센서 데이터를 백엔드로 **전송 (Producer)**
- **브라우저 (프론트엔드)**: 백엔드에서 실시간 분석된 약통 상태 및 복용 완료 이벤트를 **수신 (Consumer)**
- **백엔드**: 6축 IMU 노이즈 필터링 및 복용 알고리즘을 수행하고, 상태 변화 발생 시 해당 `user_id` 채널의 모든 클라이언트에 **브로드캐스트 (Broadcast)**

---

## 전송 및 수신 메세지 명세

### 1. 센서 데이터 수신 (Device → Backend)

```json
{
  "acc_x": 0.12,
  "acc_y": -0.45,
  "acc_z": 9.78,
  "accel_magnitude": 1.02,
  "gyro_magnitude": 0.05,
  "bottle_id": "BOTTLE_01",
  "state_deg": 0,
  "timestamp": "2026-08-13T18:00:00.000Z"
}
```

### 2. 약통 상태 변화 이벤트 (Backend → Frontend)

약통의 상태가 전이(`idle` → `moving` → `pouring` → `settled`)될 때 발행됩니다.

```json
{
  "type": "bottle_state_changed",
  "payload": {
    "state": "pouring",
    "transitioned_at": "2026-08-13T18:07:45.123Z"
  },
  "timestamp": "2026-08-13T18:07:45.123Z"
}
```

### 3. 영양제/알약 복용 완료 감지 이벤트 (Backend → Frontend & DB)

약통을 110도 이상 기울여 알약을 털어넣는 모션이 지속 조건(`INTAKE_SUSTAINED_SAMPLES`)을 만족하면 발행되며, MongoDB `medication_logs` 컬렉션에 자동 영속화됩니다.

```json
{
  "type": "medication_taken",
  "payload": {
    "bottle_id": "BOTTLE_01",
    "taken_at": "2026-08-13T18:07:46.889Z",
    "status": "SUCCESS",
    "state_deg": 110
  },
  "timestamp": "2026-08-13T18:07:46.889Z"
}
```
