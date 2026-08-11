// ─── WebSocket 이벤트 타입 ───────────────────────────────────────────────────

export type SensorEventType =
  | 'medication_taken'
  | 'bottle_state_changed'
  | 'tumbler_state_changed'
  | 'equipment_detected';

export type WebSocketMessage<T = unknown> = {
  type: SensorEventType;
  payload: T;
  timestamp: string; // ISO 8601
};

// ─── 약통 및 복용 이력 타입 ─────────────────────────────────────────────────────

export type Bottle = {
  bottle_id: string;
  name: string;
  target_time: string;
  created_at?: string;
};

export type MedicationLog = {
  id: string;
  bottle_id: string;
  event_type: string;
  taken_at: string;
  status: string;
};

export type MedicationTakenPayload = {
  bottle_id: string;
  taken_at: string;
  status: string;
  state_deg?: number;
};

export type BottleState = 'idle' | 'moving' | 'pouring' | 'settled';

export type BottleStatePayload = {
  state: BottleState;
  transitioned_at?: string;
};

export type AdherenceStats = {
  total_logs: number;
  adherence_rate: number;
  streak_days: number;
  bottle_stats: Record<string, number>;
};

// ─── WebSocket 훅 반환 타입 ───────────────────────────────────────────────────

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type WebSocketEvent =
  | { type: 'medication_taken'; payload: MedicationTakenPayload }
  | { type: 'bottle_state_changed'; payload: BottleStatePayload }
  | { type: 'tumbler_state_changed'; payload: { state: string } }
  | { type: 'equipment_detected'; payload: { equipmentName: string } };

export type UseWebSocketReturn = {
  status: WebSocketStatus;
  lastEvent: WebSocketEvent | null;
  send: (data: unknown) => void;
};
