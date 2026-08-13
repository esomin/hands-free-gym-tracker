# IMU 센서 임계값 및 약통 제스처 상태 정의서 (Med Tracker)

`backend/pipeline/imu_state.py`의 약통(Pill Bottle) 제스처 상태 판별 알고리즘 및 상수(`WINDOW_SIZE`, `POURING_ACC_Z_MAX`, `POURING_ACC_XY_MIN`, `INTAKE_SUSTAINED_SAMPLES`, `MOVE_ACCEL_THRESHOLD`, `MOVE_GYRO_VAR`) 설정 근거를 기록합니다.

---

## 1. 약통 4단계 상태 정의 (BottleState)

짐트래커(텀블러/운동기구)에서 메드트래커(약통 복용 추적)로 설계가 변경됨에 따라 4단계 상태로 정의됩니다.

| 상태 (`BottleState`) | 설명 | 6축 센서 특징 및 물리적 상태 |
| :--- | :--- | :--- |
| **`idle`** | 보관 중 | 평면에 바로 세워 거치된 정지 상태 (기울기 0도, 가속도 중력 $1.0\,\text{g}$ 수렴) |
| **`moving`** | 집어 들거나 이동 중 | 약통을 파지하여 들고 있거나 이동 중인 상태 (약 45도 기울기 및 이동 충격) |
| **`pouring`** | 알약 털어넣기 (복용 중) | 손바닥에 알약을 털어넣기 위해 약통을 110도 이상 거꾸로 기울인 상태 |
| **`settled`** | 거치 완료 | 복용 후 약통을 다시 제자리에 세워 안정화된 상태 (기울기 0도 수렴) |

---

## 2. 약통 상태별 센서 물리 기준값

### 가속도 (accel_magnitude, 단위: g & m/s²)

약통이 거치대/바닥에 바로 세워져 정지해 있을 때는 지구 중력 가속도인 **1.0 g ($9.81\,\text{m/s}^2$)** 에 수렴하며, 털어넣는 동작(`pouring`) 시 $Z$축 중력 방향이 반전($Acc_Z < 0.0\,\text{m/s}^2$)됩니다.

| 상태 | accel_magnitude (g) | 중력 편차 \|accel − 1.0 g\| | 3축 가속도 특성 |
| :--- | :--- | :--- | :--- |
| **정지/거치 (`settled`/`idle`)** | 1.000 ± 0.015 g | ≈ 0.000 ~ 0.020 g | $Acc_Z \approx +9.81\,\text{m/s}^2, Acc_{XY} \approx 0.0$ |
| **이동 중 (`moving`)** | 1.0 ± 0.35 g | ≈ 0.200 ~ 0.350 g | 이동 진동 및 회전 가속도 발생 |
| **털어넣기 (`pouring`)** | 변동 큼 | - | $Acc_Z < 0.0\,\text{m/s}^2$, $\sqrt{Acc_X^2 + Acc_Y^2} > 7.0\,\text{m/s}^2$ |

### 자이로 (gyro_magnitude, 단위: rad/s)

정지 상태에서는 회전 각속도가 없으므로 **0 에 수렴**하며, 약통을 집어들거나 기울일 때 자이로 분산(Variance) 값이 크게 활성화됩니다.

| 상태 | gyro_magnitude | 슬라이딩 윈도우 분산 (`gyro_var`) |
| :--- | :--- | :--- |
| **정지/거치 (`settled`)** | ≈ 0.000 ~ 0.015 rad/s | ≈ 0.00002 (rad/s)² |
| **이동 중 (`moving`)** | ≈ 0.6 ~ 2.4 rad/s | ≈ 0.356 (rad/s)² |

---

## 3. 알고리즘 상수 및 임계값 설정 근거

### `WINDOW_SIZE = 100` (샘플 수)
* 50 Hz 샘플레이트 기준 **2.0 초** 슬라이딩 윈도우를 유지합니다.
* 복용 지속 조건(`INTAKE_SUSTAINED_SAMPLES`) 검증을 위해 넉넉한 히스토리를 제공하며 단발성 튀는 노이즈를 억제합니다.

### `POURING_ACC_Z_MAX = 0.0 m/s²` & `POURING_ACC_XY_MIN = 7.0 m/s²`
* 약통을 110도 이상 뒤집어 알약을 손바닥에 털어넣는 동작의 핵심 기하학적 임계값입니다.
* 약통이 기울어지면 $Z$축 가속도 성분이 음수($< 0.0$)로 반전되고, 평면 가속도 성분 $\sqrt{Acc_X^2 + Acc_Y^2}$ 이 $7.0\,\text{m/s}^2$ 이상으로 상승합니다.

### `INTAKE_SUSTAINED_SAMPLES = 20` (샘플 수)
* 50 Hz 센서 기준 **최소 0.4초 ~ 0.6초** 동안 `pouring` 모션이 지속적으로 유지될 때만 유효한 복용(Intake) 행위로 인정합니다.
* 순간적으로 약통이 흔들리는 찰나의 거짓 긍정(False Positive) 오탐을 방지합니다.

### `MOVE_ACCEL_THRESHOLD = 0.04 g` & `MOVE_GYRO_VAR = 0.40 (rad/s)²`
* 약통을 들고 이동하는 `moving` 상태와 정지된 `settled` 상태를 분리하는 임계값입니다.
* `accel_dev_mean > 0.04 g` 조건이 이동 감지의 주력 역할을 담당하며, `gyro_var > 0.40` 은 극단적 빠른 회전 시 보조 안전장치로 작동합니다.

---

## 4. 판별 알고리즘 흐름 요약

```python
# 1. 알약 털어넣기 (pouring) 우선 판별
latest = window[-1]
if latest.acc_z < 0.0 and sqrt(latest.acc_x**2 + latest.acc_y**2) > 7.0:
    state = 'pouring'

# 2. 이동 중 (moving) 판별
elif accel_dev_mean > 0.04 or gyro_var > 0.40:
    state = 'moving'

# 3. 거치/정지 (settled)
else:
    state = 'settled'
```

---

## 5. 한계 및 추후 검증 계획

* 현재 임계값은 시뮬레이터 센서 파형 및 수집된 임베디드 오프라인 로그 데이터를 바탕으로 수립되었습니다.
* 다양한 사용자의 약통 파지 습관(기울임 각도, 털어넣는 속도)에 따른 필드 데이터 수집 후 `INTAKE_SUSTAINED_SAMPLES` 및 `POURING_ACC_XY_MIN` 임계값을 재튜닝할 예정입니다.
