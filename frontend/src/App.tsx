import { useEffect, useState } from 'react';

import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';

import { Dashboard } from './components/Dashboard';
import { EquipmentRegisterModal } from './components/EquipmentRegisterModal';
import { EquipmentStatus } from './components/EquipmentStatus';
import { SmartDefault } from './components/SmartDefault';
import type { SetEntry } from './components/SmartDefault';
import { useDashboard } from './hooks/useDashboard';
import { useWebSocket } from './hooks/useWebSocket';
import { useWorkoutLog } from './hooks/useWorkoutLog';
import type {
  EquipmentDetectedPayload,
  TumblerStatePayload,
  UnknownEquipmentPayload,
} from './types';

const WS_URL = 'ws://localhost:8000/ws/user-1';
const USER_ID = 'user-1';

// TODO: UI 확인용 — 실 데이터 연동 후 제거
// const MOCK_ENTRIES = [
//   { equipmentName: '레그프레스', setNumber: 1, weight: 80, reps: 12, loggedAt: new Date(Date.now() - 1000 * 60 * 2).toISOString() },
//   { equipmentName: '체스트프레스', setNumber: 2, weight: 65, reps: 10, loggedAt: new Date(Date.now() - 1000 * 60 * 17).toISOString() },
//   { equipmentName: '숄더프레스', setNumber: 1, weight: 40, reps: 15, loggedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
// ];

function App() {
  const { lastEvent } = useWebSocket(WS_URL);
  const { smartDefault, isLoading } = useWorkoutLog(lastEvent, USER_ID);
  const { entries, isLoading: isDashboardLoading } = useDashboard(lastEvent, USER_ID);

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
    // TODO : POST /api/equipment { fingerprintId, equipmentName }
    console.log('등록 요청:', unknownFingerprint.rawFingerprintId, equipmentName);
    setUnknownFingerprint(null);
  }

  function handleSmartDefaultConfirm(sets: SetEntry[]) {
    // TODO: 운동 로그 세션 시작 및 목표값 저장
    console.log('목표 확정:', sets);
  }

  return (
    <MantineProvider>
      <Notifications position="top-right" />
      <div className="min-h-screen bg-gray-50 p-4">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">Hands-Free Gym Tracker</h1>

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
            {/* <Dashboard entries={MOCK_ENTRIES} isLoading={false} /> */}
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
    </MantineProvider>
  );
}

export default App;
