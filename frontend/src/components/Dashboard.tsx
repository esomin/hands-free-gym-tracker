import { Card, Skeleton, Text } from '@mantine/core';

import type { DashboardEntry } from '../types';

type DashboardProps = {
  entries:   DashboardEntry[];
  isLoading: boolean;
};

type EquipmentGroup = {
  equipmentName: string;
  sets:          DashboardEntry[];
  latestLoggedAt: string;
};

function groupByEquipment(entries: DashboardEntry[]): EquipmentGroup[] {
  const map = new Map<string, EquipmentGroup>();

  for (const entry of entries) {
    const existing = map.get(entry.equipmentName);
    if (existing) {
      existing.sets.push(entry);
      if (entry.loggedAt > existing.latestLoggedAt) {
        existing.latestLoggedAt = entry.loggedAt;
      }
    } else {
      map.set(entry.equipmentName, {
        equipmentName:  entry.equipmentName,
        sets:           [entry],
        latestLoggedAt: entry.loggedAt,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => a.latestLoggedAt.localeCompare(b.latestLoggedAt))
    .map((group) => ({
      ...group,
      sets: [...group.sets].sort((a, b) => a.setNumber - b.setNumber),
    }));
}

export function Dashboard({ entries, isLoading }: DashboardProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} height={120} radius="md" />
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

  const groups = groupByEquipment(entries);

  return (
    <div className="grid grid-cols-2 gap-3">
      {groups.map((group) => (
        <Card key={group.equipmentName} shadow="sm" padding="md" radius="md" withBorder>
          <Text fw={700} size="md" mb="sm">{group.equipmentName}</Text>

          {/* 헤더 */}
          <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-x-3 mb-1">
            <Text size="xs" c="dimmed" fw={500} className="text-center">세트</Text>
            <Text size="xs" c="dimmed" fw={500}>무게</Text>
            <Text size="xs" c="dimmed" fw={500}>횟수</Text>
            <Text size="xs" c="dimmed" fw={500}>시간</Text>
          </div>

          {/* 세트 행 */}
          {group.sets.map((set) => (
            <div
              key={`${set.setNumber}-${set.loggedAt}`}
              className="grid grid-cols-[2rem_1fr_1fr_auto] gap-x-3 py-1 border-t border-gray-100"
            >
              <Text size="sm" c="dimmed" className="text-center">{set.setNumber}</Text>
              <Text size="sm" fw={600}>{set.weight}kg</Text>
              <Text size="sm" fw={600}>{set.reps}회</Text>
              <Text size="xs" c="dimmed" className="self-center">
                {new Date(set.loggedAt).toLocaleTimeString('ko-KR', {
                  hour:   '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
