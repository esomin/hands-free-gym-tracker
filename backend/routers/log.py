from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from db.mongo_client import medication_logs, bottles

router = APIRouter(prefix="/logs", tags=["Medication Logs"])


class MedicationLogCreate(BaseModel):
    bottle_id: str = Field(..., example="BOTTLE_01")
    event_type: str = Field("settled", example="settled")
    taken_at: Optional[str] = None
    status: str = Field("SUCCESS", example="SUCCESS")


class MedicationLogResponse(BaseModel):
    id: str
    bottle_id: str
    event_type: str
    taken_at: str
    status: str


class AdherenceStatsResponse(BaseModel):
    total_logs: int
    adherence_rate: float
    streak_days: int
    bottle_stats: dict


def _serialize(doc: dict) -> dict:
    doc['id'] = str(doc.pop('_id'))
    return doc


@router.get("", response_model=List[MedicationLogResponse])
@router.get("/", response_model=List[MedicationLogResponse])
async def get_logs(
    bottle_id: Optional[str] = Query(None, description="약통 식별자"),
    start: Optional[str] = Query(None, description="조회 시작 시각 (ISO 8601)"),
    end: Optional[str] = Query(None, description="조회 종료 시각 (ISO 8601)"),
):
    """복용 이력 로그 목록 조회"""
    query: dict = {}
    if bottle_id:
        query["bottle_id"] = bottle_id

    if start or end:
        query["taken_at"] = {}
        if start:
            query["taken_at"]["$gte"] = start
        if end:
            query["taken_at"]["$lte"] = end

    cursor = medication_logs().find(query).sort("taken_at", -1)
    docs = await cursor.to_list(length=300)
    return [_serialize(doc) for doc in docs]


@router.post("", response_model=MedicationLogResponse, status_code=201)
@router.post("/", response_model=MedicationLogResponse, status_code=201)
async def create_log(body: MedicationLogCreate):
    """복용 이력 수동 생성 및 영속화"""
    taken_time = body.taken_at or datetime.now(timezone.utc).isoformat()

    doc = {
        "bottle_id": body.bottle_id,
        "event_type": body.event_type,
        "taken_at": taken_time,
        "status": body.status,
    }

    result = await medication_logs().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.get("/stats", response_model=AdherenceStatsResponse)
async def get_adherence_stats():
    """복약 순응도(%) 및 연속 달성 일수(Streak) 통계 계산"""
    all_bottles = await bottles().find({}, {"_id": 0}).to_list(length=100)
    all_logs = await medication_logs().find({}, {"_id": 0}).to_list(length=1000)

    total_logs = len(all_logs)
    bottle_counts: dict[str, int] = {}
    for log in all_logs:
        b_id = log.get("bottle_id", "UNKNOWN")
        bottle_counts[b_id] = bottle_counts.get(b_id, 0) + 1

    # 복약 순응도 계산 (단순 기준 85%+)
    adherence_rate = round((total_logs / max(len(all_bottles) * 7, 1)) * 100, 1)
    adherence_rate = min(adherence_rate, 100.0)

    # 연속 달성 일수 (Streak) 샘플 계산
    streak_days = min(total_logs, 7)

    return {
        "total_logs": total_logs,
        "adherence_rate": adherence_rate,
        "streak_days": streak_days,
        "bottle_stats": bottle_counts,
    }


@router.delete("/{log_id}")
async def delete_log(log_id: str):
    """복용 로그 삭제"""
    try:
        oid = ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="유효하지 않은 log_id 입니다.")

    res = await medication_logs().delete_one({"_id": oid})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="해당 로그를 찾을 수 없습니다.")
    return {"ok": True, "deleted_id": log_id}
