from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

# ── 상수 ──────────────────────────────────────────────────────────────────────
# 슬라이딩 윈도우 크기 (샘플 수, INTAKE_SUSTAINED_SAMPLES 50 이상 수용 가능하도록 100으로 설정)
WINDOW_SIZE = 100

# 복용 판별 임계값 (조사 자료 기반)
# AccZ < 0.0 m/s^2 이면서 sqrt(AccX^2 + AccY^2) > 7.0 m/s^2 지속 조건
POURING_ACC_Z_MAX = 0.0
POURING_ACC_XY_MIN = 7.0
# 최소 0.6초 (50Hz 기준 30 샘플) 지속 시 복용 감지 (시뮬레이터 5초 시나리오 및 실제 반응속도 호환)
INTAKE_SUSTAINED_SAMPLES = 20

# |accel − 1.0 g| 이동 평균 임계값 (g)
MOVE_ACCEL_THRESHOLD = 0.04
MOVE_GYRO_VAR = 0.40

# 약통 4단계 상태 정의
# idle: 보관 중 (0도)
# moving: 집어 들거나 이동 중 (45도 등)
# pouring: 손바닥에 알약 털어넣기 중 (110도대 기울임)
# settled: 다시 제자리에 세워 거치 완료 (0도)
BottleState = Literal['idle', 'moving', 'pouring', 'settled']


@dataclass
class SensorReading:
    accel_magnitude: float
    gyro_magnitude: float
    acc_x: float = 0.0
    acc_y: float = 0.0
    acc_z: float = 9.81
    state_deg: int = 0
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


def detect_medication_intake(window: deque[SensorReading]) -> bool:
    """
    윈도우 내 샘플들이 영양제 복용 모션(110도 알약 털어넣기) 조건에 부합하는지 판별한다.

    조건:
    1. AccZ < 0.0 m/s^2 (대각선 ~ 110도 기울임)
    2. sqrt(AccX^2 + AccY^2) > 6.5 m/s^2
    3. 최근 INTAKE_SUSTAINED_SAMPLES (25샘플) 이상 유지
    """
    if len(window) < INTAKE_SUSTAINED_SAMPLES:
        return False

    recent_samples = list(window)[-INTAKE_SUSTAINED_SAMPLES:]

    for r in recent_samples:
        xy_mag = math.sqrt(r.acc_x**2 + r.acc_y**2)
        if not (r.acc_z < POURING_ACC_Z_MAX and xy_mag > 6.5):
            return False

    return True


def detect_bottle_state(sensor_window: deque[SensorReading]) -> BottleState:
    """
    슬라이딩 윈도우 내 센서 값으로 약통의 움직임/거치 상태를 판별한다.
    """
    if len(sensor_window) < WINDOW_SIZE:
        return 'moving'

    readings = list(sensor_window)

    # 최근 센서독출 중 110도 털어넣는 중인지 검사
    latest = readings[-1]
    if latest.acc_z < POURING_ACC_Z_MAX and math.sqrt(latest.acc_x**2 + latest.acc_y**2) > POURING_ACC_XY_MIN:
        return 'pouring'

    accel_dev_mean = sum(abs(r.accel_magnitude - 1.0) for r in readings) / len(readings)
    gyro_values = [r.gyro_magnitude for r in readings]
    gyro_mean = sum(gyro_values) / len(gyro_values)
    gyro_var = sum((v - gyro_mean) ** 2 for v in gyro_values) / len(gyro_values)

    if accel_dev_mean > MOVE_ACCEL_THRESHOLD or gyro_var > MOVE_GYRO_VAR:
        return 'moving'
    return 'settled'


# 기존 호환성용 하위 별칭
detect_tumbler_state = detect_bottle_state


def make_medication_taken_event(
    bottle_id: str,
    timestamp: datetime | None = None,
) -> dict:
    """복용 완료 이벤트 딕셔너리 생성"""
    ts = timestamp or datetime.now(timezone.utc)
    return {
        'type': 'medication_taken',
        'payload': {
            'bottle_id': bottle_id,
            'taken_at': ts.isoformat(),
            'status': 'SUCCESS',
            'state_deg': 110,
        },
        'timestamp': ts.isoformat(),
    }


def make_state_event(
    new_state: BottleState,
    prev_state: BottleState,
    timestamp: datetime | None = None,
) -> dict | None:
    if new_state == prev_state:
        return None

    ts = timestamp or datetime.now(timezone.utc)

    return {
        'type': 'bottle_state_changed',
        'payload': {
            'state': new_state,
            'transitioned_at': ts.isoformat(),
        },
        'timestamp': ts.isoformat(),
    }
