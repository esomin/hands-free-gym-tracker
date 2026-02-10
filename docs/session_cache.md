# Session Cache 아키텍처

WebSocket으로 연결된 각 사용자의 실시간 상태를 서버 메모리에 유지하는 구조입니다.
50Hz 센서 데이터를 처리하는 동안 DB 조회 없이 상태를 읽고 씁니다.

---

## SessionState 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `user_id` | `str` | WebSocket 연결 단위 식별자 |
| `tumbler_state` | `'moving' \| 'settled'` | 텀블러 현재 상태, 초기값 `'moving'` |
| `current_equipment_id` | `str \| None` | 거치됨 상태에서 지자기로 식별한 기구 ID |
| `recent_sensor_window` | `deque[SensorReading]` | 슬라이딩 윈도우 (maxlen=20) |
| `session_started_at` | `datetime` | 세션 시작 시각 (UTC) |
| `last_active_at` | `datetime` | 마지막 센서 수신 시각 (UTC) |

---

## 동작 흐름

```
① 시뮬레이터 → /ws/user-1 연결
   session_cache.get_or_create("user-1")

② 센서 데이터 수신
   recent_sensor_window.append(reading)
   session.tumbler_state = detect_tumbler_state(window)
   session_cache.touch("user-1")          # last_active_at 갱신

③ WebSocket 연결 해제
   session_cache.remove("user-1")
```

---

## 세션 수 상한 (MAX_SESSIONS = 500)

초과 시 `last_active_at` 기준으로 가장 오래된 세션을 자동 제거합니다.
서버 재시작 시 전체 초기화 — 클라이언트 WebSocket 재연결로 세션이 다시 생성됩니다.

