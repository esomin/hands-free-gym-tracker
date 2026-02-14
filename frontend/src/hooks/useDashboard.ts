import { useEffect, useState } from 'react';

import { notifications } from '@mantine/notifications';

import { fetchTodayLogs } from '../api/client';
import type { DashboardLog } from '../types';

type UseDashboardReturn = {
  logs:      DashboardLog[];
  isLoading: boolean;
  refetch:   () => void;
};

export function useDashboard(userId: string): UseDashboardReturn {
  const [logs,      setLogs]      = useState<DashboardLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchTick, setFetchTick] = useState(0);

  useEffect(() => {
    setIsLoading(true);
    fetchTodayLogs(userId)
      .then(setLogs)
      .catch((e: Error) => {
        notifications.show({
          color:   'red',
          title:   '운동 기록 조회 실패',
          message: e.message,
        });
      })
      .finally(() => setIsLoading(false));
  }, [userId, fetchTick]);

  function refetch() {
    setFetchTick((n) => n + 1);
  }

  return { logs, isLoading, refetch };
}
