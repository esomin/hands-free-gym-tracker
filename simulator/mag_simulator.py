from __future__ import annotations

import random

# 기구별 지자기 지문 벡터 (μT) — mag_fingerprint_dev.ipynb 와 동일한 값
# 백엔드 FingerprintStore 에 등록하려면 같은 벡터를 사용해야 매칭됨
EQUIPMENT_FINGERPRINTS: dict[str, tuple[float, float, float]] = {
    "레그프레스":    ( 30.5, -15.2,  45.1),
    "랫풀다운":      (-10.0,  38.0,  20.0),
    "스미스머신":    (-12.0,  42.0,  18.0),
    "펙덱플라이":    (  5.1, -38.6,  60.3),
    "레그컬":        (-40.0,  25.0,  10.5),
    "레그익스텐션":  (-38.0,  28.0,   8.0),
}

# 노이즈 레벨 1.0 기준 최대 표준편차 (μT)
_MAX_NOISE_STD = 8.0


def generate_mag(equipment_name: str, noise_level: float) -> dict[str, float]:
    """
    선택한 기구의 지자기 지문 벡터에 노이즈를 더해 반환한다.

    equipment_name : EQUIPMENT_FINGERPRINTS 의 키 중 하나
    noise_level    : 0.0 ~ 1.0
    """
    base = EQUIPMENT_FINGERPRINTS.get(equipment_name, (0.0, 0.0, 0.0))
    std  = _MAX_NOISE_STD * noise_level

    return {
        "mag_x": round(base[0] + random.gauss(0, std or 0.1), 3),
        "mag_y": round(base[1] + random.gauss(0, std or 0.1), 3),
        "mag_z": round(base[2] + random.gauss(0, std or 0.1), 3),
    }
