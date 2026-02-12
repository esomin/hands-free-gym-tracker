import { Badge, Card, Skeleton, Text } from '@mantine/core';

import type { DashboardEntry } from '../types';

type DashboardProps = {
  entries:   DashboardEntry[];
  isLoading: boolean;
};

export function Dashboard({ entries, isLoading }: DashboardProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} height={88} radius="md" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="flex items-center justify-center h-40">
        <Text c="dimmed" size="sm">오늘 기록된 운동이 없습니다.</Text>
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {entries.map((entry, i) => (
        <Card key={i} shadow="sm" padding="sm" radius="md" withBorder>
          <div className="flex items-center justify-between mb-1">
            <Text fw={600} size="sm">{entry.equipmentName}</Text>
            <Badge size="sm" variant="light">{entry.setNumber}세트</Badge>
          </div>
          <Text size="xl" fw={700}>
            {entry.weight}kg × {entry.reps}회
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {new Date(entry.loggedAt).toLocaleTimeString('ko-KR', {
              hour:   '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </Card>
      ))}
    </div>
  );
}
