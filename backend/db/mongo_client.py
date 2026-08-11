import os
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "med_tracker")

_client: AsyncIOMotorClient | None = None


def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client 


def get_db():
    return get_client()[DB_NAME]


# 약통 등록 정보 컬렉션
def bottles():
    return get_db()["bottles"]


# 복용 이력 로그 컬렉션
def medication_logs():
    return get_db()["medication_logs"]


# 기본 약통 프리셋 데이터
DEFAULT_BOTTLES = [
    {"bottle_id": "BOTTLE_01", "name": "아침 유산균", "target_time": "08:00", "created_at": datetime.now(timezone.utc).isoformat()},
    {"bottle_id": "BOTTLE_02", "name": "점심 비타민 B", "target_time": "12:30", "created_at": datetime.now(timezone.utc).isoformat()},
    {"bottle_id": "BOTTLE_03", "name": "취침 전 비염약", "target_time": "22:30", "created_at": datetime.now(timezone.utc).isoformat()},
]


async def create_indexes():
    """인덱스 생성 및 기본 약통 3종 프리셋 자동 보충(Upsert) 시딩"""
    db = get_db()

    # 인덱스 생성
    await db["bottles"].create_index([("bottle_id", 1)], unique=True)
    await db["medication_logs"].create_index([("bottle_id", 1), ("taken_at", -1)])
    await db["medication_logs"].create_index([("taken_at", -1)])

    # 기본 약통 3종이 없으면 누락된 약통만 자동으로 보충 등록 (Upsert)
    for bottle in DEFAULT_BOTTLES:
        await db["bottles"].update_one(
            {"bottle_id": bottle["bottle_id"]},
            {"$setOnInsert": bottle},
            upsert=True,
        )
    print("[mongo_client] 기본 약통 3종 프리셋 시딩 및 보충 완료")
