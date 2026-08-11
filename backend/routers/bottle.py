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
    created_at: Optional[str] = None


class BottleCreateSchema(BaseModel):
    bottle_id: str = Field(..., example="BOTTLE_04")
    name: str = Field(..., example="저녁 처방약")
    target_time: str = Field(..., example="19:00")


@router.get("/bottles", response_model=List[BottleSchema])
async def get_all_bottles():
    """등록된 모든 약통 목록 조회"""
    cursor = bottles().find({}, {"_id": 0})
    result = await cursor.to_list(length=100)
    return result


@router.get("/bottles/{bottle_id}", response_model=BottleSchema)
async def get_bottle_by_id(bottle_id: str):
    """특정 약통 상세 정보 조회"""
    bottle = await bottles().find_one({"bottle_id": bottle_id}, {"_id": 0})
    if not bottle:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"약통 ID '{bottle_id}'를 찾을 수 없습니다.",
        )
    return bottle


@router.post("/bottles", response_model=BottleSchema, status_code=status.HTTP_201_CREATED)
async def create_or_update_bottle(payload: BottleCreateSchema):
    """약통 신규 등록 또는 메타데이터 수정"""
    now_iso = datetime.now(timezone.utc).isoformat()

    doc = {
        "bottle_id": payload.bottle_id,
        "name": payload.name,
        "target_time": payload.target_time,
        "created_at": now_iso,
    }

    await bottles().update_one(
        {"bottle_id": payload.bottle_id},
        {"$set": doc},
        upsert=True,
    )

    return doc


@router.delete("/bottles/{bottle_id}")
async def delete_bottle(bottle_id: str):
    """약통 등록 삭제"""
    res = await bottles().delete_one({"bottle_id": bottle_id})
    if res.deleted_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"약통 ID '{bottle_id}'를 찾을 수 없습니다.",
        )
    return {"deleted": True, "bottle_id": bottle_id}
