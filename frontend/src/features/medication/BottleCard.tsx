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
    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-gray-100 text-gray-600 border border-gray-200">
      복용 대기 중
    </span>
  );

  if (isTakenToday) {
    statusBadge = (
      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        오늘 복용 완료
      </span>
    );
  } else if (isPouring) {
    statusBadge = (
      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
        알약 털어넣는 중 (110°)
      </span>
    );
  } else if (isMoving) {
    statusBadge = (
      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
        약통 기울이는 중 (45°)
      </span>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs hover:border-indigo-300 transition-all duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
          {bottle.bottle_id}
        </span>
        {statusBadge}
      </div>

      <h3 className="text-base font-bold text-gray-900 mb-1">{bottle.name}</h3>

      <div className="flex items-center justify-between text-xs text-gray-500 mt-3 pt-3 border-t border-gray-100">
        <div>
          <span className="text-[11px] text-gray-400 block">목표 복용 시각</span>
          <span className="font-semibold text-gray-700">{bottle.target_time}</span>
        </div>
        {lastTakenTime && (
          <div className="text-right">
            <span className="text-[11px] text-gray-400 block">최근 복용 시각</span>
            <span className="font-semibold text-teal-600">
              {new Date(lastTakenTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
