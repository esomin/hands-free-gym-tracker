from __future__ import annotations

from collections import OrderedDict, deque
from dataclasses import dataclass, field
from datetime import datetime, timezone

from pipeline.imu_state import WINDOW_SIZE, SensorReading, TumblerState

# 서버 메모리에 유지할 최대 세션 수
# 초과 시 가장 오래된 비활성 세션이 LRU 정책으로 자동 제거된다
MAX_SESSIONS = 500


# ── 세션 상태 ─────────────────────────────────────────────────────────────────

@dataclass
class SessionState:
    # 사용자 식별자 (WebSocket 연결 단위로 발급)
    user_id: str

    # 현재 식별된 기구 ID (거치됨 상태 + 지자기 식별 완료 시 채워짐)
    current_equipment_id: str | None

    # 텀블러 2단계 상태: 'moving' | 'settled'
    # 서버 재시작 시 초기값 'moving'으로 리셋, WebSocket 재연결로 복구
    tumbler_state: TumblerState

    # 최근 N개 센서 값 슬라이딩 윈도우 (deque — O(1) 추가/제거)
    # maxlen=WINDOW_SIZE 로 자동 크기 유지
    recent_sensor_window: deque[SensorReading]

    # 세션 시작 시각
    session_started_at: datetime

    # 마지막 센서 이벤트 수신 시각 (모니터링 및 비활성 세션 판단용)
    last_active_at: datetime


# ── LRU 세션 캐시 ─────────────────────────────────────────────────────────────

class SessionCache:
    """
    OrderedDict 기반 LRU 세션 캐시.

    - get/update 시 해당 세션을 OrderedDict 끝으로 이동 → 최근 사용 표시
    - MAX_SESSIONS 초과 시 OrderedDict 앞쪽(가장 오래된) 세션 자동 제거
    - 외부 캐시(Redis 등) 없이 단일 프로세스 내에서 동작
    - 서버 재시작 시 전체 초기화 → 클라이언트 WebSocket 재연결로 세션 복구
    """

    def __init__(self, max_sessions: int = MAX_SESSIONS) -> None:
        # 세션 저장소: key=user_id, 삽입/접근 순서 유지
        self._cache: OrderedDict[str, SessionState] = OrderedDict()
        self._max_sessions = max_sessions

    # ── 조회 ──────────────────────────────────────────────────────────────────

    def get(self, user_id: str) -> SessionState | None:
        """세션을 조회한다. 존재하면 LRU 순서를 최근으로 갱신한다."""
        if user_id not in self._cache:
            return None
        # 접근한 세션을 OrderedDict 끝으로 이동 → 가장 최근 사용
        self._cache.move_to_end(user_id)
        return self._cache[user_id]

    def get_or_create(self, user_id: str) -> SessionState:
        """세션이 없으면 새로 생성하여 반환한다."""
        session = self.get(user_id)
        if session is not None:
            return session
        return self._create(user_id)

    # ── 갱신 ──────────────────────────────────────────────────────────────────

    def touch(self, user_id: str) -> None:
        """last_active_at을 현재 시각으로 갱신하고 LRU 순서를 최근으로 이동한다."""
        session = self._cache.get(user_id)
        if session is None:
            return
        session.last_active_at = datetime.now(timezone.utc)
        self._cache.move_to_end(user_id)

    # ── 제거 ──────────────────────────────────────────────────────────────────

    def remove(self, user_id: str) -> None:
        """세션을 명시적으로 제거한다 (WebSocket 연결 해제 시 호출)."""
        self._cache.pop(user_id, None)

    # ── 상태 ──────────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self._cache)

    def __contains__(self, user_id: str) -> bool:
        return user_id in self._cache

    # ── 내부 생성 ─────────────────────────────────────────────────────────────

    def _create(self, user_id: str) -> SessionState:
        """
        새 SessionState를 생성하고 캐시에 등록한다.
        MAX_SESSIONS 초과 시 가장 오래된(LRU) 세션을 먼저 제거한다.
        """
        if len(self._cache) >= self._max_sessions:
            # OrderedDict 앞쪽 = 가장 오래된 비활성 세션 → 제거
            evicted_id, _ = self._cache.popitem(last=False)
            # 필요 시 여기서 evicted_id 로그 기록 가능

        now = datetime.now(timezone.utc)
        session = SessionState(
            user_id=user_id,
            current_equipment_id=None,
            # 초기 상태는 'moving' — 거치됨 감지 전까지 이동 중으로 간주
            tumbler_state='moving',
            # deque maxlen 으로 크기 자동 유지, 추가/제거 O(1)
            recent_sensor_window=deque(maxlen=WINDOW_SIZE),
            session_started_at=now,
            last_active_at=now,
        )
        self._cache[user_id] = session
        return session


# ── 싱글턴 인스턴스 ───────────────────────────────────────────────────────────
# 서버 프로세스 전체에서 공유되는 단일 캐시
# 서버 재시작 시 자동으로 초기화된다 (In-Memory 특성)
session_cache = SessionCache()
