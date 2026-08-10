import time
import threading

import streamlit as st

from imu_simulator import BOTTLE_PRESETS, generate_imu
from shared_state import params as _params  # 모듈 캐시로 단일 인스턴스 보장
from ws_emitter import start_stream

st.set_page_config(page_title="Med Tracker Sensor Simulator", layout="wide")

# ── 세션 상태 초기화 ──────────────────────────────────────────────────────────

if "selected_bottle" not in st.session_state:
    st.session_state.selected_bottle = "BOTTLE_01"

if "bottle_state" not in st.session_state:
    st.session_state.bottle_state = "보관 중 (0도)"

if "tilt_angle" not in st.session_state:
    st.session_state.tilt_angle = 0

if "noise_level" not in st.session_state:
    st.session_state.noise_level = 0.1

if "trigger_impulse" not in st.session_state:
    st.session_state.trigger_impulse = False

if "streaming" not in st.session_state:
    st.session_state.streaming = False

if "stop_event" not in st.session_state:
    st.session_state.stop_event = None

# ── 매 리런마다 _params 동기화 ──────────────────────────────────────────────────
_params["bottle_state"]    = st.session_state.bottle_state
_params["selected_bottle"] = st.session_state.selected_bottle
_params["tilt_angle"]      = st.session_state.tilt_angle
_params["noise_level"]     = st.session_state.noise_level
_params["trigger_impulse"] = st.session_state.trigger_impulse

# ── 스트림 종료 감지 ──────────────────────────────────────────────────────────
if st.session_state.streaming and st.session_state.stop_event is not None:
    if st.session_state.stop_event.is_set():
        st.session_state.streaming = False
        st.session_state.stop_event = None

# ── 헤더 ─────────────────────────────────────────────────────────────────────
st.title("Hands-Free Med & Supple Tracker — Sensor Simulator")
st.caption("실측 데이터 기반 3축 자이로·가속도(IMU) 센서 및 복용 모션을 시뮬레이션합니다.")
st.divider()

col_control, col_status = st.columns([1, 1], gap="large")

# ── 좌측: 컨트롤 패널 ────────────────────────────────────────────────────────
with col_control:
    st.subheader("컨트롤 패널")

    bottle_options = list(BOTTLE_PRESETS.keys())
    st.session_state.selected_bottle = st.selectbox(
        label="약통 선택 (Device ID / Bottle ID)",
        options=bottle_options,
        index=bottle_options.index(st.session_state.selected_bottle),
        format_func=lambda b: BOTTLE_PRESETS.get(b, b),
        help="시뮬레이션할 약통(Device ID)을 선택하세요.",
    )

    st.write("")
    st.write("**용기 기울임 및 복용 동작 선택**")
    b_col1, b_col2, b_col3 = st.columns(3)

    with b_col1:
        if st.button("0° 보관 중", use_container_width=True, type="primary" if st.session_state.tilt_angle == 0 else "secondary"):
            st.session_state.tilt_angle = 0
            st.session_state.bottle_state = "보관 중 (0도)"
            st.rerun()

    with b_col2:
        if st.button("45° 집어 들기", use_container_width=True, type="primary" if st.session_state.tilt_angle == 45 else "secondary"):
            st.session_state.tilt_angle = 45
            st.session_state.bottle_state = "손바닥으로 기울임 (45도)"
            st.rerun()

    with b_col3:
        if st.button("110° 알약 털기", use_container_width=True, type="primary" if st.session_state.tilt_angle == 110 else "secondary"):
            st.session_state.tilt_angle = 110
            st.session_state.bottle_state = "알약 털어넣기 (110도)"
            st.rerun()

    st.write("")
    btn_col1, btn_col2 = st.columns(2)
    with btn_col1:
        if st.button("툭툭 털기 충격 발생", use_container_width=True):
            st.session_state.trigger_impulse = True
            st.toast("툭툭 털기 임펄스 노이즈가 주입되었습니다.")
            st.rerun()

    with btn_col2:
        if st.button("5초 자동 복용 시나리오 실행", use_container_width=True, type="primary"):
            st.info("5초 복용 시나리오를 진행합니다...")
            # 시나리오 수행
            st.session_state.tilt_angle = 0
            st.session_state.bottle_state = "1. 보관 중 (0도)"
            time.sleep(0.6)
            st.session_state.tilt_angle = 45
            st.session_state.bottle_state = "2. 용기 집어 들기 (45도)"
            time.sleep(0.8)
            st.session_state.tilt_angle = 110
            st.session_state.bottle_state = "3. 알약 털어넣기 (110도)"
            time.sleep(1.2)
            st.session_state.trigger_impulse = True
            time.sleep(0.8)
            st.session_state.tilt_angle = 45
            st.session_state.bottle_state = "4. 통 세우는 중 (45도)"
            time.sleep(0.8)
            st.session_state.tilt_angle = 0
            st.session_state.bottle_state = "5. 책상에 놓기 (0도)"
            st.rerun()

    st.write("")
    st.session_state.noise_level = st.slider(
        label="노이즈 레벨",
        min_value=0.0,
        max_value=1.0,
        value=st.session_state.noise_level,
        step=0.05,
        format="%.2f",
        help="0.0 = 노이즈 없음 / 1.0 = 최대 노이즈",
    )

    st.write("")
    # ── WebSocket 전송 제어 ───────────────────────────────────────────────────
    st.write("**WebSocket 전송**")

    if not st.session_state.streaming:
        if st.button("전송 시작", use_container_width=True, type="primary"):
            stop_event = threading.Event()

            def get_reading() -> dict:
                impulse = _params.get("trigger_impulse", False)
                _params["trigger_impulse"] = False  # 1회성 소모
                imu = generate_imu(
                    _params["bottle_state"],
                    _params["tilt_angle"],
                    _params["noise_level"],
                    impulse,
                )
                return {
                    "bottle_id": _params["selected_bottle"],
                    **imu,
                }

            start_stream(
                user_id="user-1",
                get_reading=get_reading,
                stop_event=stop_event,
            )
            st.session_state.stop_event = stop_event
            st.session_state.streaming = True
            st.rerun()
    else:
        if st.button("전송 중지", use_container_width=True, type="secondary"):
            if st.session_state.stop_event is not None:
                st.session_state.stop_event.set()
            st.session_state.streaming = False
            st.session_state.stop_event = None
            st.rerun()

# ── 우측: 상태 및 실시간 데이터 ───────────────────────────────────────────────
with col_status:
    st.subheader("현재 파라미터 및 Raw Data")

    st.metric(
        label="선택 약통",
        value=st.session_state.selected_bottle,
        delta=BOTTLE_PRESETS.get(st.session_state.selected_bottle, ""),
    )

    if st.session_state.tilt_angle == 110:
        st.error(f"알약 털어넣기 중 (110°) — Z축 < 0m/s² 감지 중")
    elif st.session_state.tilt_angle == 45:
        st.warning(f"용기 기울이기 중 (45°)")
    else:
        st.success(f"보관 중 / 정지 상태 (0°)")

    st.divider()

    # 현재 생성 센서값 및 시리얼 로그 샘플링
    sample_imu = generate_imu(
        st.session_state.bottle_state,
        st.session_state.tilt_angle,
        st.session_state.noise_level,
        st.session_state.trigger_impulse,
    )
    if st.session_state.trigger_impulse:
        st.session_state.trigger_impulse = False

    st.write("**아두이노 시리얼 모니터 / 플로터 출력 포맷 (Raw Logs)**")
    serial_str = f"AccX:{sample_imu['acc_x']:.2f},AccY:{sample_imu['acc_y']:.2f},AccZ:{sample_imu['acc_z']:.2f},State:{sample_imu['state_deg']}"
    st.code(serial_str, language="text")

    st.write("**WebSocket 송신 JSON 패킷**")
    packet = {
        "bottle_id": st.session_state.selected_bottle,
        **sample_imu,
    }
    st.json(packet)
