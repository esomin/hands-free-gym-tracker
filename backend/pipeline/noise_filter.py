from __future__ import annotations

# EMA 평활화 계수 (notebooks/noise_filter_dev.ipynb 그리드 탐색으로 확정)
# accel 최적 0.65 / mag 최적 0.95 — accel(imu_state 주 신호) 기준으로 0.65 채택
# mag는 MIN_SETTLE_SAMPLES 평균으로 노이즈를 별도 억제하므로 0.65로 충분
ALPHA = 0.65


def _apply_ema(state: dict[str, float], key: str, value: float) -> float:
    """단일 채널 EMA. state[key]가 없으면 현재 값으로 초기화한다."""
    if key not in state:
        state[key] = value
        return value
    smoothed = ALPHA * value + (1 - ALPHA) * state[key]
    state[key] = smoothed
    return smoothed


def filter_sensor(
    ema_state: dict[str, float],
    accel_magnitude: float,
    gyro_magnitude: float,
    mag_x: float,
    mag_y: float,
    mag_z: float,
) -> tuple[float, float, float, float, float]:
    """
    센서 5채널(accel_mag, gyro_mag, mag_x, mag_y, mag_z)에 EMA를 적용한다.
    ema_state는 세션 단위로 유지되는 가변 딕셔너리이며, 함수 내부에서 갱신된다.
    반환 순서: (accel_magnitude, gyro_magnitude, mag_x, mag_y, mag_z)
    """
    return (
        _apply_ema(ema_state, 'accel_magnitude', accel_magnitude),
        _apply_ema(ema_state, 'gyro_magnitude', gyro_magnitude),
        _apply_ema(ema_state, 'mag_x', mag_x),
        _apply_ema(ema_state, 'mag_y', mag_y),
        _apply_ema(ema_state, 'mag_z', mag_z),
    )
