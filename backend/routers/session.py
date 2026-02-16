from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from db.mongo_client import workout_logs
from pipeline.mag_fingerprint import fingerprint_store
from state.session_cache import session_cache

router = APIRouter(prefix="/session", tags=["session"])


# ── Pydantic 모델 ─────────────────────────────────────────────────────────────

class EquipmentInfo(BaseModel):
    equipment_id:   str
    equipment_name: str
    confidence:     float


class InProgressSetData(BaseModel):
    set_number: int
    weight:     float
    reps:       int


class InProgressLogInfo(BaseModel):
    log_id: str
    sets:   list[InProgressSetData]


class SessionSnapshotResponse(BaseModel):
    # 현재 텀블러 상태 ('moving' | 'settled')
    tumbler_state:    str
    # 현재 감지된 기구 정보 (없으면 None)
    equipment:        EquipmentInfo | None
    # 진행 중인 운동 로그 (없으면 None)
    in_progress_log:  InProgressLogInfo | None


# ── 엔드포인트 ────────────────────────────────────────────────────────────────

@router.get("/{user_id}", response_model=SessionSnapshotResponse)
async def get_session_snapshot(user_id: str):
    """
    새로고침 또는 앱 재진입 시 프론트엔드가 호출하여 현재 세션 상태를 복원한다.

    각 상태는 저장소별로 분리 관리되므로 3곳을 조합하여 반환한다.

    - [백엔드 메모리 / SessionCache]
        tumbler_state, current_equipment_id 조회
        서버 재시작 시 초기화됨 → 세션 없으면 기본값(moving, None) 반환

    - [백엔드 메모리 / FingerprintStore]
        current_equipment_id로 equipment_name 조회
        SessionCache에는 ID만 저장되므로 이름은 FingerprintStore에서 별도 조회
        서버 재시작 시 초기화됨 → equipment_fingerprints 컬렉션과 미동기화 주의

    - [MongoDB / workout_logs 컬렉션]
        status='in_progress' 인 로그 조회하여 세트 목록 복원
        영속 저장소이므로 서버 재시작 후에도 유지됨
    """
    session = session_cache.get(user_id)

    # 세션 없으면 초기 상태 반환
    if session is None:
        return SessionSnapshotResponse(
            tumbler_state='moving',
            equipment=None,
            in_progress_log=None,
        )

    # 기구 정보: current_equipment_id로 fingerprint_store에서 이름 조회
    equipment = None
    if session.current_equipment_id:
        entry = fingerprint_store._store.get(session.current_equipment_id)
        if entry:
            equipment = EquipmentInfo(
                equipment_id=entry.equipment_id,
                equipment_name=entry.equipment_name,
                confidence=1.0,
            )

    # in_progress 로그: 가장 최근 것 1건 조회
    in_progress_log = None
    log_doc = await workout_logs().find_one(
        {"user_id": user_id, "status": "in_progress"},
        sort=[("started_at", -1)],
    )
    if log_doc:
        in_progress_log = InProgressLogInfo(
            log_id=str(log_doc["_id"]),
            sets=[
                InProgressSetData(
                    set_number=s["set_number"],
                    weight=s["weight"],
                    reps=s["reps"],
                )
                for s in log_doc.get("sets", [])
            ],
        )

    return SessionSnapshotResponse(
        tumbler_state=session.tumbler_state,
        equipment=equipment,
        in_progress_log=in_progress_log,
    )
