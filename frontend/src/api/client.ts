import type { Bottle, MedicationLog, AdherenceStats } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, init);
  } catch {
    throw new Error("네트워크 연결 실패");
  }
  if (!res.ok) throw new Error("서버 응답 오류");
  return res.json() as Promise<T>;
}

export class DuplicateBottleError extends Error {
  code: string;
  existingBottle: Bottle;

  constructor(message: string, existingBottle: Bottle) {
    super(message);
    this.name = 'DuplicateBottleError';
    this.code = 'DUPLICATE_BOTTLE';
    this.existingBottle = existingBottle;
  }
}

// ── 약통 API ──────────────────────────────────────────────────────────────────

export async function fetchBottles(): Promise<Bottle[]> {
  return apiFetch<Bottle[]>('/api/bottles');
}

export async function fetchBottleById(bottleId: string): Promise<Bottle> {
  return apiFetch<Bottle>(`/api/bottles/${bottleId}`);
}

export async function registerBottle(
  bottleId: string,
  name: string,
  targetTime: string,
  mode: 'create' | 'update' | 'archive_and_create' = 'create'
): Promise<Bottle> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/bottles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bottle_id: bottleId,
        name,
        target_time: targetTime,
        mode,
      }),
    });
  } catch {
    throw new Error("네트워크 연결 실패");
  }

  if (res.status === 409) {
    const data = await res.json().catch(() => ({}));
    const detail = data.detail || {};
    throw new DuplicateBottleError(
      detail.message || `약통 '${bottleId}'는 이미 등록되어 있습니다.`,
      detail.existing_bottle
    );
  }

  if (!res.ok) throw new Error("서버 응답 오류");
  return res.json() as Promise<Bottle>;
}

export async function deleteBottle(bottleId: string): Promise<{ deleted: boolean; bottle_id: string }> {
  return apiFetch<{ deleted: boolean; bottle_id: string }>(`/api/bottles/${bottleId}`, {
    method: 'DELETE',
  });
}

// ── 복용 이력 & 순응도 API ──────────────────────────────────────────────────────

export async function fetchMedicationLogs(bottleId?: string): Promise<MedicationLog[]> {
  const path = bottleId ? `/api/logs?bottle_id=${bottleId}` : '/api/logs';
  return apiFetch<MedicationLog[]>(path);
}

export async function createMedicationLog(bottleId: string): Promise<MedicationLog> {
  return apiFetch<MedicationLog>('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      bottle_id: bottleId,
      event_type: 'settled',
      status: 'SUCCESS',
    }),
  });
}

export async function fetchAdherenceStats(): Promise<AdherenceStats> {
  return apiFetch<AdherenceStats>('/api/logs/stats');
}

export async function deleteRecentLogs(hours = 1.0): Promise<{ status: string; deleted_count: number; message: string }> {
  return apiFetch<{ status: string; deleted_count: number; message: string }>(`/api/logs/recent?hours=${hours}`, {
    method: 'DELETE',
  });
}

export async function deleteAllLogs(): Promise<{ status: string; deleted_count: number; message: string }> {
  return apiFetch<{ status: string; deleted_count: number; message: string }>('/api/logs', {
    method: 'DELETE',
  });
}
