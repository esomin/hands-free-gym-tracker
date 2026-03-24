import { useState } from 'react';

import { IoGameControllerSharp } from 'react-icons/io5';

import { injectDemoEvent, resetDemoState } from '../api/client';

type DemoPanelProps = {
  userId: string;
  onReset: () => void;
};

// 텀블러 상태 주입 페이로드
function tumblerPayload(state: 'moving' | 'settled') {
  return { state, transitionedAt: new Date().toISOString() };
}

// 기구 감지 주입 페이로드
const EQUIPMENT_PAYLOADS: Record<string, { equipmentId: string; equipmentName: string }> = {
  bench: { equipmentId: 'demo-bench-press', equipmentName: '벤치프레스' },
  legPress: { equipmentId: 'demo-leg-press', equipmentName: '레그프레스' },
};

export function DemoPanel({ userId, onReset }: DemoPanelProps) {
  // 패널 접기/펼치기 상태
  const [collapsed, setCollapsed] = useState(false);
  // 현재 로딩 중인 버튼 키 (null이면 모두 활성)
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  // 버튼 클릭 → API 호출 → loadingKey 해제
  async function handleInject(
    key: string,
    type: 'tumbler_state_changed' | 'equipment_detected',
    payload: Record<string, unknown>,
  ) {
    setLoadingKey(key);
    try {
      await injectDemoEvent(userId, type, payload);
    } finally {
      setLoadingKey(null);
    }
  }

  async function handleReset() {
    setLoadingKey('reset');
    try {
      await resetDemoState(userId);
      onReset();
    } finally {
      setLoadingKey(null);
    }
  }

  // 접힌 상태: 탭 아이콘만 표시
  if (collapsed) {
    return (
      <div
        style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          background: 'rgba(109, 40, 217, 0.85)',
          borderRadius: '0.75rem',
          padding: '0.5rem 0.75rem',
          cursor: 'pointer',
          color: '#fff',
          fontSize: '0.8rem',
          fontWeight: 600,
          backdropFilter: 'blur(6px)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
        }}
        onClick={() => setCollapsed(false)}
      >
        <IoGameControllerSharp size={20} /> Demo
      </div>
    );
  }

  const disabled = loadingKey !== null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        background: 'rgba(255, 255, 255, 0.88)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(109, 40, 217, 0.25)',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        padding: '1.5rem',
        width: '300px',
        fontFamily: 'sans-serif',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.9rem' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#5b21b6', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
          <IoGameControllerSharp size={20} /> Demo Panel
        </span>
        <button
          onClick={() => setCollapsed(true)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: '#888' }}
        >
          접기 ▼
        </button>
      </div>

      {/* 안내 문구 */}
      <p style={{ fontSize: '0.78rem', color: '#666', margin: '0 0 1.1rem', lineHeight: 1.4 }}>
        이동 중 → 거치됨 → 기구 감지 순서로 조작하세요
      </p>

      {/* STEP 1: 텀블러 상태 */}
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
          STEP 1 — 텀블러 상태
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <PanelButton
            label={loadingKey === 'moving' ? '...' : '이동 중'}
            disabled={disabled}
            onClick={() => handleInject('moving', 'tumbler_state_changed', tumblerPayload('moving'))}
          />
          <PanelButton
            label={loadingKey === 'settled' ? '...' : '거치됨'}
            disabled={disabled}
            onClick={() => handleInject('settled', 'tumbler_state_changed', tumblerPayload('settled'))}
          />
        </div>
      </div>

      {/* STEP 2: 기구 감지 */}
      <div style={{ marginBottom: '1.1rem' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#888', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
          STEP 2 — 기구 감지
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <PanelButton
            label={loadingKey === 'bench' ? '...' : '벤치프레스'}
            disabled={disabled}
            onClick={() =>
              handleInject('bench', 'equipment_detected', {
                ...EQUIPMENT_PAYLOADS.bench,
                confidence: 0.97,
                detectedAt: new Date().toISOString(),
              })
            }
          />
          <PanelButton
            label={loadingKey === 'legPress' ? '...' : '레그프레스'}
            disabled={disabled}
            onClick={() =>
              handleInject('legPress', 'equipment_detected', {
                ...EQUIPMENT_PAYLOADS.legPress,
                confidence: 0.97,
                detectedAt: new Date().toISOString(),
              })
            }
          />
        </div>
      </div>

      {/* 구분선 */}
      <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.8rem 0' }} />

      {/* 초기화 버튼 */}
      <button
        disabled={disabled}
        onClick={handleReset}
        style={{
          width: '100%',
          padding: '0.35rem',
          fontSize: '0.78rem',
          fontWeight: 600,
          background: disabled ? '#e5e7eb' : '#fef2f2',
          color: disabled ? '#aaa' : '#dc2626',
          border: '1px solid',
          borderColor: disabled ? '#e5e7eb' : '#fca5a5',
          borderRadius: '0.4rem',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        {loadingKey === 'reset' ? '초기화 중...' : '초기화'}
      </button>
    </div>
  );
}

// 내부용 버튼 컴포넌트
function PanelButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      style={{
        flex: 1,
        padding: '0.3rem 0.2rem',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: disabled ? '#f3f4f6' : '#ede9fe',
        color: disabled ? '#aaa' : '#5b21b6',
        border: '1px solid',
        borderColor: disabled ? '#e5e7eb' : '#c4b5fd',
        borderRadius: '0.4rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background 0.15s',
      }}
    >
      {label}
    </button>
  );
}
