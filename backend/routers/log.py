from __future__ import annotations

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.mongo_client import workout_logs

router = APIRouter(prefix="/logs", tags=["logs"])


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class SetData(BaseModel):
    # 세트 번호 (1부터 시작)
    set_number: int
    # 무게 (kg)
    weight: float
    # 반복 횟수
    reps: int
    # 세트 기록 시각
    logged_at: datetime | None = None


class WorkoutLogCreate(BaseModel):
    # 사용자 식별자
    user_id: str
    # 기구 식별자 (equipment_fingerprints 컬렉션 _id)
    equipment_id: str
    # 기구 이름
    equipment_name: str
    # 초기 세트 목록 (빈 리스트도 허용)
    sets: list[SetData] = []


class UpdateSetsBody(BaseModel):
    # 교체할 세트 목록 전체
    sets: list[SetData]


class WorkoutLogResponse(BaseModel):
    id: str
    user_id: str
    equipment_id: str
    equipment_name: str
    sets: list[SetData]
    status: str
    started_at: datetime
    ended_at: datetime | None


# ── 헬퍼 ─────────────────────────────────────────────────────────────────────

def _serialize(doc: dict) -> dict:
    """MongoDB 도큐먼트의 ObjectId를 문자열로 변환한다."""
    doc['id'] = str(doc.pop('_id'))
    return doc


def _parse_oid(log_id: str) -> ObjectId:
    """log_id 문자열을 ObjectId로 변환한다. 실패 시 400 에러."""
    try:
        return ObjectId(log_id)
    except Exception:
        raise HTTPException(status_code=400, detail="유효하지 않은 log_id 입니다.")


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/")
async def get_logs(
    user_id: str = Query(..., description="사용자 ID"),
    start: datetime | None = Query(None, description="조회 시작 시각 (ISO 8601)"),
    end: datetime | None = Query(None, description="조회 종료 시각 (ISO 8601)"),
):
    """
    특정 사용자의 완료된(completed) 운동 로그를 날짜 범위로 필터링하여 반환한다.
    in_progress 상태의 로그는 포함하지 않는다.
    """
    # completed 상태만 반환
    query: dict = {"user_id": user_id, "status": "completed"}

    if start or end:
        query["started_at"] = {}
        if start:
            query["started_at"]["$gte"] = start
        if end:
            query["started_at"]["$lte"] = end

    # started_at 내림차순 정렬 (최신순)
    cursor = workout_logs().find(query).sort("started_at", -1)
    docs = await cursor.to_list(length=200)
    return [_serialize(doc) for doc in docs]


@router.post("/", status_code=201)
async def create_log(body: WorkoutLogCreate):
    """새 운동 로그 도큐먼트를 in_progress 상태로 생성한다."""
    now = datetime.now(timezone.utc)
    doc = {
        "user_id":        body.user_id,
        "equipment_id":   body.equipment_id,
        "equipment_name": body.equipment_name,
        # 세트 데이터: logged_at 이 없으면 현재 시각으로 채움
        "sets": [
            {**s.model_dump(), "logged_at": s.logged_at or now}
            for s in body.sets
        ],
        # 운동 시작 시 in_progress, 완료 시 completed 로 업데이트
        "status":     "in_progress",
        "started_at": now,
        "ended_at":   None,
        "created_at": now,
    }
    result = await workout_logs().insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.patch("/{log_id}/complete", status_code=200)
async def complete_log(log_id: str):
    """운동 완료: status 를 completed 로 업데이트하고 종료 시각을 기록한다."""
    oid = _parse_oid(log_id)
    now = datetime.now(timezone.utc)
    result = await workout_logs().update_one(
        {"_id": oid},
        {"$set": {"status": "completed", "ended_at": now}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    return {"ok": True, "ended_at": now.isoformat()}


@router.put("/{log_id}/sets", status_code=200)
async def update_sets(log_id: str, body: UpdateSetsBody):
    """목표 수정: in_progress 로그의 세트 목록 전체를 교체한다."""
    oid = _parse_oid(log_id)
    now = datetime.now(timezone.utc)
    new_sets = [
        {**s.model_dump(), "logged_at": s.logged_at or now}
        for s in body.sets
    ]
    result = await workout_logs().update_one(
        {"_id": oid},
        {"$set": {"sets": new_sets}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="로그를 찾을 수 없습니다.")
    return {"ok": True}


@router.delete("/in-progress", status_code=200)
async def delete_in_progress(user_id: str = Query(..., description="사용자 ID")):
    """기구 교체 시 기존 in_progress 로그를 삭제한다."""
    result = await workout_logs().delete_many(
        {"user_id": user_id, "status": "in_progress"},
    )
    return {"ok": True, "deleted_count": result.deleted_count}
