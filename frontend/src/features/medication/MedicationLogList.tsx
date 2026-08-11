import React from 'react';
import type { MedicationLog, Bottle } from '../../types';

interface MedicationLogListProps {
  logs: MedicationLog[];
  bottles: Bottle[];
}

export const MedicationLogList: React.FC<MedicationLogListProps> = ({ logs, bottles }) => {
  const bottleMap = new Map(bottles.map((b) => [b.bottle_id, b.name]));

  if (logs.length === 0) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
        아직 기록된 복용 이력이 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-lg">
      <h3 className="text-md font-semibold text-slate-200 mb-4 flex items-center justify-between">
        <span>실시간 복용 이력 타임라인</span>
        <span className="text-xs text-slate-400 font-mono">총 {logs.length}건</span>
      </h3>

      <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
        {logs.map((log) => {
          const bottleName = bottleMap.get(log.bottle_id) || log.bottle_id;
          const logDate = new Date(log.taken_at);

          return (
            <div
              key={log.id || `${log.bottle_id}-${log.taken_at}`}
              className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-700/50 text-sm"
            >
              <div className="flex items-center gap-3">
                <div className="w-2.5 h-2.5 rounded-full bg-[#5DD39E]"></div>
                <div>
                  <div className="font-medium text-slate-100">{bottleName}</div>
                  <div className="text-xs font-mono text-slate-400">{log.bottle_id}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-[#5DD39E]">복용 완료</div>
                <div className="text-xs text-slate-400 font-mono">
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
