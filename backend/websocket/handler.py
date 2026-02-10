from __future__ import annotations

import json
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from pipeline.imu_state import SensorReading, detect_tumbler_state, make_state_event
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
                # 전송 실패 = 이미 끊어진 연결
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    def connection_count(self, user_id: str) -> int:
        return len(self._connections.get(user_id, []))


# 모듈 레벨 싱글턴 — main.py 에서 임포트하여 엔드포인트에 연결
manager = ConnectionManager()


# ── WebSocket 엔드포인트 핸들러 ──────────────────────────────────────────────

async def handle_sensor_stream(ws: WebSocket, user_id: str) -> None:
    """
    /ws/{user_id} 엔드포인트 처리 함수.

    수신 메시지 형식 (시뮬레이터 → 백엔드):
    {
        "accel_magnitude": 1.05,   # float, g 단위
        "gyro_magnitude":  0.02,   # float, rad/s
        "timestamp":       "..."   # ISO 8601, 생략 가능
    }

    브로드캐스트 형식 (백엔드 → 프론트엔드, 상태 전이 시에만):
    {
        "type":    "tumbler_state_changed",
        "payload": { "state": "settled", "transitioned_at": "..." },
        "timestamp": "..."
    }

    ※ 현재 단계에서는 imu_state 만 파이프라인에 연결한다.
      noise_filter, mag_fingerprint 는 이후 단계에서 추가된다.
    """
    await manager.connect(user_id, ws)
    session = session_cache.get_or_create(user_id)

    try:
        while True:
            # 시뮬레이터 또는 프론트엔드로부터 메시지 수신
            raw = await ws.receive_text()

            # 프론트엔드가 보내는 ping 등 비-센서 메시지는 무시
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue

            # 센서 데이터 메시지 여부 판별 (accel_magnitude 키 존재 확인)
            if 'accel_magnitude' not in data or 'gyro_magnitude' not in data:
                continue

            # timestamp 파싱 — 없으면 현재 시각 사용
            ts_raw = data.get('timestamp')
            if ts_raw:
                try:
                    ts = datetime.fromisoformat(ts_raw)
                except ValueError:
                    ts = datetime.now(timezone.utc)
            else:
                ts = datetime.now(timezone.utc)

            # SensorReading 생성 후 슬라이딩 윈도우에 추가
            reading = SensorReading(
                accel_magnitude=float(data['accel_magnitude']),
                gyro_magnitude=float(data['gyro_magnitude']),
                timestamp=ts,
            )
            session.recent_sensor_window.append(reading)
            session_cache.touch(user_id)

            # imu_state 파이프라인: 텀블러 상태 판별
            prev_state = session.tumbler_state
            new_state = detect_tumbler_state(session.recent_sensor_window)
            session.tumbler_state = new_state

            # 상태 전이가 발생한 경우에만 브로드캐스트
            event = make_state_event(new_state, prev_state, timestamp=ts)
            if event:
                await manager.broadcast(user_id, event)

    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(user_id, ws)
