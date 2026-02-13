from datetime import datetime, timezone

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

from db.mongo_client import create_indexes
from routers import equipment, log, routine
from websocket.handler import handle_sensor_stream, manager

app = FastAPI(title="Hands-Free Gym Tracker API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# REST API 라우터 등록
app.include_router(log.router,       prefix="/api")
app.include_router(routine.router,   prefix="/api")
app.include_router(equipment.router, prefix="/api")


# ── 앱 시작/종료 이벤트 ───────────────────────────────────────────────────────

@app.on_event("startup")
async def startup():
    try:
        await create_indexes()
    except Exception as e:
        print(f"[startup] MongoDB 연결 실패 (WebSocket은 정상 동작): {e}")


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


# ── 개발 테스트용 ─────────────────────────────────────────────────────────────
# 실제 파이프라인 없이 이벤트 브로드캐스트를 수동으로 트리거한다

@app.post("/dev/trigger/{user_id}/equipment-unknown")
async def trigger_equipment_unknown(user_id: str):
    """미등록 기구 감지 이벤트를 강제 브로드캐스트 — 모달 팝업 확인용"""
    await manager.broadcast(user_id, {
        "type": "equipment_unknown",
        "payload": {
            "rawFingerprintId": "test-fingerprint-001",
            "detectedAt": datetime.now(timezone.utc).isoformat(),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"triggered": True}


@app.post("/dev/trigger/{user_id}/tumbler-state")
async def trigger_tumbler_state(user_id: str, state: str = "settled"):
    """텀블러 상태 전이 이벤트를 강제 브로드캐스트 — 뱃지 변경 확인용"""
    await manager.broadcast(user_id, {
        "type": "tumbler_state_changed",
        "payload": {
            "state": state,
            "transitioned_at": datetime.now(timezone.utc).isoformat(),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"triggered": True, "state": state}


@app.post("/dev/trigger/{user_id}/equipment-detected")
async def trigger_equipment_detected(user_id: str):
    """기구 인식 이벤트를 강제 브로드캐스트 — SmartDefault 카드 렌더링 확인용"""
    await manager.broadcast(user_id, {
        "type": "equipment_detected",
        "payload": {
            "equipmentId": "test-equipment-001",
            "equipmentName": "레그프레스",
            "confidence": 0.99,
            "detectedAt": datetime.now(timezone.utc).isoformat(),
        },
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
    return {"triggered": True}
