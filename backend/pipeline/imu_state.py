from __future__ import annotations

import math
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

# ── 상수 ──────────────────────────────────────────────────────────────────────
# ── 센서 스케일 변환 참고 (Raw LSB -> 물리 단위) ────────────────────────────────
# ±2g 설정 시: 1g ≈ 16384 LSB, 1 m/s^2 ≈ 1670 LSB
# ±250dps 설정 시: 1 rad/s ≈ 7500 LSB

# 슬라이딩 윈도우 크기 (50Hz 기준 2.0초 수용)
WINDOW_SIZE = 100

# 약통 털어넣기(Shaking/Pouring) 복용 판별 임계값 (실측 logs.txt 분석 반영)
# 1. 강한 손목 스냅(Violent Shaking) 시 평면 가속도 피크 15.0 m/s^2 (약 1.5g~2.0g) 이상 급증
POURING_ACC_XY_MIN = 15.0

# 2. 동적 타격 동작 중 Z축 가속도 동요 수용 범위 (90도 부근 요동 수용)
POURING_ACC_Z_MAX = 3.0

# 3. 짧고 강한 스냅 타격 피크 지속 시간 (50Hz 기준 10 샘플 = 0.2초)
INTAKE_SUSTAINED_SAMPLES = 10

# 미세 진동 노이즈 오탐 방지를 위한 이동(Moving) 가속도 임계값 (g 단위)
MOVE_ACCEL_THRESHOLD = 0.15

# 미세 일상 회전 억제를 위한 자이로 분산 임계값 ((rad/s)^2 단위)
MOVE_GYRO_VAR = 0.60

# 약통 4단계 상태 정의
# idle: 보관 중 (0도)
# moving: 집어 들거나 이동 중 (45도 등)
# pouring: 손바닥에 알약 털어넣기/Shaking 중 (기울임 & 강한 스냅)
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


def raw_lsb_to_physical(
    acc_x_lsb: float,
    acc_y_lsb: float,
    acc_z_lsb: float,
    acc_lsb_per_g: float = 16384.0,
) -> tuple[float, float, float]:
    """
    아두이노 센서 Raw LSB 데이터를 물리 단위(m/s^2)로 변환한다.
    (기본 스케일: ±2g 기준 1g = 16384 LSB, 1g = 9.81 m/s^2)
    """
    ax_g = acc_x_lsb / acc_lsb_per_g
    ay_g = acc_y_lsb / acc_lsb_per_g
    az_g = acc_z_lsb / acc_lsb_per_g
    return ax_g * 9.81, ay_g * 9.81, az_g * 9.81


def detect_medication_intake(window: deque[SensorReading]) -> bool:
    """
    윈도우 내 샘플들이 영양제 복용 모션(손목 스냅 털어넣기 Shaking) 조건에 부합하는지 판별한다.

    조건:
    1. AccZ < POURING_ACC_Z_MAX (3.0 m/s^2 이하 - 90도~110도 요동 수용)
    2. sqrt(AccX^2 + AccY^2) > POURING_ACC_XY_MIN (15.0 m/s^2 이상 - 강한 스냅 피크)
    3. 최근 INTAKE_SUSTAINED_SAMPLES (10샘플 = 0.2초) 중 80% 이상(8개 이상) 조건 충족 시 인정 (스파이크 노이즈 강건성)
    """
    if len(window) < INTAKE_SUSTAINED_SAMPLES:
        return False

    recent_samples = list(window)[-INTAKE_SUSTAINED_SAMPLES:]

    # 10개 샘플 중 조건 충족 샘플 수 카운트
    valid_count = sum(
        1 for r in recent_samples
        if r.acc_z < POURING_ACC_Z_MAX and math.sqrt(r.acc_x**2 + r.acc_y**2) > POURING_ACC_XY_MIN
    )

    # 80% 이상 (10개 중 8개 이상) 충족 시 순간 스파이크 노이즈가 튀어도 복용 성공으로 판정
    return (valid_count / INTAKE_SUSTAINED_SAMPLES) >= 0.80


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
