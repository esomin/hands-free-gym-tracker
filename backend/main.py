from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from db.mongo_client import create_indexes
from routers import log, routine
from websocket.handler import handle_sensor_stream

app = FastAPI(title="Hands-Free Gym Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST API 라우터 등록
app.include_router(log.router,     prefix="/api")
app.include_router(routine.router, prefix="/api")


# ── 앱 시작/종료 이벤트 ───────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    # 인덱스가 없으면 생성 (이미 있으면 무시)
    await create_indexes()


# ── WebSocket 엔드포인트 ──────────────────────────────────────────────────────

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    """
    시뮬레이터와 프론트엔드가 공통으로 연결하는 WebSocket 엔드포인트.

    - 시뮬레이터: 센서 데이터(accel_magnitude, gyro_magnitude) 를 전송
    - 프론트엔드: 상태 변화 이벤트(tumbler_state_changed 등) 를 수신
    """
    await handle_sensor_stream(websocket, user_id)


# ── 헬스 체크 ─────────────────────────────────────────────────────────────────

@app.get("/health")
async def health_check():
    return {"status": "ok"}
