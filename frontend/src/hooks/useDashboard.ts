import { useEffect, useState } from 'react';

import { notifications } from '@mantine/notifications';

import { fetchLogsByDate } from '../api/client';
import type { DashboardLog } from '../types';

type UseDashboardReturn = {
  logs:      DashboardLog[];
  isLoading: boolean;
  refetch:   () => void;
};

export function useDashboard(userId: string, date: Date = new Date()): UseDashboardReturn {
  const [logs,      setLogs]      = useState<DashboardLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  // date를 자정(00:00:00)으로 정규화한 타임스탬프로 비교
  // new Date()는 밀리초까지 포함하므로 그대로 쓰면 매 렌더마다 값이 달라져 무한루프 발생
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const dateTs = normalized.getTime();

  useEffect(() => {
    setIsLoading(true);
    fetchLogsByDate(userId, new Date(dateTs))
      .then(setLogs)
      .catch((e: Error) => {
        notifications.show({
          color:   'red',
          title:   '운동 기록 조회 실패',
          message: e.message,
        });
      })
      .finally(() => setIsLoading(false));
  }, [userId, dateTs, fetchTick]);

  function refetch() {
    setFetchTick((n) => n + 1);
  }

  return { logs, isLoading, refetch };
}
