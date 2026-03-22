import { useEffect, useRef, useState } from 'react';

import { Badge, Button, Group, Modal, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import {
  completeWorkoutLog,
  createWorkoutLog,
  deleteInProgressLog,
  fetchSessionSnapshot,
  registerEquipment,
  startDemoScenario,
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
  connecting: { color: 'yellow', label: '연결 중' },
  connected: { color: 'green', label: '연결됨' },
  reconnecting: { color: 'orange', label: '재연결 중' },
  disconnected: { color: 'gray', label: '연결 끊김' },
};

function App() {
  const { lastEvent, status } = useWebSocketContext();
  const { smartDefault, isLoading, fetchForEquipment } = useWorkoutLog(USER_ID);
  const { logs, isLoading: isDashboardLoading, refetch } = useDashboard(USER_ID);

  const [equipment, setEquipment] = useState<EquipmentDetectedPayload | null>(null);
  const [tumblerState, setTumblerState] = useState<TumblerStatePayload | null>(null);
  const [unknownFingerprint, setUnknownFingerprint] = useState<UnknownEquipmentPayload | null>(null);

  // 진행 중인 운동 로그 상태
  const [inProgressLogId, setInProgressLogId] = useState<string | null>(null);
  const [inProgressSets, setInProgressSets] = useState<SetEntry[]>([]);
  // useEffect 스테일 클로저 방지: inProgressLogId 최신값을 ref로 유지
  const inProgressLogIdRef = useRef(inProgressLogId);
  inProgressLogIdRef.current = inProgressLogId;

  // 기구 변경 시 미완료 로그 처리 모달 상태
  const [logActionModal, setLogActionModal] = useState<{
    open: boolean;
    nextEquipment: EquipmentDetectedPayload | null;
  }>({ open: false, nextEquipment: null });

  // 데모 실행 중 여부 (버튼 비활성화에 사용)
  const [isDemoRunning, setIsDemoRunning] = useState(false);

  // 마운트 시 세션 스냅샷으로 상태 복원 (새로고침 / 앱 재진입 대응)
  useEffect(() => {
    fetchSessionSnapshot(USER_ID)
      .then((snapshot) => {
        if (snapshot.tumbler_state === 'settled') {
          setTumblerState({ state: 'settled', transitionedAt: new Date().toISOString() });
        }
        if (snapshot.equipment) {
          setEquipment({
            equipmentId: snapshot.equipment.equipment_id,
            equipmentName: snapshot.equipment.equipment_name,
            confidence: snapshot.equipment.confidence,
            detectedAt: new Date().toISOString(),
          });
          fetchForEquipment(snapshot.equipment.equipment_id);
        }
        if (snapshot.in_progress_log) {
          setInProgressLogId(snapshot.in_progress_log.log_id);
          setInProgressSets(
            snapshot.in_progress_log.sets.map((s) => ({ weight: s.weight, reps: s.reps })),
          );
        }
        // 새로고침 시 데모가 실행 중이면 버튼 비활성화 복원
        if (snapshot.is_demo_running) {
          setIsDemoRunning(true);
        }
      })
      .catch(() => { });
  }, []);

  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'equipment_detected') {
      // 기구 변경 시 미완료 로그가 있으면 처리 모달을 띄움
      if (inProgressLogIdRef.current) {
        setLogActionModal({ open: true, nextEquipment: lastEvent.payload });
        return;
      }
      setEquipment(lastEvent.payload);
      fetchForEquipment(lastEvent.payload.equipmentId);
    }

    if (lastEvent.type === 'tumbler_state_changed') setTumblerState(lastEvent.payload);
    if (lastEvent.type === 'equipment_unknown') setUnknownFingerprint(lastEvent.payload);

    // 데모 시나리오: 백엔드가 직접 생성한 운동 로그를 프론트엔드 상태에 반영
    if (lastEvent.type === 'demo_workout_started') {
      setInProgressLogId(lastEvent.payload.logId);
      setInProgressSets(lastEvent.payload.sets);
    }
    if (lastEvent.type === 'demo_workout_completed') {
      setInProgressLogId(null);
      setInProgressSets([]);
      refetch();
    }
    // 전체 시나리오 완료 시 버튼 복귀
    if (lastEvent.type === 'demo_scenario_completed') {
      setIsDemoRunning(false);
    }
    // 데모 로그 삭제 완료 시 대시보드 갱신
    if (lastEvent.type === 'demo_logs_cleared') {
      refetch();
    }
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
        color: 'red',
        message: err instanceof Error ? err.message : ERROR_MESSAGES.api.serverError,
      });
    }
  }

  // 기구 변경 확인 후 공통: 새 기구로 전환
  function applyNextEquipment() {
    const next = logActionModal.nextEquipment;
    if (!next) return;
    setInProgressLogId(null);
    setInProgressSets([]);
    setEquipment(next);
    fetchForEquipment(next.equipmentId);
    setLogActionModal({ open: false, nextEquipment: null });
  }

  // 미완료 로그 삭제 후 기구 전환
  async function handleDeleteAndContinue() {
    try {
      await deleteInProgressLog(USER_ID);
    } catch {
      // 삭제 실패해도 상태는 초기화하여 진행
    }
    applyNextEquipment();
  }

  // 미완료 로그 저장(완료 처리) 후 기구 전환
  async function handleSaveAndContinue() {
    if (!inProgressLogId) return;
    try {
      await completeWorkoutLog(inProgressLogId);
      refetch();
    } catch (err) {
      notifications.show({
        color: 'red',
        message: err instanceof Error ? err.message : ERROR_MESSAGES.api.serverError,
      });
    }
    applyNextEquipment();
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
        color: 'red',
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
        color: 'red',
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
        <Button
          size="xs"
          className="w-30!"
          variant="light"
          color="violet"
          disabled={isDemoRunning}
          onClick={() => {
            setIsDemoRunning(true);
            startDemoScenario(USER_ID).catch(() => {
              setIsDemoRunning(false);
            });
          }}
        >
          데모 시작
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="w-full md:w-[40%]">
          <EquipmentStatus equipment={equipment} tumblerState={tumblerState} inProgress={inProgressLogId !== null} />

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

        <div className="w-full md:w-[40%]">
          <Dashboard logs={logs} isLoading={isDashboardLoading} />
        </div>
      </div>

      <Modal
        opened={logActionModal.open}
        onClose={() => { }}
        withCloseButton={false}
        title="진행 중인 운동 기록"
        centered
      >
        <Text size="sm" mb="lg">
          기구가 변경되었습니다. 진행 중인 운동 기록을 어떻게 처리할까요?
        </Text>
        <Group justify="flex-end">
          <Button variant="subtle" color="red" onClick={handleDeleteAndContinue}>
            삭제하고 계속
          </Button>
          <Button onClick={handleSaveAndContinue}>
            저장하고 계속
          </Button>
        </Group>
      </Modal>

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
