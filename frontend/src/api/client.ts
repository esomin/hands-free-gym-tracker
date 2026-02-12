import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { SmartDefaultData } from '../types';

const BASE_URL = 'http://localhost:8000';

async function apiFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`);
  } catch {
    throw new Error(ERROR_MESSAGES.api.networkError);
  }
  if (res.status === 404) throw new Error(ERROR_MESSAGES.api.notFound);
  if (res.status >= 500) throw new Error(ERROR_MESSAGES.api.serverError);
  if (!res.ok) throw new Error(ERROR_MESSAGES.api.serverError);
  return res.json() as Promise<T>;
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
