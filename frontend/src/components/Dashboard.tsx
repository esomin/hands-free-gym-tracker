import { Card, Text } from '@mantine/core';

import type { DashboardLog } from '../types';

type DashboardProps = {
  logs: DashboardLog[];
};

function parseUTC(iso: string): Date {
  // Motor(PyMongo)가 반환하는 naive datetime은 타임존 표시가 없으나 실제로는 UTC
  // 타임존 표시가 없으면 'Z'를 붙여 UTC로 강제 해석
  const utcIso = iso.endsWith('Z') || iso.includes('+') ? iso : iso + 'Z';
  return new Date(utcIso);
}

function formatTime(iso: string) {
  return parseUTC(iso).toLocaleTimeString('ko-KR', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZone: 'Asia/Seoul',
  });
}

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return formatTime(startedAt);
  const diffMs  = parseUTC(endedAt).getTime() - parseUTC(startedAt).getTime();
  const diffMin = Math.round(diffMs / 60000);
  return `${formatTime(startedAt)} ~ ${formatTime(endedAt)} (${diffMin}분)`;
}

export function Dashboard({ logs }: DashboardProps) {
  if (logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <Text c="dimmed" size="sm">기록된 운동이 없습니다.</Text>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
{logs.map((log) => (
        <Card key={log.id} shadow="sm" padding="md" radius="md" withBorder>
          {/* 카드 헤더: 기구명 + 시작~완료 (소요시간) */}
          <div className="flex items-baseline justify-between mb-2">
            <Text fw={700} size="md">{log.equipmentName}</Text>
            <Text size="xs" c="dimmed">{formatDuration(log.startedAt, log.endedAt)}</Text>
          </div>

          {/* 컬럼 헤더 */}
          <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 mb-1">
            <Text size="xs" c="dimmed" fw={500} className="text-center">세트</Text>
            <Text size="xs" c="dimmed" fw={500}>무게</Text>
            <Text size="xs" c="dimmed" fw={500}>횟수</Text>
          </div>

          {/* 세트 행 */}
          {log.sets.map((set) => (
            <div
              key={set.setNumber}
              className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 py-1 border-t border-gray-100"
            >
              <Text size="sm" c="dimmed" className="text-center">{set.setNumber}</Text>
              <Text size="sm" fw={600}>{set.weight}kg</Text>
              <Text size="sm" fw={600}>{set.reps}회</Text>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
