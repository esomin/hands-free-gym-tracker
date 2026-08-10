# [PRD] Hands-Free Med Tracker 개발 요구사항 명세서

## 1. System Overview & Core Principles

- **목적**: 6축 자이로·가속도(IMU) 센서 데이터를 실시간 처리하여 사용자의 조작이 필요 없는 자율형 복약 및 영양제 관리 시스템 구축.
- **개발 철학**:
  1. **Zero-Touch UX**: 사용자는 약통을 들었다 놓는 자연스러운 동작 외에 별도 앱 입력이나 버튼 조작을 하지 않는다.
  2. **Deterministic Logging**: 오복용 위험 방지를 위해 시간대 추론을 배제하고, `bottle_id` 기반 하드웨어 이벤트를 확정적으로 매칭한다.
  3. **Low-Latency & High Reliability**: 초당 수십 회 발생하는 센서 데이터는 파이프라인 정제 및 In-Memory 캐싱을 거쳐 최종 상태 확정 시에만 DB에 영속화한다.

---

## 2. Functional Requirements by Module

### Module A. Hardware & Firmware (ESP32-C3)
1. **6축 IMU 센서 데이터 수집**:
   - 약통별 부착된 6축 자이로·가속도 센서로부터 $Ax, Ay, Az, Gx, Gy, Gz$ Raw Data 수집 (최소 20Hz~50Hz 샘플링 rate).
2. **WebSocket 실시간 스트리밍**:
   - 약통 식별 정보(`bottle_id`) 및 Raw Data를 JSON 패킷 구조로 백엔드 WebSocket 서버에 전송.

---

### Module B. Data Pipeline & Backend Engine (FastAPI)

#### B-1. Noise Filtering (`pipeline/noise_filter.py`)
- **NumPy 기반 필터링**:
  - 유입되는 Raw IMU 데이터의 고주파 진동 및 외부 노이즈 제거.
  - 이동 평균 필터(Moving Average Filter) 또는 저주파 차단 필터(Low-Pass Filter) 적용.

#### B-2. State Machine Engine (`pipeline/imu_state.py`)
- **2단계 상태 전이 추적**:
  - `IDLE/SETTLED` $\rightarrow$ `MOVING` (가속도/자이로 변화 임계값 초과 시)
  - `MOVING` $\rightarrow$ `SETTLED` (움직임 멈춤 및 거치 안착 임계값 충족 시)
- **복약 완료 이벤트 발행**:
  - `MOVING` $\rightarrow$ `SETTLED` 전이가 완료된 시점을 **복약 완료 이벤트**로 규정.

#### B-3. In-Memory Session Cache (`state/session_cache.py`)
- **DB I/O 최적화**:
  - 연속 유입 스트림을 DB에 직접 쓰지 않고 `collections.deque` 및 `functools.lru_cache` 구조를 활용해 백엔드 메모리 상에서 실시간 관리.
- **데이터 영속화 (Persistence)**:
  - `SETTLED` 상태가 최종 확정되는 시점에만 MongoDB `medication_logs` 컬렉션에 쓰기 operations 수행.

---

### Module C. Sensor Data Simulator (`simulator/`)

- **Streamlit 기반 테스팅 도구**:
  - 실물 하드웨어 없이 백엔드 및 프론트엔드 연동 테스팅을 지원하는 GUI 개발.
- **제어 기능**:
  - 약통 ID 선택 (`Bottle_01`, `Bottle_02` 등)
  - 노이즈 레벨 조절 슬라이더 (정상 거치, 가벼운 흔들림, 복용 동작 시뮬레이션)
  - WebSocket 메세지 전송 제어 (시작/정지/상태 강제 전이)

---

### Module D. Frontend Web App (React)

#### D-1. Real-Time Dashboard (`components/Dashboard.tsx`, `BottleStatus.tsx`)
- **WebSocket 상태 수신**: `useWebSocket` 커스텀 훅을 이용해 약통별 현재 상태(`moving` / `settled`)를 실시간 카드로 인디케이팅.
- **로그 및 순응도 시각화**:
  - 당일 약통별 복용 여부 체크리스트 표시.
  - 주간/월간 복약 순응도(%), 연속 복용 일수(Streak), 시간대별 복용 분포 차트 제공.

#### D-2. Phase 2 Alert & Notification Manager (확장 기능)
- **미복용 지연 감지 스케줄러**:
  - 사용자가 설정한 복용 시간 대비 일정 시간(예: 30분, 1시간) 동안 `SETTLED` 이벤트를 수신하지 못할 경우 미복용 상태로 판정.
- **비상 푸시 알림**:
  - 1차: 스마트 거치대 부저/LED 경고 이벤트 전송.
  - 2차: 보호자/관제 앱으로 비상 Push Notification 발송.

---

## 3. Database Schema (MongoDB)

### Collection: `bottles`
```json
{
  "_id": "ObjectId",
  "bottle_id": "BOTTLE_01",
  "name": "아침 혈압약 & 비타민",
  "target_time": "08:00",
  "created_at": "ISODate"
}
````

### Collection: medication_logs
```json
{
  "_id": "ObjectId",
  "bottle_id": "BOTTLE_01",
  "event_type": "settled",
  "taken_at": "2026-08-10T08:15:00Z",
  "status": "SUCCESS"
}
```
## 4. Implementation Steps
1. Step 1: simulator/ 폴더 내 Streamlit 앱 및 WebSocket 전송 모듈(ws_emitter.py) 구현.
2. Step 2: FastAPI websocket/handler.py 및 NumPy 기반 pipeline/noise_filter.py, pipeline/imu_state.py 알고리즘 연동.
3. Step 3: state/session_cache.py 작성 및 MongoDB 영속화 로직 결합.
4. Step 4: React 프론트엔드 실시간 WebSocket 수신 UI 및 REST API 통신 구현.
5. Step 5: Phase 2 미복용 감지 스케줄러 및 푸시 이벤트 핸들러 추가.


<FollowUp label="코딩 에이전트에 입력할 첫 번째 구현 단계(시뮬레이터 & 파이프라인) 스캐폴딩 코드를 생성할까요?" query="요구사항 명세서를 바탕으로 백엔드 파이프라인(noise_filter.py, imu_state.py)과 Streamlit 시뮬레이터의 기본 스캐폴딩 코드를 작성해 주세요."/>