import { createContext, useContext } from 'react';

import { useWebSocket } from '../hooks/useWebSocket';
import type { UseWebSocketReturn } from '../types';

const WS_URL = 'ws://localhost:8000/ws/user-1';

const WebSocketContext = createContext<UseWebSocketReturn | null>(null);

export function WebSocketProvider({ children }: { children: React.ReactNode }) {
  const ws = useWebSocket(WS_URL);
  return (
    <WebSocketContext.Provider value={ws}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext(): UseWebSocketReturn {
  const ctx = useContext(WebSocketContext);
  if (!ctx) throw new Error('WebSocketProvider 안에서만 사용할 수 있습니다.');
  return ctx;
}
