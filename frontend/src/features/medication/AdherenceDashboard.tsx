import React from 'react';
import type { AdherenceStats } from '../../types';

interface AdherenceDashboardProps {
  stats: AdherenceStats | null;
}

export const AdherenceDashboard: React.FC<AdherenceDashboardProps> = ({ stats }) => {
  const rate = stats?.adherence_rate ?? 0;
  const streak = stats?.streak_days ?? 0;
  const total = stats?.total_logs ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* 1. 복약 순응도 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg relative overflow-hidden">
        <div className="text-xs font-medium text-slate-400 mb-1">이번 주 복약 순응도</div>
        <div className="text-3xl font-extrabold text-[#5DD39E] font-mono">{rate}%</div>
        <div className="w-full bg-slate-800 h-2 rounded-full mt-3 overflow-hidden">
          <div
            className="bg-[#5DD39E] h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(rate, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* 2. 연속 복용 달성 (Streak) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="text-xs font-medium text-slate-400 mb-1">연속 복용 달성 (Streak)</div>
        <div className="text-3xl font-extrabold text-amber-400 font-mono">
          {streak} <span className="text-sm font-sans font-normal text-slate-400">일 연속</span>
        </div>
        <div className="text-xs text-slate-400 mt-2">매일 정해진 시각 복용 수칙을 준수하고 있습니다.</div>
      </div>

      {/* 3. 누적 복용 완료 횟수 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
        <div className="text-xs font-medium text-slate-400 mb-1">누적 성공 기록</div>
        <div className="text-3xl font-extrabold text-slate-100 font-mono">
          {total} <span className="text-sm font-sans font-normal text-slate-400">회</span>
        </div>
        <div className="text-xs text-slate-400 mt-2">Zero-Touch 센서로 자동 감지되어 영속화되었습니다.</div>
      </div>
    </div>
  );
};
