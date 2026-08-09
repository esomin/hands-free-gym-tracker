# Hands-Free Med-Tracker (자율형 복약 및 순응도 관리 시스템)

> **노-터치 IMU 센서 기반 자율형 복약 추적 및 순응도 관리 솔루션**

---

## 1. Overview (개요)

Hands-Free Med-Tracker는 매일 정기적으로 약(처방약, 만성질환 약 등)을 복용하는 현대인과 복약 습관을 관리하고자 하는 사용자를 위한 **자율형 복약 관리 시스템**입니다. **GY-BMI160 6축 관성 센서(IMU)만을 활용**하여 사용자 개입을 최소화한 "버튼 0회" UX를 제공합니다.

약통을 들었다 내려놓는 자연스러운 일상 동작만으로 센서가 움직임(`moving`)과 거치 완료(`settled`) 상태를 초저지연으로 감지하여 복용 데이터를 자동 생성합니다. 단계별 개발 전략(Phase 1, Phase 2)을 통해 핵심 복약 로깅부터 보호자/보호 네트워크 비상 관제까지 확장 가능한 구조를 제시합니다.

---

## 2. Key Features (핵심 기능)

* **GY-BMI160 단일 센서 기반 움직임 감지**:
* GY-BMI160 6축(가속도+자이로) 센서로 약통의 들림과 내려놓음(`moving` $\rightarrow$ `settled`) 패턴을 정밀 추적.


* **버튼 Zero-Touch 복약 로깅 (Phase 1)**:
* 별도의 버튼 조작이나 스마트폰 태깅 없이 약을 꺼내 먹고 내려놓는 즉시 데이터베이스에 복용 시각 자동 기록.


* **복약 순응도(Adherence) 대시보드 (Phase 1)**:
* 주간/월간 복약 달성률 통계, 연속 복용 일수(Streak), 시간대별 복용 패턴 분석 제공.


* **지연 복용 알림 & 비상 Push 관제 (Phase 2)**:
* 복용 예정 시간 미준수 시 1차 디바이스 부저/LED 알림 제공.
* 일정 시간 이상 미복용 지속 시 가족/지인에게 비상 Push 알림 전송 기능 확장.



---

## 3. Architecture (아키텍처)

### 3.1. System Overview (ASCII Box Diagram)

```
+-----------------------------------------------------------------------+
|                            Smart Dock Device                          |
|  +---------------------+         +---------------------------------+  |
|  | GY-BMI160 (6-Axis)  | ------> | ESP32-C3 Microcontroller        |  |
|  | Accel + Gyro Sensor | Sensor  | (WebSocket Client / Wi-Fi)      |  |
|  +---------------------+ Stream  +---------------------------------+  |
+-----------------------------------------------------------------------+
                                   |
                                   | WebSocket (Real-time Stream)
                                   v
+-----------------------------------------------------------------------+
|                            Backend Server                             |
|  +-----------------------------------------------------------------+  |
|  | FastAPI Application                                             |  |
|  |   - WebSocket Handler                                           |  |
|  |   - IMU State Engine (moving -> settled Detection)              |  |
|  |   - Adherence Calculation Engine                                |  |
|  |   - Emergency Push Service (Phase 2)                            |  |
|  +-----------------------------------------------------------------+  |
|                                  |                                    |
|                                  v                                    |
|                       +--------------------+                          |
|                       |  MongoDB Database  |                          |
|                       +--------------------+                          |
+-----------------------------------------------------------------------+
                                   |
                                   | REST API / WebSockets
                                   v
+-----------------------------------------------------------------------+
|                        Frontend App (React)                           |
|  +----------------------------------+  +---------------------------+  |
|  | Real-time Adherence Dashboard    |  | Phase 2 Alert Manager     |  |
|  | (Daily/Weekly Stats & Streak)    |  | (Push Warning & Notif)    |  |
|  +----------------------------------+  +---------------------------+  |
+-----------------------------------------------------------------------+

```

---

## 4. Tech Stack (기술 스택)

| 영역 | 기술 스택 | 비고 / 역할 |
| --- | --- | --- |
| **Hardware** | ESP32-C3-SuperMini, GY-BMI160 | 6축 관성 센서 데이터 수집 및 Wi-Fi 전송 |
| **Backend** | Python 3.11+, FastAPI, WebSockets | 실시간 센서 스트림 처리, 상태 엔진, REST API |
| **Database** | MongoDB | 센서 로그, 복용 이력, 사용자 프로필 저장 |
| **Frontend** | React 18, TypeScript, Tailwind CSS | 복약 순응도 대시보드 및 관제 UI |
| **DevSecOps** | Docker, Docker Compose, GitHub Actions | 컨테이너화 및 CI/CD 파이프라인 |

---

## 5. Project Structure (프로젝트 구조)

### 5.1. Directory Tree

```
hands-free-med-tracker/
├── firmware/                       # ESP32-C3 마이크로컨트롤러 임베디드 C++ 코드
│   ├── include/                    # 헤더 파일 모음
│   ├── src/                        # GY-BMI160 센서 드라이버 및 WebSocket 클라이언트
│   └── platformio.ini              # PlatformIO 빌드 및 의존성 설정
├── backend/                        # FastAPI 백엔드 애플리케이션
│   ├── app/
│   │   ├── api/                    # REST API 라우터 및 WebSocket 엔드포인트
│   │   ├── core/                   # 환경변수 및 보안 설정
│   │   ├── db/                     # MongoDB 연결 및 데이터 모델
│   │   ├── services/               # IMU 상태 엔진 (`moving` -> `settled`) 및 로직
│   │   └── main.py                 # FastAPI 진입점
│   ├── tests/                      # 백엔드 유닛 및 통합 테스트
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/                       # React 웹 대시보드
│   ├── src/
│   │   ├── components/             # UI 컴포넌트 (차트, 대시보드 카운터)
│   │   ├── pages/                  # 메인 대시보드 및 설정 페이지
│   │   ├── services/               # API 및 WebSocket 통신 클라이언트
│   │   └── App.tsx
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml              # 전체 시스템 멀티 컨테이너 실행 환경
└── README.md

```

### 5.2. Dependency Flow (패키지 간 의존성 방향)

```
[firmware]  ---> (WebSocket Stream) --->  [backend]
                                              ^
[frontend]  ---> (REST API / WS)  -----------|

```

---

## 6. Getting Started (실행 방법)

### 6.1. Prerequisites (사전 요구사항)

* **Hardware**: ESP32-C3-SuperMini 개발 보드, GY-BMI160 IMU 센서 모듈
* **Software Tools**:
* Node.js v18+ 및 npm / yarn
* Python 3.11+
* Docker 및 Docker Compose
* VS Code PlatformIO IDE Extension (펌웨어 빌드용)



---

### 6.2. Installation & Run (설치 및 실행)

#### Step 1: Repository Clone

```bash
git clone https://github.com/your-org/hands-free-med-tracker.git
cd hands-free-med-tracker

```

#### Step 2: Run Backend & Database (Docker)

```bash
# Docker Compose를 이용한 백엔드 및 MongoDB 실행
docker-compose up --build -d

```

#### Step 3: Backend Local Manual Setup (Alternative)

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

```

#### Step 4: Frontend Setup & Run

```bash
cd ../frontend
npm install
npm run start

```

#### Step 5: Firmware Build & Flash (ESP32-C3)

```bash
cd ../firmware
# PlatformIO CLI 사용 시
pio run --target upload

```

#### Step 6: Test Execution

```bash
# 백엔드 테스트 수행
cd ../backend
pytest

```

---