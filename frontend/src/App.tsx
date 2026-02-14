import { useEffect, useState } from 'react';

import { Badge } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import {
  completeWorkoutLog,
  createWorkoutLog,
  deleteInProgressLog,
  registerEquipment,
  updateWorkoutLogSets,
} from './api/client';
import { ERROR_MESSAGES } from './constants/errorMessages';
import { Dashboard } from './components/Dashboard';
import { EquipmentRegisterModal } from './components/EquipmentRegisterModal';
import { EquipmentStatus } from './components/EquipmentStatus';
import { SmartDefault } from './components/SmartDefault';
import type { SetEntry } from './components/SmartDefault';
import { WorkoutInProgress } from './components/WorkoutInProgress';
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
  connecting:   { color: 'yellow', label: '연결 중' },
  connected:    { color: 'green',  label: '연결됨' },
  reconnecting: { color: 'orange', label: '재연결 중' },
  disconnected: { color: 'gray',   label: '연결 끊김' },
};

function App() {
  const { lastEvent, status } = useWebSocketContext();
  const { smartDefault, isLoading, fetchForEquipment } = useWorkoutLog(USER_ID);
  const { logs, isLoading: isDashboardLoading, refetch } = useDashboard(USER_ID);

  const [equipment,          setEquipment]          = useState<EquipmentDetectedPayload | null>(null);
  const [tumblerState,       setTumblerState]       = useState<TumblerStatePayload | null>(null);
  const [unknownFingerprint, setUnknownFingerprint] = useState<UnknownEquipmentPayload | null>(null);

  // 진행 중인 운동 로그 상태
  const [inProgressLogId, setInProgressLogId] = useState<string | null>(null);
  const [inProgressSets,  setInProgressSets]  = useState<SetEntry[]>([]);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'equipment_detected') {
      // 기구 교체 시 기존 in_progress 로그 삭제
      if (inProgressLogId) {
        deleteInProgressLog(USER_ID).catch(() => {});
        setInProgressLogId(null);
        setInProgressSets([]);
      }
      setEquipment(lastEvent.payload);
    }

    if (lastEvent.type === 'tumbler_state_changed') setTumblerState(lastEvent.payload);
    if (lastEvent.type === 'equipment_unknown')      setUnknownFingerprint(lastEvent.payload);
  }, [lastEvent]);

  async function handleRegister(equipmentName: string) {
    if (!unknownFingerprint) return;
    const registered = await registerEquipment(USER_ID, equipmentName);
    setEquipment(registered);
    setUnknownFingerprint(null);
    fetchForEquipment(registered.equipmentId);
  }

  async function handleSmartDefaultConfirm(sets: SetEntry[]) {
    if (!equipment) return;
    try {
      const logId = await createWorkoutLog(
        USER_ID,
        equipment.equipmentId,
        equipment.equipmentName,
        sets,
      );
      setInProgressLogId(logId);
      setInProgressSets(sets);
    } catch (err) {
      notifications.show({
        color:   'red',
        message: err instanceof Error ? err.message : ERROR_MESSAGES.api.serverError,
      });
    }
  }

  async function handleComplete() {
    if (!inProgressLogId) return;
    try {
      await completeWorkoutLog(inProgressLogId);
      setInProgressLogId(null);
      setInProgressSets([]);
      refetch();
    } catch (err) {
      notifications.show({
        color:   'red',
        message: err instanceof Error ? err.message : ERROR_MESSAGES.api.serverError,
      });
    }
  }

  async function handleUpdateSets(sets: SetEntry[]) {
    if (!inProgressLogId) return;
    try {
      await updateWorkoutLogSets(inProgressLogId, sets);
      setInProgressSets(sets);
    } catch (err) {
      notifications.show({
        color:   'red',
        message: err instanceof Error ? err.message : ERROR_MESSAGES.api.serverError,
      });
    }
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

          {/* Phase 3: 운동 진행 중 */}
          {inProgressLogId && (
            <WorkoutInProgress
              sets={inProgressSets}
              onComplete={handleComplete}
              onUpdateSets={handleUpdateSets}
            />
          )}

          {/* Phase 2: 목표 설정 (in_progress 없을 때만 표시) */}
          {!inProgressLogId && (
            <SmartDefault
              data={smartDefault}
              isLoading={isLoading}
              onConfirm={handleSmartDefaultConfirm}
            />
          )}
        </div>

        <div className="w-full md:w-2/3">
          <Dashboard logs={logs} isLoading={isDashboardLoading} />
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
