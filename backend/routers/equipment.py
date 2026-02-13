from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from pipeline.mag_fingerprint import fingerprint_store
from state.session_cache import session_cache

router = APIRouter(prefix="/equipment", tags=["equipment"])


# ── Pydantic 모델 ──────────────────────────────────────────────────────────────

class RegisterEquipmentRequest(BaseModel):
    # 등록을 요청한 사용자 ID (세션에서 pending_mag_vector 조회에 사용)
    user_id: str
    # 사용자가 입력한 기구 이름
    equipment_name: str


class RegisterEquipmentResponse(BaseModel):
    # 새로 생성된 기구 ID
    equipment_id: str
    # 등록된 기구 이름
    equipment_name: str
    # 인식 신뢰도 (신규 등록이므로 1.0 고정)
    confidence: float


# ── 엔드포인트 ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterEquipmentResponse)
async def register_equipment(body: RegisterEquipmentRequest):
    """
    equipment_unknown 이벤트 발생 후 사용자가 기구 이름을 입력하면 호출한다.

    세션에 임시 저장된 지자기 평균 벡터(pending_mag_vector)로
    fingerprint_store에 새 기구를 등록하고, 생성된 기구 정보를 반환한다.
    """
    session = session_cache.get(body.user_id)

    # 세션 또는 pending_mag_vector 없으면 등록 불가
    if session is None or session.pending_mag_vector is None:
        raise HTTPException(
            status_code=404,
            detail="등록할 지자기 지문이 없습니다. 먼저 기구 옆에 텀블러를 거치해 주세요.",
        )

    # fingerprint_store에 새 기구 등록
    entry = fingerprint_store.register(body.equipment_name, session.pending_mag_vector)

    # 세션 상태 갱신
    session.current_equipment_id = entry.equipment_id
    session.pending_mag_vector = None

    return RegisterEquipmentResponse(
        equipment_id=entry.equipment_id,
        equipment_name=entry.equipment_name,
        confidence=1.0,
    )
