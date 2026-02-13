import { useEffect, useState } from 'react';

import { Badge } from '@mantine/core';

import { registerEquipment } from './api/client';
import { Dashboard } from './components/Dashboard';
import { EquipmentRegisterModal } from './components/EquipmentRegisterModal';
import { EquipmentStatus } from './components/EquipmentStatus';
import { SmartDefault } from './components/SmartDefault';
import type { SetEntry } from './components/SmartDefault';
import { useWebSocketContext } from './contexts/WebSocketContext';
import { useDashboard } from './hooks/useDashboard';
import { useWorkoutLog } from './hooks/useWorkoutLog';
import type {
  EquipmentDetectedPayload,
  TumblerStatePayload,
  UnknownEquipmentPayload,
} from './types';

const USER_ID = 'user-1';

const STATUS_BADGE: Record<string, { color: string; label: string }> = {
  connecting: { color: 'yellow', label: '연결 중' },
  connected: { color: 'green', label: '연결됨' },
  reconnecting: { color: 'orange', label: '재연결 중' },
  disconnected: { color: 'gray', label: '연결 끊김' },
};

function App() {
  const { lastEvent, status } = useWebSocketContext();
  const { smartDefault, isLoading } = useWorkoutLog(USER_ID);
  const { entries, isLoading: isDashboardLoading } = useDashboard(USER_ID);

  const [equipment, setEquipment] = useState<EquipmentDetectedPayload | null>(null);
  const [tumblerState, setTumblerState] = useState<TumblerStatePayload | null>(null);
  const [unknownFingerprint, setUnknownFingerprint] = useState<UnknownEquipmentPayload | null>(null);

  useEffect(() => {
    if (!lastEvent) return;
    if (lastEvent.type === 'equipment_detected') setEquipment(lastEvent.payload);
    if (lastEvent.type === 'tumbler_state_changed') setTumblerState(lastEvent.payload);
    if (lastEvent.type === 'equipment_unknown') setUnknownFingerprint(lastEvent.payload);
  }, [lastEvent]);

  async function handleRegister(equipmentName: string) {
    if (!unknownFingerprint) return;
    const registered = await registerEquipment(USER_ID, equipmentName);
    setEquipment(registered);
    setUnknownFingerprint(null);
  }

  function handleSmartDefaultConfirm(sets: SetEntry[]) {
    // TODO: 운동 로그 세션 시작 및 목표값 저장
    console.log('목표 확정:', sets);
  }

  const badge = STATUS_BADGE[status];

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-2xl font-bold text-gray-800">Hands-Free Gym Tracker</h1>
        <Badge color={badge.color} variant="light">{badge.label}</Badge>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-1/3">
          <EquipmentStatus equipment={equipment} tumblerState={tumblerState} />
          <SmartDefault
            data={smartDefault}
            isLoading={isLoading}
            onConfirm={handleSmartDefaultConfirm}
          />
        </div>
        <div className="w-full md:w-2/3">
          <Dashboard entries={entries} isLoading={isDashboardLoading} />
        </div>
      </div>

      <EquipmentRegisterModal
        open={unknownFingerprint !== null}
        fingerprintId={unknownFingerprint?.rawFingerprintId ?? ''}
        onRegister={handleRegister}
        onDismiss={() => setUnknownFingerprint(null)}
      />
    </div>
  );
}

export default App;
