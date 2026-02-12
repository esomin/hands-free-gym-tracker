from __future__ import annotations

import json
import uuid
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from pipeline.imu_state import SensorReading, detect_tumbler_state, make_state_event
from pipeline.mag_fingerprint import (
    MIN_SETTLE_SAMPLES,
    make_equipment_detected_event,
    make_equipment_unknown_event,
    match_from_samples,
)
from pipeline.noise_filter import filter_sensor
from state.session_cache import session_cache


# ── 연결 관리 ─────────────────────────────────────────────────────────────────

class ConnectionManager:
    """
    user_id 별 활성 WebSocket 연결 목록을 관리한다.

    시뮬레이터(센서 데이터 송신)와 프론트엔드(이벤트 수신)가
    동일한 엔드포인트(/ws/{user_id})에 연결한다.
    백엔드는 수신한 센서 데이터를 처리한 뒤 상태 변화 이벤트를
    해당 user_id 의 모든 연결에 브로드캐스트한다.
    """

    def __init__(self) -> None:
        # user_id → 활성 WebSocket 연결 목록
        self._connections: dict[str, list[WebSocket]] = defaultdict(list)

    async def connect(self, user_id: str, ws: WebSocket) -> None:
        """핸드셰이크를 완료하고 연결 목록에 등록한다."""
        await ws.accept()
        self._connections[user_id].append(ws)

    def disconnect(self, user_id: str, ws: WebSocket) -> None:
        """
        연결 목록에서 제거한다.
        해당 user_id 의 연결이 모두 사라지면 세션 캐시도 정리한다.
        """
        conns = self._connections.get(user_id, [])
        if ws in conns:
            conns.remove(ws)
        if not conns:
            self._connections.pop(user_id, None)
            session_cache.remove(user_id)

    async def broadcast(self, user_id: str, message: dict) -> None:
        """
        user_id 의 모든 연결에 JSON 메시지를 전송한다.
        전송 실패한 연결은 자동으로 제거한다.
        """
        conns = self._connections.get(user_id, [])
        dead: list[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    def connection_count(self, user_id: str) -> int:
        return len(self._connections.get(user_id, []))


manager = ConnectionManager()


# ── WebSocket 엔드포인트 핸들러 ──────────────────────────────────────────────

async def handle_sensor_stream(ws: WebSocket, user_id: str) -> None:
    """
    /ws/{user_id} 엔드포인트 처리 함수.

    수신 메시지 형식 (시뮬레이터 → 백엔드):
    {
        "accel_magnitude": 1.05,
        "gyro_magnitude":  0.02,
        "mag_x": 30.5,   "mag_y": -15.2,   "mag_z": 45.1,  (생략 시 0.0)
        "timestamp": "..."                                    (생략 시 서버 현재 시각)
    }

    파이프라인 순서:
        noise_filter → imu_state → (settled 전이 시) mag_fingerprint
    """
    await manager.connect(user_id, ws)
    session = session_cache.get_or_create(user_id)
    _diag_count = 0  # 진단 로그용 샘플 카운터

    try:
        while True:
            raw = await ws.receive_text()

            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if 'accel_magnitude' not in data or 'gyro_magnitude' not in data:
                continue

            # timestamp 파싱
            ts_raw = data.get('timestamp')
            if ts_raw:
                try:
                    ts = datetime.fromisoformat(ts_raw)
                except ValueError:
                    ts = datetime.now(timezone.utc)
            else:
                ts = datetime.now(timezone.utc)

            # ── 1. 노이즈 필터 ────────────────────────────────────────────────
            f_accel, f_gyro, f_mag_x, f_mag_y, f_mag_z = filter_sensor(
                session.ema_state,
                float(data['accel_magnitude']),
                float(data['gyro_magnitude']),
                float(data.get('mag_x', 0.0)),
                float(data.get('mag_y', 0.0)),
                float(data.get('mag_z', 0.0)),
            )

            # ── 2. 슬라이딩 윈도우 갱신 ──────────────────────────────────────
            session.recent_sensor_window.append(
                SensorReading(accel_magnitude=f_accel, gyro_magnitude=f_gyro, timestamp=ts)
            )
            session.recent_mag_window.append((f_mag_x, f_mag_y, f_mag_z))
            session_cache.touch(user_id)

            # ── 3. IMU 텀블러 상태 판별 ───────────────────────────────────────
            prev_state = session.tumbler_state
            new_state = detect_tumbler_state(session.recent_sensor_window)
            session.tumbler_state = new_state

            if new_state != prev_state:
                print(f'[handler] {user_id} 상태 전이: {prev_state} → {new_state} '
                      f'(window={len(session.recent_sensor_window)}, '
                      f'accel={f_accel:.3f}, gyro={f_gyro:.3f})')

            # ── 진단: 50샘플(약 1초)마다 감지값 출력 ─────────────────────────
            _diag_count += 1
            if _diag_count % 50 == 0:
                w = list(session.recent_sensor_window)
                if w:
                    _accel_dev = sum(abs(r.accel_magnitude - 1.0) for r in w) / len(w)
                    _gyro_vals = [r.gyro_magnitude for r in w]
                    _gyro_mean = sum(_gyro_vals) / len(_gyro_vals)
                    _gyro_var  = sum((v - _gyro_mean) ** 2 for v in _gyro_vals) / len(_gyro_vals)
                    print(f'[diag] {user_id} window={len(w)} state={session.tumbler_state} '
                          f'accel_dev={_accel_dev:.4f}(th=0.04) gyro_var={_gyro_var:.4f}(th=0.40)')

            state_event = make_state_event(new_state, prev_state, timestamp=ts)
            if state_event:
                print(f'[handler] 브로드캐스트: {state_event["type"]} → {state_event["payload"]}')
                await manager.broadcast(user_id, state_event)

            # ── 4. 지자기 지문 매칭 (이동→거치됨 전이 시에만) ────────────────
            if new_state == 'settled' and prev_state == 'moving':
                mag_samples = list(session.recent_mag_window)
                print(f'[handler] mag_fingerprint 시도: mag_samples={len(mag_samples)} '
                      f'(필요: {MIN_SETTLE_SAMPLES})')
                if len(mag_samples) >= MIN_SETTLE_SAMPLES:
                    matched, avg_vec = match_from_samples(mag_samples)
                    if matched:
                        session.current_equipment_id = matched.equipment_id
                        equipment_event = make_equipment_detected_event(
                            matched,
                            confidence=1.0,
                            timestamp=ts,
                        )
                    else:
                        session.current_equipment_id = None
                        equipment_event = make_equipment_unknown_event(
                            raw_fingerprint_id=str(uuid.uuid4()),
                            timestamp=ts,
                        )
                    print(f'[handler] 브로드캐스트: {equipment_event["type"]}')
                    await manager.broadcast(user_id, equipment_event)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, ws)
