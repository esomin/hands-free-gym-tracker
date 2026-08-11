import React from 'react';
import type { MedicationLog, Bottle } from '../../types';

interface MedicationLogListProps {
  logs: MedicationLog[];
  bottles: Bottle[];
}

const BOTTLE_NAME_FALLBACK: Record<string, string> = {
  BOTTLE_01: '아침 유산균',
  BOTTLE_02: '점심 비타민 B',
  BOTTLE_03: '취침 전 비염약',
};

export const MedicationLogList: React.FC<MedicationLogListProps> = ({ logs, bottles }) => {
  const bottleMap = new Map(bottles.map((b) => [b.bottle_id, b.name]));

  if (logs.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-xs text-gray-500 shadow-xs">
        아직 기록된 복용 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center justify-between">
        <span>실시간 복용 이력 타임라인</span>
        <span className="text-xs text-gray-500 font-mono font-normal">총 {logs.length}건</span>
      </h3>

      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {logs.map((log) => {
          const bottleName = bottleMap.get(log.bottle_id) || BOTTLE_NAME_FALLBACK[log.bottle_id] || log.bottle_id;
          const logDate = new Date(log.taken_at);

          return (
            <div
              key={log.id || `${log.bottle_id}-${log.taken_at}`}
              className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                <div>
                  <div className="font-semibold text-gray-800">{bottleName}</div>
                  <div className="text-[11px] font-mono text-gray-400">{log.bottle_id}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-teal-600">복용 완료</div>
                <div className="text-[11px] text-gray-400 font-mono">
                  {logDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
