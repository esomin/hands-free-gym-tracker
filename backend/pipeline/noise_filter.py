from __future__ import annotations

# EMA 평활화 계수
ALPHA = 0.65


def _apply_ema(state: dict[str, float], key: str, value: float) -> float:
    """단일 채널 EMA. state[key]가 없으면 현재 값으로 초기화한다."""
    if key not in state:
        state[key] = value
        return value
    smoothed = ALPHA * value + (1 - ALPHA) * state[key]
    state[key] = smoothed
    return smoothed


def filter_sensor_3axis(
    ema_state: dict[str, float],
    acc_x: float,
    acc_y: float,
    acc_z: float,
    accel_magnitude: float = 1.0,
    gyro_magnitude: float = 0.0,
) -> tuple[float, float, float, float, float]:
    """
    3축 가속도(acc_x, acc_y, acc_z) 및 1D 크기 센서 채널에 EMA를 적용한다.
    ema_state는 세션 단위로 유지되는 가변 딕셔너리이다.
    """
    return (
        _apply_ema(ema_state, 'acc_x', acc_x),
        _apply_ema(ema_state, 'acc_y', acc_y),
        _apply_ema(ema_state, 'acc_z', acc_z),
        _apply_ema(ema_state, 'accel_magnitude', accel_magnitude),
        _apply_ema(ema_state, 'gyro_magnitude', gyro_magnitude),
    )


def filter_sensor(
    ema_state: dict[str, float],
    accel_magnitude: float,
    gyro_magnitude: float,
    mag_x: float,
    mag_y: float,
    mag_z: float,
) -> tuple[float, float, float, float, float]:
    """기존 호환성 유지용 5채널 필터 함수"""
    return (
        _apply_ema(ema_state, 'accel_magnitude', accel_magnitude),
        _apply_ema(ema_state, 'gyro_magnitude', gyro_magnitude),
        _apply_ema(ema_state, 'mag_x', mag_x),
        _apply_ema(ema_state, 'mag_y', mag_y),
        _apply_ema(ema_state, 'mag_z', mag_z),
    )
