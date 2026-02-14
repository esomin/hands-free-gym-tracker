import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { DashboardLog, EquipmentDetectedPayload, SmartDefaultData } from '../types';

const BASE_URL = 'http://localhost:8000';

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
  equipment_id:   string;
  equipment_name: string;
  confidence:     number;
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
    equipmentId:   data.equipment_id,
    equipmentName: data.equipment_name,
    confidence:    data.confidence,
    detectedAt:    new Date().toISOString(),
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
      user_id:        userId,
      equipment_id:   equipmentId,
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

export async function deleteInProgressLog(userId: string): Promise<void> {
  const params = new URLSearchParams({ user_id: userId });
  await apiFetch(`/api/logs/in-progress?${params}`, { method: 'DELETE' });
}


type LogSetResponse = {
  set_number: number;
  weight:     number;
  reps:       number;
};

type WorkoutLogResponse = {
  id:             string;
  equipment_name: string;
  sets:           LogSetResponse[];
  started_at:     string;
  ended_at:       string | null;
};

export async function fetchTodayLogs(userId: string): Promise<DashboardLog[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const params = new URLSearchParams({
    user_id: userId,
    start:   today.toISOString(),
    end:     tomorrow.toISOString(),
  });
  const logs = await apiFetch<WorkoutLogResponse[]>(`/api/logs/?${params}`);

  // 로그 단위 유지, started_at 오름차순 정렬
  return logs
    .map((log) => ({
      id:            log.id,
      equipmentName: log.equipment_name,
      sets:          log.sets.map((s) => ({
        setNumber: s.set_number,
        weight:    s.weight,
        reps:      s.reps,
      })),
      startedAt: log.started_at,
      endedAt:   log.ended_at,
    }))
    .sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());
}

// ── 루틴 API ──────────────────────────────────────────────────────────────────

type SmartDefaultResponse = {
  equipment_id:     string;
  suggested_weight: number;
  suggested_reps:   number;
  suggested_sets:   number;
  based_on_date:    string | null;
};

export async function fetchSmartDefault(
  userId: string,
  equipmentId: string,
): Promise<SmartDefaultData> {
  const params = new URLSearchParams({ user_id: userId, equipment_id: equipmentId });
  const data = await apiFetch<SmartDefaultResponse>(`/api/routine/smart-default?${params}`);
  return {
    equipmentId:     data.equipment_id,
    suggestedWeight: data.suggested_weight,
    suggestedReps:   data.suggested_reps,
    suggestedSets:   data.suggested_sets,
    basedOnDate:     data.based_on_date,
  };
}
