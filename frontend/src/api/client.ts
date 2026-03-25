import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { DashboardLog, EquipmentDetectedPayload, SmartDefaultData } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error(ERROR_MESSAGES.api.networkError);
  }
  if (res.status === 404) throw new Error(ERROR_MESSAGES.api.notFound);
  if (res.status >= 500) throw new Error(ERROR_MESSAGES.api.serverError);
  if (!res.ok) throw new Error(ERROR_MESSAGES.api.serverError);
  return res.json() as Promise<T>;
}

// ── 기구 API ──────────────────────────────────────────────────────────────────

type RegisterEquipmentResponse = {
  equipment_id: string;
  equipment_name: string;
  confidence: number;
};

export async function registerEquipment(
  userId: string,
  equipmentName: string,
): Promise<EquipmentDetectedPayload> {
  const data = await apiFetch<RegisterEquipmentResponse>('/api/equipment/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, equipment_name: equipmentName }),
  });
  return {
    equipmentId: data.equipment_id,
    equipmentName: data.equipment_name,
    confidence: data.confidence,
    detectedAt: new Date().toISOString(),
  };
}

// ── 로그 API ──────────────────────────────────────────────────────────────────

export async function createWorkoutLog(
  userId: string,
  equipmentId: string,
  equipmentName: string,
  sets: { weight: number; reps: number }[],
): Promise<string> {
  const data = await apiFetch<{ id: string }>('/api/logs/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user_id: userId,
      equipment_id: equipmentId,
      equipment_name: equipmentName,
      sets: sets.map((s, i) => ({ set_number: i + 1, weight: s.weight, reps: s.reps })),
    }),
  });
  return data.id;
}

export async function completeWorkoutLog(logId: string): Promise<void> {
  await apiFetch(`/api/logs/${logId}/complete`, { method: 'PATCH' });
}

export async function updateWorkoutLogSets(
  logId: string,
  sets: { weight: number; reps: number }[],
): Promise<void> {
  await apiFetch(`/api/logs/${logId}/sets`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sets: sets.map((s, i) => ({ set_number: i + 1, weight: s.weight, reps: s.reps })),
    }),
  });
}

// ── 세션 API ──────────────────────────────────────────────────────────────────

type SessionEquipment = {
  equipment_id: string;
  equipment_name: string;
  confidence: number;
};

type SessionInProgressLog = {
  log_id: string;
  sets: { set_number: number; weight: number; reps: number }[];
};

export type SessionSnapshot = {
  tumbler_state: 'moving' | 'settled';
  equipment: SessionEquipment | null;
  in_progress_log: SessionInProgressLog | null;
  is_demo_running: boolean;
};

export async function fetchSessionSnapshot(userId: string): Promise<SessionSnapshot> {
  return apiFetch<SessionSnapshot>(`/api/session/${userId}`);
}

export async function deleteInProgressLog(userId: string): Promise<void> {
  const params = new URLSearchParams({ user_id: userId });
  await apiFetch(`/api/logs/in-progress?${params}`, { method: 'DELETE' });
}


type LogSetResponse = {
  set_number: number;
  weight: number;
  reps: number;
};

type WorkoutLogResponse = {
  id: string;
  equipment_name: string;
  sets: LogSetResponse[];
  started_at: string;
  ended_at: string | null;
};

export async function fetchLogsByDate(userId: string, date: Date): Promise<DashboardLog[]> {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const params = new URLSearchParams({
    user_id: userId,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const logs = await apiFetch<WorkoutLogResponse[]>(`/api/logs/?${params}`);

  // 로그 단위 유지, started_at 오름차순 정렬
  return logs
    .map((log) => ({
      id: log.id,
      equipmentName: log.equipment_name,
      sets: log.sets.map((s) => ({
        setNumber: s.set_number,
        weight: s.weight,
        reps: s.reps,
      })),
      startedAt: log.started_at,
      endedAt: log.ended_at,
    }))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

// 해당 월에 운동 기록이 있는 날짜를 "YYYY-MM-DD" 문자열 Set으로 반환
export async function fetchWorkoutDatesInMonth(userId: string, month: Date): Promise<Set<string>> {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const params = new URLSearchParams({
    user_id: userId,
    start: start.toISOString(),
    end: end.toISOString(),
  });
  const logs = await apiFetch<WorkoutLogResponse[]>(`/api/logs/?${params}`);

  // started_at 에서 로컬 날짜(YYYY-MM-DD) 추출 후 중복 제거
  const dates = new Set<string>();
  for (const log of logs) {
    const iso = log.started_at.endsWith('Z') || log.started_at.includes('+')
      ? log.started_at
      : log.started_at + 'Z';
    const local = new Date(iso);
    const key = `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, '0')}-${String(local.getDate()).padStart(2, '0')}`;
    dates.add(key);
  }
  return dates; // ex. Set { '2026-03-25', '2026-03-26' }
}

// ── 데모 API ──────────────────────────────────────────────────────────────────

export async function startDemoScenario(userId: string): Promise<void> {
  await apiFetch(`/api/demo/scenario/${userId}`, { method: 'POST' });
}

// ── 루틴 API ──────────────────────────────────────────────────────────────────

type SmartDefaultResponse = {
  equipment_id: string;
  suggested_sets_detail: { weight: number; reps: number }[];
  based_on_date: string | null;
};

export async function fetchSmartDefault(
  userId: string,
  equipmentId: string,
): Promise<SmartDefaultData> {
  const params = new URLSearchParams({ user_id: userId, equipment_id: equipmentId });
  const data = await apiFetch<SmartDefaultResponse>(`/api/routine/smart-default?${params}`);
  return {
    equipmentId: data.equipment_id,
    suggestedSetsDetail: data.suggested_sets_detail,
    basedOnDate: data.based_on_date,
  };
}
