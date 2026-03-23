from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter

from db.mongo_client import user_routines, workout_logs
from websocket.handler import manager

router = APIRouter(prefix="/demo", tags=["demo"])

# 실행 중인 시나리오 태스크 (user_id → asyncio.Task)
# — _run_scenario가 demo_scenario_completed 직후 반환되므로
#   이 dict에 있는 동안만 "데모 진행 중"으로 간주
_running: dict[str, asyncio.Task] = {}

# 로그 정리 태스크 (user_id → asyncio.Task)
# — demo_scenario_completed 이후 3초 후 삭제 실행
#   is_demo_running 체크 대상에서 제외 → 버튼이 정상 활성화됨
_cleanup: dict[str, asyncio.Task] = {}


def is_demo_running(user_id: str) -> bool:
    """해당 유저의 데모 시나리오가 실행 중인지 반환 (cleanup 대기 중은 제외)"""
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


async def _cleanup_demo_logs(user_id: str) -> None:
    """demo_scenario_completed 후 3초 뒤 데모 로그를 삭제하고 프론트에 알린다."""
    def now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    await asyncio.sleep(3)
    await workout_logs().delete_many({"user_id": user_id, "is_demo": True})
    await manager.broadcast(user_id, {
        "type":      "demo_logs_cleared",
        "payload":   {},
        "timestamp": now_iso(),
    })


async def _run_scenario(user_id: str) -> None:
    """
    자동 시나리오 시퀀스.
    각 기구에 대해: 이동 중 → 거치됨 → 기구 감지 → 운동 시작 → 운동 완료
    시나리오 완료 후 demo_scenario_completed를 브로드캐스트하고 즉시 반환.
    로그 정리는 별도 _cleanup 태스크에서 처리.
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

        # 3. 기구 감지 전 user_routines 선등록
        # — equipment_detected → fetchForEquipment 호출 시 SmartDefault에 데모 데이터가 채워지도록
        last_set = equip["sets"][-1]
        await user_routines().update_one(
            {"user_id": user_id, "equipment_id": equip["id"]},
            {"$set": {
                "last_weight":       last_set["weight"],
                "last_reps":         last_set["reps"],
                "last_sets":         len(equip["sets"]),
                "last_performed_at": datetime.now(timezone.utc),
            }},
            upsert=True,
        )

        # 4. 기구 감지
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

        # 5. 운동 로그 생성 (in_progress)
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

        # 6. 운동 완료
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

    # 3초 후 전체 시나리오 완료 알림 (버튼 재활성화)
    await asyncio.sleep(3)
    await broadcast({
        "type":      "demo_scenario_completed",
        "payload":   {},
        "timestamp": now_iso(),
    })

    # 로그 정리를 별도 태스크로 분리
    # — _run_scenario는 여기서 반환 → _running에서 제거 → is_demo_running = False
    # — cleanup 태스크가 3초 후 demo_logs_cleared 브로드캐스트
    cleanup = asyncio.create_task(_cleanup_demo_logs(user_id))
    _cleanup[user_id] = cleanup
    cleanup.add_done_callback(lambda _: _cleanup.pop(user_id, None))


@router.post("/scenario/{user_id}", status_code=202)
async def start_scenario(user_id: str):
    """자동 시나리오 데모를 시작한다. 이미 실행 중이면 재시작한다."""
    # 기존 시나리오 태스크 취소
    if user_id in _running:
        _running[user_id].cancel()

    # 기존 cleanup 태스크 취소 (3초 대기 중 재시작 포함)
    if user_id in _cleanup:
        _cleanup[user_id].cancel()

    # 이전 데모 로그가 남아 있으면 즉시 삭제 후 프론트에 갱신 알림
    result = await workout_logs().delete_many({"user_id": user_id, "is_demo": True})
    if result.deleted_count > 0:
        await manager.broadcast(user_id, {
            "type":      "demo_logs_cleared",
            "payload":   {},
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    task = asyncio.create_task(_run_scenario(user_id))
    _running[user_id] = task

    # 태스크 완료/취소 시 딕셔너리에서 자동 제거
    task.add_done_callback(lambda _: _running.pop(user_id, None))

    return {"started": True}
