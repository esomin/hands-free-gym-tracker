# 백그라운드 WebSocket 스레드와 Streamlit 메인 스레드가 공유하는 파라미터.
#
# Python 모듈은 최초 import 후 캐시되므로, 이 파일의 params 딕셔너리는
# Streamlit rerun이 반복되어도 항상 동일한 객체를 가리킨다.
# → 메인 스레드에서 params를 in-place 업데이트하면 백그라운드 스레드에 즉시 반영됨.
params: dict = {
    "tumbler_state":      "이동 중",
    "selected_equipment": "레그프레스",
    "noise_level":        0.1,
}
