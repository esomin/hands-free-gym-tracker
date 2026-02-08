import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "gym_tracker")

_client: AsyncIOMotorClient | None = None


# MongoDB 클라이언트를 반환하는 함수 — 없으면 새로 생성
def get_client() -> AsyncIOMotorClient:
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(MONGO_URI)
    return _client


# 지정한 이름의 데이터베이스 객체를 반환
def get_db():
    return get_client()[DB_NAME]


# 컬렉션 접근 헬퍼
# 운동 세트 기록을 저장하는 컬렉션
def workout_logs():
    return get_db()["workout_logs"]


# 기구별 지자기 지문 패턴을 저장하는 컬렉션
def equipment_fingerprints():
    return get_db()["equipment_fingerprints"]


# 사용자별 최근 루틴(무게·횟수)을 저장하는 컬렉션
def user_routines():
    return get_db()["user_routines"]


# 앱 시작 시 한 번 호출하여 조회 성능을 높이는 인덱스를 MongoDB에 생성
async def create_indexes():
    db = get_db()

    # → 특정 사용자의 최근 운동 기록을 빠르게 조회하기 위함
    await db["workout_logs"].create_index([("user_id", 1), ("started_at", -1)])
    # → 기구별 로그 필터링 속도 향상
    await db["workout_logs"].create_index([("equipment_id", 1)])

    # → 같은 이름의 기구가 중복 등록되지 않도록 MongoDB 레벨에서 보장
    await db["equipment_fingerprints"].create_index([("equipment_name", 1)], unique=True)

    # → 특정 사용자가 특정 기구에서 가장 최근에 수행한 루틴을 빠르게 조회하기 위함
    await db["user_routines"].create_index(
        [("user_id", 1), ("equipment_id", 1), ("last_performed_at", -1)]
    )

