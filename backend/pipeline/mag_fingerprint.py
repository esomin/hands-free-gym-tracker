from __future__ import annotations

import math
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

# 코사인 유사도 임계값 (notebooks/mag_fingerprint_dev.ipynb 그리드 탐색으로 확정)
# 이 값 이상이면 동일 기구로 판별
MATCH_THRESHOLD = 0.97

# 거치됨 전이 후 지자기 지문을 채취할 최소 샘플 수
# 단일 샘플 대신 평균 벡터로 비교하여 노이즈 억제
MIN_SETTLE_SAMPLES = 5

# 지자기 3축 벡터 타입 (μT 단위)
MagVector = tuple[float, float, float]


@dataclass
class FingerprintEntry:
    equipment_id: str
    equipment_name: str
    # 등록 시 수집한 지자기 벡터 평균값
    vector: MagVector
    registered_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ── 내부 유틸 ──────────────────────────────────────────────────────────────────

def _cosine_similarity(a: MagVector, b: MagVector) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x ** 2 for x in a))
    norm_b = math.sqrt(sum(x ** 2 for x in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def mean_vector(vectors: list[MagVector]) -> MagVector:
    n = len(vectors)
    return (
        sum(v[0] for v in vectors) / n,
        sum(v[1] for v in vectors) / n,
        sum(v[2] for v in vectors) / n,
    )


# ── 지문 저장소 ────────────────────────────────────────────────────────────────

class FingerprintStore:
    """
    기구별 지자기 지문 벡터를 관리한다.

    In-Memory 저장. 서버 재시작 시 초기화되며,
    향후 startup 훅에서 load_from_db()를 호출하여 MongoDB와 동기화한다.
    """

    def __init__(self) -> None:
        # equipment_id → FingerprintEntry
        self._store: dict[str, FingerprintEntry] = {}

    def match(self, mag_vec: MagVector) -> FingerprintEntry | None:
        """
        가장 유사한 지문을 반환한다.
        MATCH_THRESHOLD 미만이면 None (미등록 기구).
        """
        best_entry: FingerprintEntry | None = None
        best_score = -1.0
        for entry in self._store.values():
            score = _cosine_similarity(mag_vec, entry.vector)
            if score > best_score:
                best_score = score
                best_entry = entry
        if best_score >= MATCH_THRESHOLD:
            return best_entry
        return None

    def register(self, equipment_name: str, mag_vec: MagVector) -> FingerprintEntry:
        """새 기구 지문을 등록하고 생성된 entry를 반환한다."""
        entry = FingerprintEntry(
            equipment_id=str(uuid.uuid4()),
            equipment_name=equipment_name,
            vector=mag_vec,
        )
        self._store[entry.equipment_id] = entry
        return entry

    def update_vector(self, equipment_id: str, new_vec: MagVector) -> None:
        """기존 지문 벡터를 재방문 샘플과의 평균으로 갱신한다."""
        entry = self._store.get(equipment_id)
        if entry is None:
            return
        entry.vector = mean_vector([entry.vector, new_vec])

    def seed(self, entries: list[FingerprintEntry]) -> None:
        """테스트 또는 DB 로드용 일괄 등록."""
        for e in entries:
            self._store[e.equipment_id] = e

    def __len__(self) -> int:
        return len(self._store)


fingerprint_store = FingerprintStore()


# ── 파이프라인 진입점 ──────────────────────────────────────────────────────────

def match_from_samples(
    mag_samples: list[MagVector],
) -> tuple[FingerprintEntry | None, MagVector]:
    """
    여러 샘플의 평균 벡터로 지문을 매칭한다.
    반환: (매칭된 entry 또는 None, 평균 벡터)
    """
    avg = mean_vector(mag_samples)
    return fingerprint_store.match(avg), avg


# ── 이벤트 생성 ────────────────────────────────────────────────────────────────

def make_equipment_detected_event(
    entry: FingerprintEntry,
    confidence: float,
    timestamp: datetime,
) -> dict:
    return {
        'type': 'equipment_detected',
        'payload': {
            'equipmentId': entry.equipment_id,
            'equipmentName': entry.equipment_name,
            'confidence': round(confidence, 4),
            'detectedAt': timestamp.isoformat(),
        },
        'timestamp': timestamp.isoformat(),
    }


def make_equipment_unknown_event(raw_fingerprint_id: str, timestamp: datetime) -> dict:
    return {
        'type': 'equipment_unknown',
        'payload': {
            'rawFingerprintId': raw_fingerprint_id,
            'detectedAt': timestamp.isoformat(),
        },
        'timestamp': timestamp.isoformat(),
    }
