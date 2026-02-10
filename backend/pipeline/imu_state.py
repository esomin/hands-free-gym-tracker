from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

# ── 상수 (notebooks/imu_state_dev.ipynb 그리드 탐색으로 확정) ───────────────
# 슬라이딩 윈도우 크기 (샘플 수, 50 Hz 기준 0.4 s)
WINDOW_SIZE = 20
# |accel − 1.0 g| 이동 평균 임계값 (g)
MOVE_ACCEL_THRESHOLD = 0.04
# gyro 분산 임계값 ((rad/s)²) — 상세 근거: docs/imu_thresholds.md
MOVE_GYRO_VAR = 0.40

# ── 타입 정의 ─────────────────────────────────────────────────────────────────
# 텀블러 2단계 상태
# moving : 텀블러가 이동 중 (가속도 편차 또는 자이로 활성)
# settled: 텀블러가 거치됨 (중력만 측정, 자이로 ≈ 0) → 기구 식별 트리거
TumblerState = Literal['moving', 'settled']


@dataclass
class SensorReading:
    # 가속도 크기 (g 단위, 정지 시 ≈ 1.0 g)
    accel_magnitude: float
    # 자이로 크기 (rad/s, 정지 시 ≈ 0)
    gyro_magnitude: float
    # 측정 시각 (UTC)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


# ── 핵심 함수 ─────────────────────────────────────────────────────────────────

def detect_tumbler_state(sensor_window: deque[SensorReading]) -> TumblerState:
    """
    슬라이딩 윈도우 내 센서 값으로 텀블러 상태를 판별한다.

    판별 규칙 (OR 조건 — 하나라도 초과 시 이동 중):
        |accel − 1.0 g| 이동 평균 > MOVE_ACCEL_THRESHOLD
        gyro 분산              > MOVE_GYRO_VAR

    윈도우가 비어 있으면 보수적으로 'moving' 반환.
    """
    if len(sensor_window) == 0:
        return 'moving'

    readings = list(sensor_window)

    # 중력(1.0 g) 기준 편차의 이동 평균
    accel_dev_mean = sum(abs(r.accel_magnitude - 1.0) for r in readings) / len(readings)

    # gyro 크기의 분산
    gyro_values = [r.gyro_magnitude for r in readings]
    gyro_mean   = sum(gyro_values) / len(gyro_values)
    gyro_var    = sum((v - gyro_mean) ** 2 for v in gyro_values) / len(gyro_values)

    if accel_dev_mean > MOVE_ACCEL_THRESHOLD or gyro_var > MOVE_GYRO_VAR:
        return 'moving'
    return 'settled'


def make_state_event(
    new_state: TumblerState,
    prev_state: TumblerState,
    timestamp: datetime | None = None,
) -> dict | None:
    """
    상태가 전이된 경우 WebSocket 브로드캐스트용 이벤트 딕셔너리를 반환한다.
    전이가 없으면 None 반환.
    """
    if new_state == prev_state:
        return None

    ts = timestamp or datetime.now(timezone.utc)

    return {
        # 이벤트 타입: 프론트엔드 WebSocketEvent 타입과 일치
        'type': 'tumbler_state_changed',
        'payload': {
            # 새 상태
            'state': new_state,
            # 전이 시각 (ISO 8601)
            'transitioned_at': ts.isoformat(),
        },
        'timestamp': ts.isoformat(),
    }
