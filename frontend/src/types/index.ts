// ─── WebSocket 이벤트 타입 ───────────────────────────────────────────────────

export type SensorEventType =
  | 'equipment_detected'
  | 'tumbler_state_changed'
  | 'set_logged'
  | 'equipment_unknown';

export type WebSocketMessage<T = unknown> = {
  type: SensorEventType;
  payload: T;
  timestamp: string; // ISO 8601
};

// ─── 기구 식별 ────────────────────────────────────────────────────────────────

export type EquipmentDetectedPayload = {
  equipmentId: string;
  equipmentName: string;
  confidence: number; // 0.0 ~ 1.0
  detectedAt: string; // ISO 8601
};

export type UnknownEquipmentPayload = {
  rawFingerprintId: string;
  detectedAt: string;
};

// ─── 텀블러 상태 ──────────────────────────────────────────────────────────────

// 텀블러 거치 후 운동 중/휴식은 센서로 구분 불가 → 이동 중 / 거치됨 2단계만 판별
export type TumblerState = 'moving' | 'settled';

export type TumblerStatePayload = {
  state: TumblerState;
  transitionedAt: string; // ISO 8601
};

// ─── 운동 로그 ────────────────────────────────────────────────────────────────

export type SetLogPayload = {
  equipmentId: string;
  equipmentName: string;
  setNumber: number;
  weight: number;
  reps: number;
  loggedAt: string;
};

// ─── 대시보드 ─────────────────────────────────────────────────────────────────

export type DashboardSet = {
  setNumber: number;
  weight:    number;
  reps:      number;
};

export type DashboardLog = {
  id:            string;
  equipmentName: string;
  sets:          DashboardSet[];
  startedAt:     string;       // ISO 8601
  endedAt:       string | null;
};

// ─── 스마트 디폴트 ────────────────────────────────────────────────────────────

export type SmartDefaultData = {
  equipmentId: string;
  suggestedWeight: number;
  suggestedReps: number;
  suggestedSets: number;
  basedOnDate: string | null; // 과거 기록 없으면 null
};

// ─── WebSocket 훅 반환 타입 ───────────────────────────────────────────────────

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'reconnecting';

export type WebSocketEvent =
  | { type: 'equipment_detected'; payload: EquipmentDetectedPayload }
  | { type: 'tumbler_state_changed'; payload: TumblerStatePayload }
  | { type: 'set_logged'; payload: SetLogPayload }
  | { type: 'equipment_unknown'; payload: UnknownEquipmentPayload };

export type UseWebSocketReturn = {
  status: WebSocketStatus;
  lastEvent: WebSocketEvent | null;
  send: (data: unknown) => void;
};
