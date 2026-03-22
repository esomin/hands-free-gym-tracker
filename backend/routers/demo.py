from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter

from db.mongo_client import workout_logs
from websocket.handler import manager

router = APIRouter(prefix="/demo", tags=["demo"])

# 실행 중인 시나리오 태스크 (user_id → asyncio.Task)
_running: dict[str, asyncio.Task] = {}


def is_demo_running(user_id: str) -> bool:
    """해당 유저의 데모 시나리오가 실행 중인지 반환"""
    return user_id in _running and not _running[user_id].done()

# 시나리오 기구 목록 및 세트 데이터
_DEMO_EQUIPMENT = [
    {
        "id":   "demo-bench-press",
        "name": "벤치프레스",
        "sets": [
            {"weight": 60.0, "reps": 10},
            {"weight": 60.0, "reps": 8},
            {"weight": 55.0, "reps": 8},
        ],
    },
    {
        "id":   "demo-leg-press",
        "name": "레그프레스",
        "sets": [
            {"weight": 100.0, "reps": 12},
            {"weight": 100.0,  "reps": 10},
            {"weight": 90.0,  "reps": 10},
        ],
    },
]


async def _run_scenario(user_id: str) -> None:
    """
    자동 시나리오 시퀀스.
    각 기구에 대해: 이동 중 → 거치됨 → 기구 감지 → 운동 시작 → 운동 완료
    """

    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    async def broadcast(msg: dict) -> None:
        await manager.broadcast(user_id, msg)

    async def tumbler(state: str) -> None:
        await broadcast({
            "type": "tumbler_state_changed",
            "payload": {"state": state, "transitionedAt": now_iso()},
            "timestamp": now_iso(),
        })

    for equip in _DEMO_EQUIPMENT:
        # 1. 이동 중
        await tumbler("moving")
        await asyncio.sleep(2)

        # 2. 거치됨
        await tumbler("settled")
        await asyncio.sleep(1)

        # 3. 기구 감지
        await broadcast({
            "type": "equipment_detected",
            "payload": {
                "equipmentId":   equip["id"],
                "equipmentName": equip["name"],
                "confidence":    0.97,
                "detectedAt":    now_iso(),
            },
            "timestamp": now_iso(),
        })
        await asyncio.sleep(3)

        # 4. 운동 로그 생성 (in_progress)
        now = datetime.now(timezone.utc)
        sets_doc = [
            {
                "set_number": i + 1,
                "weight":     s["weight"],
                "reps":       s["reps"],
                "logged_at":  now,
            }
            for i, s in enumerate(equip["sets"])
        ]
        result = await workout_logs().insert_one({
            "user_id":        user_id,
            "equipment_id":   equip["id"],
            "equipment_name": equip["name"],
            "sets":           sets_doc,
            "status":         "in_progress",
            "started_at":     now,
            "ended_at":       None,
            "created_at":     now,
            "is_demo":        True,
        })
        log_id = str(result.inserted_id)

        await broadcast({
            "type": "demo_workout_started",
            "payload": {
                "logId": log_id,
                "sets":  [{"weight": s["weight"], "reps": s["reps"]} for s in equip["sets"]],
            },
            "timestamp": now_iso(),
        })
        await asyncio.sleep(8)

        # 5. 운동 완료
        await workout_logs().update_one(
            {"_id": ObjectId(log_id)},
            {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc)}},
        )
        await broadcast({
            "type": "demo_workout_completed",
            "payload": {"logId": log_id},
            "timestamp": now_iso(),
        })
        await asyncio.sleep(1)

    # 최종: 이동 중 (idle 복귀)
    await tumbler("moving")

    # 전체 시나리오 완료 알림
    await broadcast({
        "type": "demo_scenario_completed",
        "payload": {},
        "timestamp": now_iso(),
    })

    # 10초 후 이 데모에서 생성한 로그 삭제
    await asyncio.sleep(10)
    await workout_logs().delete_many({"user_id": user_id, "is_demo": True})
    await broadcast({
        "type": "demo_logs_cleared",
        "payload": {},
        "timestamp": now_iso(),
    })


@router.post("/scenario/{user_id}", status_code=202)
async def start_scenario(user_id: str):
    """자동 시나리오 데모를 시작한다. 이미 실행 중이면 재시작한다."""
    # 기존 실행 중인 태스크가 있으면 취소 (10초 대기 중 재시작 포함)
    if user_id in _running:
        _running[user_id].cancel()

    # 이전 데모 로그가 남아 있으면 즉시 삭제 후 프론트에 갱신 알림
    result = await workout_logs().delete_many({"user_id": user_id, "is_demo": True})
    if result.deleted_count > 0:
        await manager.broadcast(user_id, {
            "type": "demo_logs_cleared",
            "payload": {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    task = asyncio.create_task(_run_scenario(user_id))
    _running[user_id] = task

    # 태스크 완료/취소 시 딕셔너리에서 자동 제거
    task.add_done_callback(lambda _: _running.pop(user_id, None))

    return {"started": True}
