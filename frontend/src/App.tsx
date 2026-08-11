import { useEffect, useState, useCallback } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchBottles, fetchMedicationLogs, fetchAdherenceStats } from './api/client';
import type { Bottle, MedicationLog, AdherenceStats, BottleState } from './types';
import { BottleCard } from './features/medication/BottleCard';
import { MedicationLogList } from './features/medication/MedicationLogList';
import { AdherenceDashboard } from './features/medication/AdherenceDashboard';

const WS_URL = 'ws://localhost:8000/ws/user-1';

function App() {
  const { status, lastEvent } = useWebSocket(WS_URL);

  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [stats, setStats] = useState<AdherenceStats | null>(null);

  // 실시간 약통별 복용 완료 여부 및 현재 각도 상태
  const [takenBottles, setTakenBottles] = useState<Record<string, boolean>>({});
  const [bottleStates, setBottleStates] = useState<Record<string, BottleState>>({});
  const [lastTakenTimes, setLastTakenTimes] = useState<Record<string, string>>({});

  // 데이터 로드
  const loadData = useCallback(async () => {
    try {
      const [bList, lList, sData] = await Promise.all([
        fetchBottles(),
        fetchMedicationLogs(),
        fetchAdherenceStats(),
      ]);
      setBottles(bList);
      setLogs(lList);
      setStats(sData);

      // 당일 복용 완료된 약통 맵 작성
      const todayStr = new Date().toISOString().slice(0, 10);
      const takenMap: Record<string, boolean> = {};
      const timeMap: Record<string, string> = {};

      lList.forEach((log) => {
        if (log.taken_at.slice(0, 10) === todayStr) {
          takenMap[log.bottle_id] = true;
        }
        if (!timeMap[log.bottle_id] || new Date(log.taken_at) > new Date(timeMap[log.bottle_id])) {
          timeMap[log.bottle_id] = log.taken_at;
        }
      });

      setTakenBottles(takenMap);
      setLastTakenTimes(timeMap);
    } catch (e) {
      console.warn('데이터 로딩 오류:', e);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 실시간 WebSocket 이벤트 수신 시 상태 갱신
  useEffect(() => {
    if (!lastEvent) return;

    if (lastEvent.type === 'medication_taken') {
      const payload = lastEvent.payload as any;
      const bId = payload.bottle_id;
      const takenAt = payload.taken_at ?? payload.timestamp;

      setTakenBottles((prev) => ({ ...prev, [bId]: true }));
      if (takenAt) {
        setLastTakenTimes((prev) => ({ ...prev, [bId]: takenAt }));
      }

      // 실시간 로그 추가
      const newLog: MedicationLog = {
        id: `realtime-${Date.now()}`,
        bottle_id: bId,
        event_type: 'settled',
        taken_at: takenAt || new Date().toISOString(),
        status: 'SUCCESS',
      };
      setLogs((prev) => [newLog, ...prev]);

      // 통계 갱신
      fetchAdherenceStats().then(setStats).catch(() => {});
    }

    if (lastEvent.type === 'bottle_state_changed') {
      const { state } = lastEvent.payload;
      setBottleStates((prev) => ({ ...prev, BOTTLE_01: state }));
    }
  }, [lastEvent]);

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950 text-[#5DD39E] border border-[#5DD39E]/30">
            <span className="w-2 h-2 rounded-full bg-[#5DD39E] animate-pulse"></span>
            실시간 연동 완료
          </span>
        );
      case 'connecting':
      case 'reconnecting':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-950 text-amber-300 border border-amber-600/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
            연결 중...
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            연결 대기
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-6 md:p-10">
      <div className="max-w-6xl mx-auto">
        {/* 헤더 */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between pb-6 mb-8 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-extrabold text-slate-100 tracking-tight">
                Hands-Free Med Tracker
              </h1>
              {getStatusBadge()}
            </div>
            <p className="text-sm text-slate-400 mt-1">
              6축 자이로·가속도(IMU) 센서 기반 자율형 복약 및 순응도 관리 관제 시스템
            </p>
          </div>

          <button
            onClick={() => loadData()}
            className="self-start md:self-auto px-4 py-2 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors"
          >
            새로고침
          </button>
        </header>

        {/* 복약 순응도 대시보드 */}
        <AdherenceDashboard stats={stats} />

        {/* 약통 현황 & 복용 이력 타임라인 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 좌측: 등록 약통 현황 */}
          <div>
            <h2 className="text-lg font-bold text-slate-200 mb-4 flex items-center justify-between">
              <span>약통별 복용 현황</span>
              <span className="text-xs text-slate-400 font-mono font-normal">
                {bottles.length}개 약통 등록됨
              </span>
            </h2>

            <div className="space-y-4">
              {bottles.map((bottle) => (
                <BottleCard
                  key={bottle.bottle_id}
                  bottle={bottle}
                  isTakenToday={!!takenBottles[bottle.bottle_id]}
                  currentState={bottleStates[bottle.bottle_id] || 'idle'}
                  lastTakenTime={lastTakenTimes[bottle.bottle_id]}
                />
              ))}
            </div>
          </div>

          {/* 우측: 실시간 복용 이력 타임라인 */}
          <div>
            <MedicationLogList logs={logs} bottles={bottles} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
