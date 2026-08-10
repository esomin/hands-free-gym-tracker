from __future__ import annotations

import random
import math

# 약통 정보 프리셋 메타데이터
BOTTLE_PRESETS: dict[str, str] = {
    "BOTTLE_01": "BOTTLE_01: 아침 유산균 (08:00)",
    "BOTTLE_02": "BOTTLE_02: 점심 비타민 B (12:30)",
    "BOTTLE_03": "BOTTLE_03: 취침 전 비염약 (22:30)",
}

# 실측 데이터 기저값 (m/s^2)
# 0도 보관 중 (IDLE)
_BASE_0_DEG = (0.10, -0.05, 9.81)

# 45도 용기 집어들기/기울임 중 (PICKUP)
_BASE_45_DEG = (6.45, 2.10, 6.20)

# 110도 손바닥에 알약 털어넣기 (POURING) - AccZ 가 음수로 전환
_BASE_110_DEG = (9.20, 1.80, -3.40)


def generate_imu(
    bottle_state: str,
    tilt_angle: int = 0,
    noise_level: float = 0.1,
    trigger_impulse: bool = False,
) -> dict[str, float]:
    """
    약통 상태, 기울기 각도(0, 45, 110), 노이즈 레벨에 기반하여
    3축 가속도(acc_x, acc_y, acc_z) 및 기울기 state_deg 데이터를 생성한다.
    """
    noise = max(noise_level, 0.02)  # 기본 노이즈 유지

    if tilt_angle >= 100 or "110" in bottle_state or "털어넣기" in bottle_state:
        base_x, base_y, base_z = _BASE_110_DEG
        state_deg = 110
    elif tilt_angle >= 30 or "45" in bottle_state or "기울임" in bottle_state or "집어" in bottle_state:
        base_x, base_y, base_z = _BASE_45_DEG
        state_deg = 45
    else:
        base_x, base_y, base_z = _BASE_0_DEG
        state_deg = 0

    acc_x = base_x + random.gauss(0, 0.3 * noise)
    acc_y = base_y + random.gauss(0, 0.3 * noise)
    acc_z = base_z + random.gauss(0, 0.3 * noise)

    # 툭툭 털 때 발생하는 순간 충격/노이즈 시뮬레이션
    if trigger_impulse or (state_deg == 110 and random.random() < 0.15 * noise):
        acc_y += random.choice([+3.20, -2.50])
        acc_x += random.choice([-1.50, +1.80])

    # 1D 크기 계산 (기존 호환성 유지)
    accel_magnitude = math.sqrt(acc_x**2 + acc_y**2 + acc_z**2) / 9.81
    gyro_magnitude = 0.8 * noise if state_deg != 0 else 0.003

    return {
        "acc_x": round(acc_x, 3),
        "acc_y": round(acc_y, 3),
        "acc_z": round(acc_z, 3),
        "state_deg": state_deg,
        "accel_magnitude": round(accel_magnitude, 4),
        "gyro_magnitude": round(gyro_magnitude, 4),
    }
