from __future__ import annotations

import random
import math

# 이동 중 기본 accel 진폭 및 gyro 평균 (noise_level=1.0 기준)
_MOVING_ACCEL_AMP  = 0.35   # g — 중력 기준 편차 진폭
_MOVING_GYRO_MEAN  = 0.8    # rad/s
_MOVING_GYRO_STD   = 0.4

# 거치됨 노이즈 (센서 자체 미세 노이즈)
_SETTLED_ACCEL_STD = 0.015  # g
_SETTLED_GYRO_STD  = 0.003  # rad/s


def generate_imu(tumbler_state: str, noise_level: float) -> dict[str, float]:
    """
    텀블러 상태와 노이즈 레벨에 맞는 accel_magnitude, gyro_magnitude를 생성한다.

    tumbler_state : "이동 중" | "거치됨"
    noise_level   : 0.0(노이즈 없음) ~ 1.0(최대 노이즈)
    """
    noise = max(noise_level, 0.05)  # 최소 기본 노이즈 유지

    if tumbler_state == "이동 중":
        # 이동 중: 1.0g 기준으로 진폭이 큰 편차 + 활성 자이로
        accel = 1.0 + random.gauss(0, _MOVING_ACCEL_AMP * noise)
        gyro  = abs(random.gauss(_MOVING_GYRO_MEAN * noise, _MOVING_GYRO_STD * noise))
    else:
        # 거치됨: 중력만 측정(~1.0g), 자이로 ≈ 0
        accel = 1.0 + random.gauss(0, _SETTLED_ACCEL_STD)
        gyro  = abs(random.gauss(0, _SETTLED_GYRO_STD))

    return {
        "accel_magnitude": round(accel, 4),
        "gyro_magnitude":  round(gyro, 4),
    }
