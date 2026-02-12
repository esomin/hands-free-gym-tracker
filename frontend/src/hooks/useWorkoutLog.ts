import { useEffect, useState } from 'react';

import { fetchSmartDefault } from '../api/client';
import type { SmartDefaultData, WebSocketEvent } from '../types';

type UseWorkoutLogReturn = {
  smartDefault: SmartDefaultData | null;
  isLoading: boolean;
  error: string | null;
};

export function useWorkoutLog(
  lastEvent: WebSocketEvent | null,
  userId: string,
): UseWorkoutLogReturn {
  const [smartDefault, setSmartDefault] = useState<SmartDefaultData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (lastEvent?.type !== 'equipment_detected') return;

    const { equipmentId } = lastEvent.payload;
    setIsLoading(true);
    setError(null);

    fetchSmartDefault(userId, equipmentId)
      .then(setSmartDefault)
      .catch((e: Error) => setError(e.message))
      .finally(() => setIsLoading(false));
  }, [lastEvent, userId]);

  return { smartDefault, isLoading, error };
}
