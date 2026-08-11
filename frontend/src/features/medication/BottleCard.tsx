import React from 'react';
import type { Bottle, BottleState } from '../../types';

interface BottleCardProps {
  bottle: Bottle;
  isTakenToday: boolean;
  currentState?: BottleState;
  lastTakenTime?: string;
}

export const BottleCard: React.FC<BottleCardProps> = ({
  bottle,
  isTakenToday,
  currentState = 'idle',
  lastTakenTime,
}) => {
  const isPouring = currentState === 'pouring';
  const isMoving = currentState === 'moving';

  let statusBadge = (
    <span className="px-3 py-1 text-xs font-semibold rounded-full bg-gray-700 text-gray-300 border border-gray-600">
      복용 대기 중
    </span>
  );

  if (isTakenToday) {
    statusBadge = (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-950 text-[#5DD39E] border border-[#5DD39E]/40">
        오늘 복용 완료
      </span>
    );
  } else if (isPouring) {
    statusBadge = (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-rose-950 text-rose-300 border border-rose-600 animate-pulse">
        알약 털어넣는 중 (110°)
      </span>
    );
  } else if (isMoving) {
    statusBadge = (
      <span className="px-3 py-1 text-xs font-semibold rounded-full bg-amber-950 text-amber-300 border border-amber-600">
        약통 기울이는 중 (45°)
      </span>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg hover:border-[#5DD39E]/50 transition-all duration-200">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
          {bottle.bottle_id}
        </span>
        {statusBadge}
      </div>

      <h3 className="text-lg font-bold text-slate-100 mb-1">{bottle.name}</h3>

      <div className="flex items-center justify-between text-sm text-slate-400 mt-4 pt-3 border-t border-slate-800/80">
        <div>
          <span className="text-xs text-slate-500 block">목표 복용 시각</span>
          <span className="font-semibold text-slate-200">{bottle.target_time}</span>
        </div>
        {lastTakenTime && (
          <div className="text-right">
            <span className="text-xs text-slate-500 block">최근 복용 시각</span>
            <span className="font-semibold text-[#5DD39E]">
              {new Date(lastTakenTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
