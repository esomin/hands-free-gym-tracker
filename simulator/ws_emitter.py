from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from typing import Callable

WS_URL_TEMPLATE = "ws://localhost:8000/ws/{user_id}"
SEND_INTERVAL   = 1 / 50  # 50 Hz


async def _stream(
    url: str,
    get_reading: Callable[[], dict],
    stop_event: threading.Event,
) -> None:
    """WebSocket에 연결하여 stop_event가 설정될 때까지 50Hz로 데이터를 전송한다."""
    import websockets

    try:
        async with websockets.connect(url) as ws:
            while not stop_event.is_set():
                reading = get_reading()
                reading["timestamp"] = datetime.now(timezone.utc).isoformat()
                await ws.send(json.dumps(reading))
                await asyncio.sleep(SEND_INTERVAL)
    except Exception as e:
        # 연결 실패 또는 전송 오류 시 스트림 종료
        print(f"[ws_emitter] 오류: {e}")
    finally:
        stop_event.set()


def start_stream(
    user_id: str,
    get_reading: Callable[[], dict],
    stop_event: threading.Event,
) -> threading.Thread:
    """
    백그라운드 스레드에서 WebSocket 스트림을 시작한다.

    get_reading : 매 전송마다 호출되는 함수 — 현재 파라미터를 반영한 센서값 반환
    stop_event  : set() 호출 시 스트림 종료
    """
    def run() -> None:
        asyncio.run(_stream(WS_URL_TEMPLATE.format(user_id=user_id), get_reading, stop_event))

    thread = threading.Thread(target=run, daemon=True)
    thread.start()
    return thread
