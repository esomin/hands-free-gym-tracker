import { useState } from 'react';

import { Text } from '@mantine/core';

import type { DashboardLog } from '../types';
import { Dashboard } from './Dashboard';
import { WorkoutHistoryCalendar } from './WorkoutHistoryCalendar';

type WorkoutLogTabsProps = {
  userId:    string;
  logs:      DashboardLog[];  // App.tsx의 useDashboard 에서 전달 (오늘 로그)
  isLoading: boolean;
};

// 다이어리 탭 스타일 — 활성 탭이 컨텐츠 영역과 이어지는 색인 탭 형태

const tabBaseStyle: React.CSSProperties = {
  width:           '36px',
  height:          '80px',
  padding:         0,
  borderRadius:    '6px 0 0 6px',
  border:          '1px solid #dee2e6',
  borderRight:     'none',
  backgroundColor: '#f1f3f5',
  display:         'flex',
  alignItems:      'center',
  justifyContent:  'center',
  cursor:          'pointer',
  marginBottom:    '4px',
  marginRight:     '-1px',  // 패널 좌측 테두리와 겹쳐 연결감 부여
};

const tabActiveStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  boxShadow:       '-2px 0 4px rgba(0,0,0,0.06)',
  zIndex:          10,
};

const tabLabelStyle: React.CSSProperties = {
  writingMode:     'vertical-rl',
  textOrientation: 'mixed',
  fontSize:        '11px',
  fontWeight:      600,
  letterSpacing:   '0.05em',
  userSelect:      'none',
  color:           '#495057',
};

type TabValue = 'today' | 'history';

export function WorkoutLogTabs({ userId, logs, isLoading }: WorkoutLogTabsProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('today');

  const today = new Date();

  return (
    <div className="flex">
      {/* 수직 탭 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '36px' }}>
        {(['today', 'history'] as TabValue[]).map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ ...tabBaseStyle, ...(isActive ? tabActiveStyle : {}) }}
            >
              <span style={tabLabelStyle}>
                {tab === 'today' ? '오늘' : '기록'}
              </span>
            </button>
          );
        })}
      </div>

      {/* 컨텐츠 영역 */}
      <div
        className="flex-1 overflow-y-auto pl-3"
        style={{ borderLeft: '1px solid #dee2e6' }}
      >
        {activeTab === 'today' && (
          <div className="flex flex-col gap-2">
            <Text size="xs" c="dimmed">
              {today.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
            </Text>
            <Dashboard logs={logs} isLoading={isLoading} />
          </div>
        )}

        {activeTab === 'history' && (
          <WorkoutHistoryCalendar userId={userId} />
        )}
      </div>
    </div>
  );
}
