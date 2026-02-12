import { useEffect, useState } from 'react';

import { fetchTodayLogs } from '../api/client';
import type { DashboardEntry, WebSocketEvent } from '../types';

export type { DashboardEntry };

type UseDashboardReturn = {
  entries:   DashboardEntry[];
  isLoading: boolean;
};

export function useDashboard(
  lastEvent: WebSocketEvent | null,
  userId: string,
): UseDashboardReturn {
  const [entries,   setEntries]   = useState<DashboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 마운트 시 오늘의 로그 조회
  useEffect(() => {
    fetchTodayLogs(userId)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [userId]);

  // set_logged 이벤트 수신 시 목록 상단에 삽입
  useEffect(() => {
    if (lastEvent?.type !== 'set_logged') return;
    const { payload } = lastEvent;
    setEntries((prev) => [
      {
        equipmentName: payload.equipmentName,
        setNumber:     payload.setNumber,
        weight:        payload.weight,
        reps:          payload.reps,
        loggedAt:      payload.loggedAt,
      },
      ...prev,
    ]);
  }, [lastEvent]);

  return { entries, isLoading };
}
