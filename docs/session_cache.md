# Session Cache 아키텍처 (Med Tracker)

WebSocket으로 연결된 각 사용자의 실시간 약통 복용 상태 및 세션 정보를 서버 메모리에 유지하는 데이터 구조입니다.
50Hz 센서 데이터를 처리하는 동안 데이터베이스 조회 없이 빠르게 상태를 읽고 씁니다.

---

## SessionState 주요 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | `str` | WebSocket 연결 단위 식별자 |
| `bottle_id` | `str` | 세션에서 관리 중인 약통 식별자 (예: `'BOTTLE_01'`) |
| `tumbler_state` / `bottle_state` | `'idle' \| 'moving' \| 'pouring' \| 'settled'` | 약통 동작 4단계 상태 |
| `recent_sensor_window` | `deque[SensorReading]` | 50Hz 센서 데이터 슬라이딩 윈도우 (`WINDOW_SIZE=100`) |
| `ema_state` | `dict[str, float]` | 6축 센서 데이터 평활용 EMA 필터 상태 |
| `last_intake_at` | `datetime \| None` | 마지막으로 복용 감지된 시각 (중복 감지 Cooldown 방지용) |
| `session_started_at` | `datetime` | 세션 시작 시각 (UTC) |
| `last_active_at` | `datetime` | 마지막 센서 수신 시각 (UTC) |

---

## 동작 흐름

```text
① 시뮬레이터 / 임베디드 디바이스  →  /ws/{user_id} 연결
   session_cache.get_or_create(user_id)

② 50Hz 6축 IMU 센서 데이터 수신
   - EMA 필터링 (filter_sensor_3axis)
   - 슬라이딩 윈도우 추가 (recent_sensor_window.append)
   - detect_medication_intake() 복용 판별 및 MongoDB 이력 영속화
   - detect_bottle_state() 상태 전이 감지 및 클라이언트 브로드캐스트
   - session_cache.touch(user_id)  (last_active_at 갱신)

③ WebSocket 연결 해제
   session_cache.remove(user_id)
```

---

## 세션 수 상한 (MAX_SESSIONS = 500)

* 메모리 과다 사용 방지를 위해 최대 500개 세션을 LRU(Least Recently Used) 방식으로 관리합니다.
* 초과 시 `last_active_at` 기준으로 가장 오래된 비활성 세션을 자동 제거합니다.
* 서버 재시작 시 메모리 세션이 초기화되며, 클라이언트의 WebSocket 재연결 시 세션이 자동 재생성됩니다.
