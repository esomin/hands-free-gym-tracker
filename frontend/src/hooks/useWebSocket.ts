import { useCallback, useEffect, useRef, useState } from 'react';

import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { UseWebSocketReturn, WebSocketEvent, WebSocketStatus } from '../types';

// 재연결 지연 시간 (ms): 1s → 2s → 4s → 8s → ... → 최대 30s
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

function calcReconnectDelay(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
}

function parseEvent(raw: string): WebSocketEvent | null {
  try {
    const parsed = JSON.parse(raw) as WebSocketEvent;
    if (!parsed.type) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [status, setStatus] = useState<WebSocketStatus>('connecting');
  const [lastEvent, setLastEvent] = useState<WebSocketEvent | null>(null);

  // 현재 WebSocket 인스턴스 참조 (렌더링에 영향 없이 유지)
  const wsRef = useRef<WebSocket | null>(null);
  // 재연결 타이머 ID
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 현재 재연결 시도 횟수
  const retryCount = useRef(0);
  // 언마운트 여부 — 언마운트 후 재연결 방지
  const unmounted = useRef(false);

  const connect = useCallback(() => {
    if (unmounted.current) return;

    setStatus(retryCount.current === 0 ? 'connecting' : 'reconnecting');

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmounted.current) {
        ws.close();
        return;
      }
      retryCount.current = 0;
      setStatus('connected');
    };

    ws.onmessage = (event: MessageEvent) => {
      const parsed = parseEvent(event.data as string);
      if (parsed) {
        setLastEvent(parsed);
      } else {
        console.warn(ERROR_MESSAGES.websocket.invalidEvent, event.data);
      }
    };

    ws.onclose = () => {
      if (unmounted.current) return;
      setStatus('reconnecting');

      const delay = calcReconnectDelay(retryCount.current);
      retryCount.current += 1;

      timerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onerror 직후 onclose가 항상 호출되므로 여기서는 로그만 남김
      console.warn(ERROR_MESSAGES.websocket.connectionFailed);
    };
  }, [url]);

  useEffect(() => {
    unmounted.current = false;
    connect();

    return () => {
      unmounted.current = true;
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      wsRef.current?.close();
      setStatus('disconnected');
    };
  }, [connect]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, lastEvent, send };
}
