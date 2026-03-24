import { useEffect, useRef } from 'react';

import {
  IoCheckmarkCircleOutline,
  IoFitnessOutline,
  IoLocateOutline,
  IoPlayOutline,
  IoTrophyOutline,
  IoWalkOutline,
} from 'react-icons/io5';

export type DemoLogEntry = {
  id:        string;
  elapsed:   number;   // 데모 시작으로부터 경과 초
  label:     string;
  icon:      React.ReactNode;
  highlight: boolean;  // 완료 계열 이벤트 강조
};

type DemoTimelineProps = {
  entries: DemoLogEntry[];
};

export function DemoTimeline({ entries }: DemoTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 새 항목 추가 시 최신 항목으로 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries.length]);

  if (entries.length === 0) return null;

  return (
    <div
      style={{
        marginTop:    '0.75rem',
        background:   '#f8fafc',
        border:       '1px solid #e2e8f0',
        borderRadius: '0.5rem',
        padding:      '0.75rem',
      }}
    >
      <div
        style={{
          fontSize:     '0.7rem',
          fontWeight:   700,
          color:        '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem',
        }}
      >
        Demo Log
      </div>

      <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
        {entries.map((entry) => (
          <div
            key={entry.id}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         '0.5rem',
              padding:     '0.2rem 0',
              color:       entry.highlight ? '#7c3aed' : '#475569',
              fontWeight:  entry.highlight ? 700 : 400,
              fontSize:    '0.78rem',
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '0.68rem', minWidth: '2.2rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatElapsed(entry.elapsed)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {entry.icon}
            </span>
            <span>{entry.label}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

// 경과 초 → MM:SS 포맷
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// WebSocket 이벤트 → DemoLogEntry 변환 헬퍼
export function buildDemoLogEntry(
  event: { type: string; payload: Record<string, unknown> },
  elapsed: number,
): DemoLogEntry | null {
  const id = `${Date.now()}-${Math.random()}`;

  switch (event.type) {
    case 'tumbler_state_changed': {
      const state = event.payload.state as string;
      if (state === 'moving') {
        return { id, elapsed, label: '텀블러 이동 중', icon: <IoWalkOutline />, highlight: false };
      }
      if (state === 'settled') {
        return { id, elapsed, label: '텀블러 거치됨', icon: <IoLocateOutline />, highlight: false };
      }
      return null;
    }
    case 'equipment_detected': {
      const name       = event.payload.equipmentName as string;
      const confidence = Math.round((event.payload.confidence as number) * 100);
      return {
        id, elapsed,
        label:     `${name} 식별 (신뢰도 ${confidence}%)`,
        icon:      <IoFitnessOutline />,
        highlight: false,
      };
    }
    case 'demo_workout_started': {
      const sets = (event.payload.sets as unknown[]).length;
      return {
        id, elapsed,
        label:     `운동 시작 — ${sets}세트 기록`,
        icon:      <IoPlayOutline />,
        highlight: false,
      };
    }
    case 'demo_workout_completed':
      return { id, elapsed, label: '운동 완료', icon: <IoCheckmarkCircleOutline />, highlight: false };
    case 'demo_scenario_completed':
      return { id, elapsed, label: '데모 완료', icon: <IoTrophyOutline />, highlight: true };
    default:
      return null;
  }
}
