# IMU 센서 임계값 및 노이즈 필터링 정의서 (Zero-Touch Pill Tracker)

`backend/pipeline/imu_state.py` 및 `backend/pipeline/noise_filter.py`의 약통(Pill Bottle) 제스처 상태 판별 알고리즘 및 실측 로그 주파수/SNR/반동 진동(Ringing) 분석 기반 최적 EMA/LPF 필터 계수(`ALPHA = 0.45`) 설정 근거를 기록합니다.

---

## 1. 아두이노 Raw LSB 데이터 단위 보정

아두이노 시리얼 로그의 원시 데이터(Raw LSB)는 센서 설정 스케일에 따라 물리 단위($\text{m/s}^2$ 및 $\text{g}$)로 환산되어 알고리즘에 입력됩니다.

* **가속도 센서 ($\pm 2\,\text{g}$ 스케일 기준)**: $1\,\text{g} \approx 16,384\,\text{LSB}$ ($\approx 9.81\,\text{m/s}^2$)
* **자이로스코프 ($\pm 250\,\text{dps}$ 스케일 기준)**: $1\,\text{rad/s} \approx 7,500\,\text{LSB}$

---

## 2. 실측 데이터 기반 LPF 계수 선정 (`ALPHA = 0.45`)

### A. 신호 대 잡음비 (SNR) 및 2샘플 추종 성능
* **정지/뚜껑 회전 노이즈 ($-284 \sim +1,037\,\text{LSB}$)**: 평시 미세 노이즈를 45% 수준으로 억제하여 `moving` 오탐 방지.
* **약 털기(Shaking) 압도적 피크 ($\text{Acc}_Y = -41,299\,\text{LSB}$)**: 평시 노이즈 대비 40배 이상의 SNR을 가지므로 $\alpha=0.45$ 적용 시 **단 2개 샘플($0.2$초) 만에 피크의 70% 이상($-28,800\,\text{LSB} \approx 17.5\,\text{m/s}^2$)을 지연 없이 즉시 추종**하여 복용 조건($15.0\,\text{m/s}^2$)을 압도적으로 만족함.

### B. 털기 직후 반동 진동 (Ringing) 및 잔상 제거
* $\alpha = 0.65$ 사용 시 털기 후 손에 남는 반동 잔진동이 필터를 그대로 통과하여 "약통을 세웠는데도 계속 moving으로 착각하는 잔상 현상" 발생.
* $\alpha = 0.45$ 적용 시 원시 데이터 신뢰도 45%를 적용하여 강한 털기 피크는 그대로 잡아내면서도, **털기 직후 잔진동을 부드럽게 흡수하여 거치 상태(`settled`)로의 복용 완료 판정이 안정적으로 진입**.

---

## 3. 2단계 노이즈 방어 체계 (Noise Immunity Strategy)

### ① 1차 방어: LPF/EMA 반동 억제 최적 계수 (`ALPHA = 0.45`)
* **[backend/pipeline/noise_filter.py](file:///Users/somui/workplace/handsfree-gym-tracker/backend/pipeline/noise_filter.py)**
* 2샘플 빠른 피크 추종과 털기 직후 반동 잔진동 흡수 밸런스 완벽 확보.

### ② 2차 방어: 복용 판별 80% 다수결 비율 (Majority Ratio $\ge 80\%$) 적용
* **[backend/pipeline/imu_state.py](file:///Users/somui/workplace/handsfree-gym-tracker/backend/pipeline/imu_state.py)**
* 10개 샘플(0.2초) 중 8개 이상 조건을 만족하면 순간 스파이크 튐 노이즈가 있어도 복용으로 안정적 확정.

---

## 4. 최종 확정 임계값 요약 표

| 임계값 상수 | 기존 설정값 | 실측 최종 선정값 | 적용 단위 | 튜닝 및 분석 근거 |
| :--- | :---: | :---: | :---: | :--- |
| **`ALPHA`** | `0.65` | **`0.45`** | 계수 | 2샘플($0.2\text{s}$) 70% 추종 & 털기 직후 반동 진동(Ringing) 흡수 |
| **`INTAKE_RATIO`** | `100%` (Strict) | **`80%`** ($\ge 8/10$) | 비율 | 1~2샘플 순간 충격 튐 노이즈 강건성 확보 |
| **`MOVE_ACCEL_THRESHOLD`** | `0.04` | **`0.15`** | $\text{g}$ | 미세 바닥 진동 노이즈 오탐 방지 |
| **`MOVE_GYRO_VAR`** | `0.40` | **`0.60`** | $(\text{rad/s})^2$ | 일상 손목 회전 안정성 확보 |
| **`POURING_ACC_XY_MIN`** | `7.0` | **`15.0`** | $\text{m/s}^2$ | 손목 스냅 털기(Violent Shaking) $2\,\text{g}$ 이상 강한 피크 감지 |
| **`POURING_ACC_Z_MAX`** | `0.0` | **`3.0`** | $\text{m/s}^2$ | 동적 털기 동작 중 90도 부근 $Z$축 동요 수용 |
| **`INTAKE_SUSTAINED_SAMPLES`** | `20` ($0.4\text{s}$) | **`10`** ($0.2\text{s}$) | 샘플 수 | 순간 스냅 타격 피크 검출 감도 향상 |
