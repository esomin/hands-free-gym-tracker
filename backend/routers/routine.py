from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.mongo_client import user_routines, workout_logs

router = APIRouter(prefix="/routine", tags=["routine"])


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class SetDetail(BaseModel):
    # 세트 무게 (kg)
    weight: float
    # 세트 반복 횟수
    reps: int


class SmartDefaultResponse(BaseModel):
    # 조회 기준 기구 ID
    equipment_id: str
    # 이전 운동의 세트별 무게·횟수 목록. 신규 기구면 빈 리스트
    suggested_sets_detail: list[SetDetail]
    # 참조한 과거 운동 날짜. 신규 기구면 None
    based_on_date: datetime | None


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/smart-default", response_model=SmartDefaultResponse)
async def get_smart_default(
    user_id: str = Query(..., description="사용자 ID"),
    equipment_id: str = Query(..., description="기구 ID"),
):
    """
    사용자가 특정 기구에서 가장 최근에 수행한 루틴을 조회하여
    스마트 디폴트 값(무게·횟수·세트)을 반환한다.

    과거 기록이 없으면 기본값(0 kg, 0 회, 1 세트)을 반환한다.
    """
    # user_routines 컬렉션에서 최근 루틴 조회
    routine = await user_routines().find_one(
        {"user_id": user_id, "equipment_id": equipment_id},
        sort=[("last_performed_at", -1)],
    )

    if routine and routine.get("last_sets_detail"):
        return SmartDefaultResponse(
            equipment_id=equipment_id,
            suggested_sets_detail=[
                SetDetail(weight=s["weight"], reps=s["reps"])
                for s in routine["last_sets_detail"]
            ],
            based_on_date=routine.get("last_performed_at"),
        )

    # 루틴 기록이 없으면 workout_logs 에서 전체 세트 데이터로 폴백
    last_log = await workout_logs().find_one(
        {"user_id": user_id, "equipment_id": equipment_id},
        sort=[("started_at", -1)],
    )

    if last_log and last_log.get("sets"):
        return SmartDefaultResponse(
            equipment_id=equipment_id,
            suggested_sets_detail=[
                SetDetail(weight=s.get("weight", 0.0), reps=s.get("reps", 0))
                for s in last_log["sets"]
            ],
            based_on_date=last_log.get("started_at"),
        )

    # 완전히 새로운 기구 — 빈 목록 반환
    return SmartDefaultResponse(
        equipment_id=equipment_id,
        suggested_sets_detail=[],
        based_on_date=None,
    )


class UpsertRoutineBody(BaseModel):
    user_id: str
    equipment_id: str
    sets_detail: list[SetDetail]


@router.post("/upsert", status_code=200)
async def upsert_routine(body: UpsertRoutineBody):
    """
    운동 세션 종료 후 user_routines 컬렉션을 갱신한다.
    기존 기록이 있으면 업데이트, 없으면 새로 삽입한다.
    """
    now = datetime.now()
    await user_routines().update_one(
        {"user_id": body.user_id, "equipment_id": body.equipment_id},
        {"$set": {
            "last_sets_detail":  [s.model_dump() for s in body.sets_detail],
            "last_performed_at": now,
        }},
        upsert=True,
    )
    return {"ok": True}
