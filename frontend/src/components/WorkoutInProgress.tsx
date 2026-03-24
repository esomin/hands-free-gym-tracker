import { useState } from 'react';

import { ActionIcon, Button, Card, NumberInput, Text } from '@mantine/core';

import type { SetEntry } from './SmartDefault';

type WorkoutInProgressProps = {
  sets:          SetEntry[];
  onComplete:    () => Promise<void>;
  onUpdateSets:  (sets: SetEntry[]) => Promise<void>;
};

export function WorkoutInProgress({ sets, onComplete, onUpdateSets }: WorkoutInProgressProps) {
  const [isEditing,   setIsEditing]   = useState(false);
  const [editSets,    setEditSets]    = useState<SetEntry[]>(sets);
  const [completing,  setCompleting]  = useState(false);
  const [updating,    setUpdating]    = useState(false);

  async function handleComplete() {
    setCompleting(true);
    try {
      await onComplete();
    } finally {
      setCompleting(false);
    }
  }

  function handleEditStart() {
    setEditSets([...sets]);
    setIsEditing(true);
  }

  async function handleUpdateConfirm() {
    setUpdating(true);
    try {
      await onUpdateSets(editSets);
      setIsEditing(false);
    } finally {
      setUpdating(false);
    }
  }

  function updateEditSet(index: number, field: keyof SetEntry, value: number) {
    setEditSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addEditSet() {
    const last = editSets[editSets.length - 1] ?? { weight: 0, reps: 0 };
    setEditSets((prev) => [...prev, { ...last }]);
  }

  function removeEditSet(index: number) {
    if (editSets.length === 1) return;
    setEditSets((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder className="w-full mt-3 min-w-[300px]">
      <Text fw={600} size="sm" c="dimmed" mb="xs">운동 기록 중</Text>
      {isEditing ? (
        <>
          {/* 편집 모드 */}
          <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-x-2 mb-1">
            <Text size="xs" c="dimmed" fw={500} className="text-center">세트</Text>
            <Text size="xs" c="dimmed" fw={500}>무게 (kg)</Text>
            <Text size="xs" c="dimmed" fw={500}>횟수</Text>
            <div />
          </div>

          {editSets.map((set, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-x-2 items-start mb-2">
              <Text size="sm" c="dimmed" className="pt-2 text-center">{i + 1}</Text>
              <NumberInput
                value={set.weight}
                onChange={(v) => updateEditSet(i, 'weight', Number(v))}
                min={0}
                max={999.9}
                step={2.5}
                decimalScale={1}
                aria-label={`${i + 1}세트 무게`}
              />
              <NumberInput
                value={set.reps}
                onChange={(v) => updateEditSet(i, 'reps', Number(v))}
                min={1}
                max={999}
                aria-label={`${i + 1}세트 횟수`}
              />
              <ActionIcon
                variant="subtle"
                color="red"
                onClick={() => removeEditSet(i)}
                disabled={editSets.length === 1}
                className="mt-1"
                aria-label={`${i + 1}세트 삭제`}
              >
                ×
              </ActionIcon>
            </div>
          ))}

          <Button variant="subtle" size="xs" onClick={addEditSet} mb="md" fullWidth>
            + 세트 추가
          </Button>

          <Button onClick={handleUpdateConfirm} fullWidth loading={updating} disabled={updating}>
            확인
          </Button>
        </>
      ) : (
        <>
          {/* 읽기 전용 모드 */}
          <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 mb-1">
            <Text size="xs" c="dimmed" fw={500} className="text-center">세트</Text>
            <Text size="xs" c="dimmed" fw={500}>무게</Text>
            <Text size="xs" c="dimmed" fw={500}>횟수</Text>
          </div>

          {sets.map((set, i) => (
            <div key={i} className="grid grid-cols-[2rem_1fr_1fr] gap-x-3 py-1 border-t border-gray-100">
              <Text size="sm" c="dimmed" className="text-center">{i + 1}</Text>
              <Text size="sm" fw={600}>{set.weight}kg</Text>
              <Text size="sm" fw={600}>{set.reps}회</Text>
            </div>
          ))}

          <div className="flex gap-2 mt-4">
            <Button variant="default" size="sm" flex={1} onClick={handleEditStart}>
              목표 수정
            </Button>
            <Button size="sm" flex={1} onClick={handleComplete} loading={completing} disabled={completing}>
              운동 완료
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
