import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@mantine/core';
import { useWebSocket } from './hooks/useWebSocket';
import { fetchBottles, fetchMedicationLogs, fetchAdherenceStats } from './api/client';
import type { Bottle, MedicationLog, AdherenceStats, BottleState } from './types';
import { BottleCard } from './features/medication/BottleCard';
import { MedicationLogList } from './features/medication/MedicationLogList';
import { AdherenceDashboard } from './features/medication/AdherenceDashboard';
import { MedicationHistoryTab } from './features/medication/MedicationHistoryTab';
import { WifiProvisionModal } from './features/medication/WifiProvisionModal';
import { IconWifi } from '@tabler/icons-react';

const WS_URL = 'ws://localhost:8000/ws/user-1';

const tabBase: React.CSSProperties = {
  writingMode: 'vertical-rl',
  textTransform: 'uppercase',
  padding: '12px 6px',
  cursor: 'pointer',
  border: 'none',
  borderTopLeftRadius: '6px',
  borderBottomLeftRadius: '6px',
  marginBottom: '8px',
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.05em',
  color: '#a5b4fc',
  backgroundColor: 'transparent',
  transition: 'all 0.15s ease',
};

const tabActive: React.CSSProperties = {
  color: '#4f46e5',
  backgroundColor: '#f8fafc',
};

const tabLabel: React.CSSProperties = {
  transform: 'rotate(180deg)',
  display: 'inline-block',
};

const STATUS_BADGE = {
  connected: { color: 'green', label: '실시간 연동 완료' },
  connecting: { color: 'yellow', label: '연결 중...' },
  reconnecting: { color: 'yellow', label: '재연결 중...' },
  disconnected: { color: 'gray', label: '연결 대기' },
};

// URL Hash 기반의 경량 라우터 타입 (#today, #history)
type RoutePage = 'today' | 'history';

function App() {
  const { status, lastEvent } = useWebSocket(WS_URL);

  // URL Hash (#today, #history) 기반 라우팅 상태
  const [currentPage, setCurrentPage] = useState<RoutePage>(() => {
    const hash = window.location.hash.replace('#', '');
    return hash === 'history' ? 'history' : 'today';
  });

  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [bottles, setBottles] = useState<Bottle[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [stats, setStats] = useState<AdherenceStats | null>(null);

  // 실시간 약통별 복용 완료 여부 및 현재 각도 상태
  const [takenBottles, setTakenBottles] = useState<Record<string, boolean>>({});
  const [bottleStates, setBottleStates] = useState<Record<string, BottleState>>({});
  const [lastTakenTimes, setLastTakenTimes] = useState<Record<string, string>>({});

  // URL 해시 변화 감지 (브라우저 뒤로가기 / 앞으로가기 및 URL 링크 복사 지원)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash === 'history') {
        setCurrentPage('history');
      } else {
        setCurrentPage('today');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // 페이지 이동 함수 (URL Hash 변경 및 상태 갱신)
  const navigateTo = (page: RoutePage) => {
    window.location.hash = page;
    setCurrentPage(page);
  };

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

      const newLog: MedicationLog = {
        id: `realtime-${Date.now()}`,
        bottle_id: bId,
        event_type: 'settled',
        taken_at: takenAt || new Date().toISOString(),
        status: 'SUCCESS',
      };
      setLogs((prev) => [newLog, ...prev]);
      fetchAdherenceStats().then(setStats).catch(() => { });
    }

    if (lastEvent.type === 'bottle_state_changed') {
      const { state } = lastEvent.payload;
      setBottleStates((prev) => ({ ...prev, BOTTLE_01: state }));
    }
  }, [lastEvent]);

  const badge = STATUS_BADGE[status];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* 수직 네비게이션 탭 (URL 링크 라우팅 지원) */}
      <div className="flex flex-col pt-16 pl-1 bg-indigo-950">
        {(['today', 'history'] as RoutePage[]).map((page) => (
          <a
            key={page}
            href={`#${page}`}
            onClick={(e) => {
              e.preventDefault();
              navigateTo(page);
            }}
            style={{ ...tabBase, ...(currentPage === page ? tabActive : {}) }}
          >
            <span style={tabLabel}>{page === 'today' ? 'TODAY' : 'HISTORY'}</span>
          </a>
        ))}
      </div>

      {/* 메인 컨텐츠 */}
      <div className="flex-1 p-4" style={{ borderLeft: '1px solid #dee2e6' }}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-800">Hands-Free Med Tracker</h1>
            <Badge color={badge.color} variant="light">{badge.label}</Badge>
          </div>
          <button
            onClick={() => setIsWifiModalOpen(true)}
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50/60 text-gray-700 hover:text-indigo-600 font-semibold !text-xs rounded-lg shadow-2xs transition-all cursor-pointer"
          >
            <IconWifi size={18} className="text-indigo-600" />
            <span>기기 Wi-Fi / BLE 설정</span>
          </button>
        </div>

        <WifiProvisionModal
          isOpen={isWifiModalOpen}
          onClose={() => setIsWifiModalOpen(false)}
        />

        {/* 라우트 1 — TODAY 페이지 (`/#today` 또는 기본 경로) */}
        {currentPage === 'today' && (
          <div>
            {/* 상단 1열 가로 배치: 복약 순응도 대시보드 */}
            <AdherenceDashboard
              stats={stats}
              activeDaysCount={new Set(logs.map((l) => l.taken_at.slice(0, 10))).size || 1}
            />

            {/* 하단 2열 배치: 좌측 약통별 복용 현황, 우측 실시간 복용 이력 타임라인 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 좌측: 등록 약통 현황 (Card in Card) */}
              <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                <h2 className="text-sm font-bold text-gray-800 mb-3 flex items-center justify-between">
                  <span>약통별 복용 현황</span>
                  <span className="text-xs text-gray-500 font-mono font-normal">
                    {bottles.length}개 약통 등록됨
                  </span>
                </h2>

                <div className="space-y-3">
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
        )}

        {/* 라우트 2 — HISTORY 페이지 (`/#history`) */}
        {currentPage === 'history' && (
          <MedicationHistoryTab logs={logs} bottles={bottles} stats={stats} />
        )}
      </div>
    </div>
  );
}

export default App;
