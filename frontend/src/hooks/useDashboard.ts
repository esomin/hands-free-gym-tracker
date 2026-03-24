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

  // date 객체는 매 렌더마다 새로 생성되므로 타임스탬프(숫자)로 비교
  const dateTs = date.getTime();

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
