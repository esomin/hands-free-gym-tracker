import streamlit as st

# 페이지 기본 설정: 제목, 와이드 레이아웃
st.set_page_config(
    page_title="Gym Tracker Simulator",
    layout="wide",
)

# ── 세션 상태 초기화 ──────────────────────────────────────────────────────────
# 앱이 처음 실행될 때 session_state에 기본값을 등록한다

# 현재 선택된 기구 이름
if "selected_equipment" not in st.session_state:
    st.session_state.selected_equipment = "레그프레스"

# 텀블러 상태: "이동 중" or "거치됨"
# (운동 중/휴식 구분은 텀블러 센서로 불가 → 2단계만 관리)
if "tumbler_state" not in st.session_state:
    st.session_state.tumbler_state = "이동 중"

# 노이즈 레벨: 0.0(노이즈 없음) ~ 1.0(최대 노이즈)
if "noise_level" not in st.session_state:
    st.session_state.noise_level = 0.1

# WebSocket 전송 활성 여부
if "streaming" not in st.session_state:
    st.session_state.streaming = False

# ── 헤더 ─────────────────────────────────────────────────────────────────────
st.title("Hands-Free Gym Tracker — Sensor Simulator")
st.caption("텀블러 탑재 지자기·IMU 센서 데이터를 시뮬레이션합니다.")

# 구분선
st.divider()

# ── 레이아웃: 좌(컨트롤) / 우(상태 표시) ─────────────────────────────────────
col_control, col_status = st.columns([1, 1], gap="large")

# ── 좌측: 컨트롤 패널 ────────────────────────────────────────────────────────
with col_control:
    st.subheader("컨트롤 패널")

    # 기구 선택 드롭다운
    EQUIPMENT_LIST = [
        "레그프레스",
        "랫풀다운",
        "스미스머신",
        "펙덱플라이",
        "레그컬",
        "레그익스텐션",
    ]
    st.session_state.selected_equipment = st.selectbox(
        label="기구 선택",
        options=EQUIPMENT_LIST,
        index=EQUIPMENT_LIST.index(st.session_state.selected_equipment),
        help="시뮬레이션할 헬스장 기구를 선택하세요.",
    )

    st.write("")  # 간격

    # 텀블러 상태 토글
    # 주의: "운동 중"과 "휴식"은 텀블러가 정지 상태이므로 센서 값이 동일 → 구분 불가
    st.write("**텀블러 상태**")
    tumbler_col_a, tumbler_col_b = st.columns(2)

    with tumbler_col_a:
        # "이동 중" 버튼: 클릭 시 tumbler_state를 "이동 중"으로 설정
        if st.button(
            "🚶 이동 중",
            use_container_width=True,
            type="primary" if st.session_state.tumbler_state == "이동 중" else "secondary",
        ):
            st.session_state.tumbler_state = "이동 중"
            st.rerun()

    with tumbler_col_b:
        # "거치됨" 버튼: 클릭 시 tumbler_state를 "거치됨"으로 설정 (기구 점유 시작)
        if st.button(
            "📍 거치됨 (기구 점유 중)",
            use_container_width=True,
            type="primary" if st.session_state.tumbler_state == "거치됨" else "secondary",
        ):
            st.session_state.tumbler_state = "거치됨"
            st.rerun()

    st.write("")  # 간격

    # 노이즈 레벨 슬라이더
    st.session_state.noise_level = st.slider(
        label="노이즈 레벨",
        min_value=0.0,
        max_value=1.0,
        value=st.session_state.noise_level,
        step=0.05,
        format="%.2f",
        help="0.0 = 노이즈 없음 / 1.0 = 최대 노이즈",
    )

    st.write("")  # 간격

    # WebSocket 전송 버튼 (데이터 생성 모듈 연결 전까지 비활성)
    st.write("**WebSocket 전송**")
    st.info("데이터 생성·전송 기능은 추후 연결됩니다.", icon=None)
    st.button("▶ 전송 시작", disabled=True, use_container_width=True)

# ── 우측: 현재 세션 상태 표시 ─────────────────────────────────────────────────
with col_status:
    st.subheader("현재 파라미터")

    # 선택된 기구 표시
    st.metric(label="선택 기구", value=st.session_state.selected_equipment)

    # 텀블러 상태 표시: 상태에 따라 색상 구분
    if st.session_state.tumbler_state == "거치됨":
        st.success("📍 텀블러 상태: **거치됨 (기구 점유 중)**")
    else:
        st.warning("🚶 텀블러 상태: **이동 중**")

    # 노이즈 레벨 표시
    st.metric(
        label="노이즈 레벨",
        value=f"{st.session_state.noise_level:.2f}",
    )

    st.divider()

    # 세션 상태 전체 덤프 (개발 확인용)
    with st.expander("session_state 전체 보기 (디버그)"):
        st.json({
            "selected_equipment": st.session_state.selected_equipment,
            "tumbler_state": st.session_state.tumbler_state,
            "noise_level": st.session_state.noise_level,
            "streaming": st.session_state.streaming,
        })
