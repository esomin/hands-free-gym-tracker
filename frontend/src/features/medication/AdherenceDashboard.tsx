import React from 'react';
import type { AdherenceStats } from '../../types';

interface AdherenceDashboardProps {
  stats: AdherenceStats | null;
}

export const AdherenceDashboard: React.FC<AdherenceDashboardProps & { activeDaysCount?: number }> = ({
  stats,
  activeDaysCount = 1,
}) => {
  const rate = stats?.adherence_rate ?? 0;
  const streak = stats?.streak_days ?? 0;
  const total = stats?.total_logs ?? 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {/* 1. 복약 순응도 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
        <div className="text-xs font-semibold text-gray-500 mb-1">이번 주 복약 순응도</div>
        <div className="text-2xl font-extrabold text-teal-600 font-mono">{rate}%</div>
        <div className="w-full bg-gray-100 h-2 rounded-full mt-2.5 overflow-hidden">
          <div
            className="bg-teal-500 h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(rate, 100)}%` }}
          ></div>
        </div>
      </div>

      {/* 2. 연속 복용 달성 (Streak) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
        <div className="text-xs font-semibold text-gray-500 mb-1">연속 복용 달성 (Streak)</div>
        <div className="text-2xl font-extrabold text-amber-500 font-mono">
          {streak} <span className="text-xs font-sans font-normal text-gray-400">일 연속</span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1">매일 빠짐없이 연속으로 챙겨 드신 기간입니다.</div>
      </div>

      {/* 3. 누적 성공 기록 */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
        <div className="text-xs font-semibold text-gray-500 mb-1">누적 성공 기록</div>
        <div className="text-2xl font-extrabold text-gray-900 font-mono flex items-baseline gap-2">
          <span>{total} <span className="text-xs font-sans font-normal text-gray-400">회</span></span>
          <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full font-sans">
            총 {activeDaysCount}일간
          </span>
        </div>
        <div className="text-[11px] text-gray-400 mt-1">서비스 시작 후 총 {activeDaysCount}일 동안 {total}회 복용을 완료했습니다.</div>
      </div>
    </div>
  );
};
