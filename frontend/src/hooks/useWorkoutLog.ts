import { useEffect, useState } from 'react';

import { notifications } from '@mantine/notifications';

import { fetchSmartDefault } from '../api/client';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import type { SmartDefaultData } from '../types';

type UseWorkoutLogReturn = {
  smartDefault: SmartDefaultData | null;
  isLoading:    boolean;
};

export function useWorkoutLog(userId: string): UseWorkoutLogReturn {
  const { lastEvent } = useWebSocketContext();
  const [smartDefault, setSmartDefault] = useState<SmartDefaultData | null>(null);
  const [isLoading,    setIsLoading]    = useState(false);

  useEffect(() => {
    if (lastEvent?.type !== 'equipment_detected') return;

    const { equipmentId } = lastEvent.payload;
    setIsLoading(true);

    fetchSmartDefault(userId, equipmentId)
      .then(setSmartDefault)
      .catch((e: Error) => {
        notifications.show({
          color:   'red',
          title:   '스마트 디폴트 조회 실패',
          message: e.message,
        });
      })
      .finally(() => setIsLoading(false));
  }, [lastEvent, userId]);

  return { smartDefault, isLoading };
}
