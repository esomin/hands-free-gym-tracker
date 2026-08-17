from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from db.mongo_client import bottles

router = APIRouter(tags=["Bottle"])


class BottleSchema(BaseModel):
    bottle_id: str = Field(..., example="BOTTLE_01")
    name: str = Field(..., example="아침 유산균")
    target_time: str = Field(..., example="08:00")
    status: str = Field("ACTIVE", example="ACTIVE")
    created_at: Optional[str] = None
    ended_at: Optional[str] = None


class BottleCreateSchema(BaseModel):
    bottle_id: str = Field(..., example="BOTTLE_04")
    name: str = Field(..., example="저녁 처방약")
    target_time: str = Field(..., example="19:00")
    mode: Optional[str] = Field("create", example="create")  # "create", "update", "archive_and_create"


@router.get("/bottles", response_model=List[BottleSchema])
async def get_all_bottles():
    """등록된 모든 활성 약통 목록 조회"""
    cursor = bottles().find(
        {"$or": [{"status": "ACTIVE"}, {"status": {"$exists": False}}]},
        {"_id": 0}
    )
    result = await cursor.to_list(length=100)
    return result


@router.get("/bottles/{bottle_id}", response_model=BottleSchema)
async def get_bottle_by_id(bottle_id: str):
    """특정 활성 약통 상세 정보 조회"""
    bottle = await bottles().find_one(
        {
            "bottle_id": bottle_id,
            "$or": [{"status": "ACTIVE"}, {"status": {"$exists": False}}]
        },
        {"_id": 0}
    )
    if not bottle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"약통 ID '{bottle_id}'를 찾을 수 없습니다.",
        )
    return bottle


@router.post("/bottles", response_model=BottleSchema, status_code=status.HTTP_201_CREATED)
async def create_or_update_bottle(payload: BottleCreateSchema):
    """약통 신규 등록 또는 메타데이터 수정 / 아카이브 분기 처리"""
    now_iso = datetime.now(timezone.utc).isoformat()
    mode = payload.mode or "create"

    # 기존 활성 약통 검색
    existing = await bottles().find_one({
        "bottle_id": payload.bottle_id,
        "$or": [{"status": "ACTIVE"}, {"status": {"$exists": False}}]
    })

    if existing:
        if mode == "create":
            # 중복 발생 시 409 Conflict 반환 (기존 약통 정보 포함)
            existing.pop("_id", None)
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "DUPLICATE_BOTTLE",
                    "message": f"약통 '{payload.bottle_id}'는 이미 '{existing.get('name')}'(으)로 등록되어 있습니다.",
                    "existing_bottle": existing,
                },
            )
        elif mode == "update":
            # 기존 약통 메타데이터 수정
            await bottles().update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "name": payload.name,
                        "target_time": payload.target_time,
                        "status": "ACTIVE",
                        "updated_at": now_iso,
                    }
                },
            )
            existing["name"] = payload.name
            existing["target_time"] = payload.target_time
            existing["status"] = "ACTIVE"
            existing.pop("_id", None)
            return existing
        elif mode == "archive_and_create":
            # 기존 약통 ARCHIVED 마감 처리
            await bottles().update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "status": "ARCHIVED",
                        "ended_at": now_iso,
                    }
                },
            )

    # 신규 ACTIVE 약통 등록
    doc = {
        "bottle_id": payload.bottle_id,
        "name": payload.name,
        "target_time": payload.target_time,
        "status": "ACTIVE",
        "created_at": now_iso,
    }

    await bottles().insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.delete("/bottles/{bottle_id}")
async def delete_bottle(bottle_id: str):
    """약통 등록 삭제 (아카이브 처리)"""
    now_iso = datetime.now(timezone.utc).isoformat()
    res = await bottles().update_many(
        {
            "bottle_id": bottle_id,
            "$or": [{"status": "ACTIVE"}, {"status": {"$exists": False}}]
        },
        {
            "$set": {
                "status": "ARCHIVED",
                "ended_at": now_iso,
            }
        }
    )
    if res.modified_count == 0:
        # 혹시 이미 아카이브 되었거나 없는 경우 직접 삭제 시도
        res_del = await bottles().delete_one({"bottle_id": bottle_id})
        if res_del.deleted_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"약통 ID '{bottle_id}'를 찾을 수 없습니다.",
            )
    return {"deleted": True, "bottle_id": bottle_id}
