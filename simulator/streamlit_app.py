import threading

import streamlit as st

from imu_simulator import generate_imu
from mag_simulator import EQUIPMENT_FINGERPRINTS, generate_mag
from ws_emitter import start_stream

# 백그라운드 스레드와 공유하는 파라미터 딕셔너리
# st.session_state는 Streamlit 스레드 외부에서 접근 불가 → 일반 dict 사용
_params: dict = {
    "tumbler_state":      "이동 중",
    "selected_equipment": "레그프레스",
    "noise_level":        0.1,
}

st.set_page_config(page_title="Gym Tracker Simulator", layout="wide")

# ── 세션 상태 초기화 ──────────────────────────────────────────────────────────

if "selected_equipment" not in st.session_state:
    st.session_state.selected_equipment = "레그프레스"

if "tumbler_state" not in st.session_state:
    st.session_state.tumbler_state = "이동 중"

if "noise_level" not in st.session_state:
    st.session_state.noise_level = 0.1

if "streaming" not in st.session_state:
    st.session_state.streaming = False

if "stop_event" not in st.session_state:
    st.session_state.stop_event = None

# ── 매 리런마다 _params 동기화 (메인 스레드 → 백그라운드 스레드에 전달) ────────
_params["tumbler_state"]      = st.session_state.tumbler_state
_params["selected_equipment"] = st.session_state.selected_equipment
_params["noise_level"]        = st.session_state.noise_level

# ── 스트림 종료 감지 ──────────────────────────────────────────────────────────
# 백그라운드 스레드가 오류로 종료되었을 때 UI 상태를 동기화한다
if st.session_state.streaming and st.session_state.stop_event is not None:
    if st.session_state.stop_event.is_set():
        st.session_state.streaming = False
        st.session_state.stop_event = None

# ── 헤더 ─────────────────────────────────────────────────────────────────────
st.title("Hands-Free Gym Tracker — Sensor Simulator")
st.caption("텀블러 탑재 지자기·IMU 센서 데이터를 시뮬레이션합니다.")
st.divider()

col_control, col_status = st.columns([1, 1], gap="large")

# ── 좌측: 컨트롤 패널 ────────────────────────────────────────────────────────
with col_control:
    st.subheader("컨트롤 패널")

    st.session_state.selected_equipment = st.selectbox(
        label="기구 선택",
        options=list(EQUIPMENT_FINGERPRINTS.keys()),
        index=list(EQUIPMENT_FINGERPRINTS.keys()).index(st.session_state.selected_equipment),
        help="시뮬레이션할 헬스장 기구를 선택하세요.",
    )

    st.write("")

    st.write("**텀블러 상태**")
    tumbler_col_a, tumbler_col_b = st.columns(2)

    with tumbler_col_a:
        if st.button(
            "🚶 이동 중",
            use_container_width=True,
            type="primary" if st.session_state.tumbler_state == "이동 중" else "secondary",
        ):
            st.session_state.tumbler_state = "이동 중"
            st.rerun()

    with tumbler_col_b:
        if st.button(
            "📍 거치됨 (기구 점유 중)",
            use_container_width=True,
            type="primary" if st.session_state.tumbler_state == "거치됨" else "secondary",
        ):
            st.session_state.tumbler_state = "거치됨"
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
        if st.button("▶ 전송 시작", use_container_width=True, type="primary"):
            stop_event = threading.Event()

            def get_reading() -> dict:
                # st.session_state 대신 _params 사용 (스레드 안전)
                imu = generate_imu(_params["tumbler_state"], _params["noise_level"])
                mag = generate_mag(_params["selected_equipment"], _params["noise_level"])
                return {**imu, **mag}

            start_stream(
                user_id="user-1",
                get_reading=get_reading,
                stop_event=stop_event,
            )
            st.session_state.stop_event = stop_event
            st.session_state.streaming = True
            st.rerun()
    else:
        if st.button("⏹ 전송 중지", use_container_width=True, type="secondary"):
            if st.session_state.stop_event is not None:
                st.session_state.stop_event.set()
            st.session_state.streaming = False
            st.session_state.stop_event = None
            st.rerun()

# ── 우측: 상태 표시 ───────────────────────────────────────────────────────────
with col_status:
    st.subheader("현재 파라미터")

    st.metric(label="선택 기구", value=st.session_state.selected_equipment)

    if st.session_state.tumbler_state == "거치됨":
        st.success("📍 텀블러 상태: **거치됨 (기구 점유 중)**")
    else:
        st.warning("🚶 텀블러 상태: **이동 중**")

    st.metric(label="노이즈 레벨", value=f"{st.session_state.noise_level:.2f}")

    st.divider()

    # 전송 상태 표시
    if st.session_state.streaming:
        st.success("🟢 전송 중 — ws://localhost:8000/ws/user-1")

        # 현재 생성되는 센서값 미리보기
        imu = generate_imu(st.session_state.tumbler_state, st.session_state.noise_level)
        mag = generate_mag(st.session_state.selected_equipment, st.session_state.noise_level)
        st.json({**imu, **mag})
    else:
        st.info("⚪ 전송 대기 중")

    with st.expander("session_state 전체 보기 (디버그)"):
        st.json({
            "selected_equipment": st.session_state.selected_equipment,
            "tumbler_state":      st.session_state.tumbler_state,
            "noise_level":        st.session_state.noise_level,
            "streaming":          st.session_state.streaming,
        })
