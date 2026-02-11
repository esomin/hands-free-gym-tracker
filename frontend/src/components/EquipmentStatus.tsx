import { Badge, Card, Text } from '@mantine/core';

import type { EquipmentDetectedPayload, TumblerStatePayload } from '../types';

type EquipmentStatusProps = {
  equipment: EquipmentDetectedPayload | null;
  tumblerState: TumblerStatePayload | null;
};

// 텀블러 상태별 뱃지 색상·라벨
const STATE_BADGE: Record<string, { color: string; label: string }> = {
  moving:  { color: 'gray',  label: '이동 중' },
  settled: { color: 'green', label: '거치됨 · 기구 점유' },
};

export function EquipmentStatus({ equipment, tumblerState }: EquipmentStatusProps) {
  const state = tumblerState?.state ?? 'moving';
  const badge = STATE_BADGE[state];

  return (
    // 모바일: 전체 너비 / 데스크톱: 사이드패널 너비는 부모가 결정
    <Card shadow="sm" padding="md" radius="md" withBorder className="w-full">
      <div className="flex items-center justify-between mb-2">
        <Text fw={600} size="sm" c="dimmed">현재 기구</Text>
        <Badge color={badge.color} variant="filled" size="md">
          {badge.label}
        </Badge>
      </div>

      {equipment ? (
        <>
          <Text fw={700} size="lg">{equipment.equipmentName}</Text>
          <Text size="xs" c="dimmed" mt={4}>
            인식 신뢰도 {Math.round(equipment.confidence * 100)}%
          </Text>
        </>
      ) : (
        <Text size="sm" c="dimmed">
          {state === 'settled' ? '기구를 인식하는 중...' : '텀블러를 기구 옆에 내려놓으세요.'}
        </Text>
      )}
    </Card>
  );
}
