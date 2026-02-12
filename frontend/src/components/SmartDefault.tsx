import { useState, useEffect } from 'react';

import { ActionIcon, Button, Card, NumberInput, Skeleton, Text } from '@mantine/core';

import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { SmartDefaultData } from '../types';

export type SetEntry = { weight: number; reps: number };

type SmartDefaultProps = {
  data: SmartDefaultData | null;
  isLoading: boolean;
  onConfirm: (sets: SetEntry[]) => void;
};

type RowErrors = { weight?: string; reps?: string };

function validateRow(entry: SetEntry): RowErrors {
  const errors: RowErrors = {};
  if (entry.weight < 0) errors.weight = ERROR_MESSAGES.weight.min;
  if (entry.weight > 999.9) errors.weight = ERROR_MESSAGES.weight.max;
  if (entry.reps < 1) errors.reps = ERROR_MESSAGES.reps.min;
  if (entry.reps > 999) errors.reps = ERROR_MESSAGES.reps.max;
  return errors;
}

export function SmartDefault({ data, isLoading, onConfirm }: SmartDefaultProps) {
  const [sets, setSets] = useState<SetEntry[]>([{ weight: 0, reps: 0 }]);
  const [errors, setErrors] = useState<RowErrors[]>([{}]);

  // data가 바뀌면 제안값으로 세트 목록 초기화
  useEffect(() => {
    if (!data) return;
    const initialSets = Array.from({ length: data.suggestedSets }, () => ({
      weight: data.suggestedWeight,
      reps: data.suggestedReps,
    }));
    setSets(initialSets);
    setErrors(initialSets.map(() => ({})));
  }, [data]);

  if (isLoading) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder className="w-full mt-3">
        <Skeleton height={16} width="40%" mb="sm" />
        <Skeleton height={36} mb="xs" />
        <Skeleton height={36} mb="xs" />
        <Skeleton height={36} />
      </Card>
    );
  }

  if (!data) return null;

  function updateSet(index: number, field: keyof SetEntry, value: number) {
    setSets((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    setErrors((prev) =>
      prev.map((e, i) => (i === index ? { ...e, [field]: undefined } : e)),
    );
  }

  function addSet() {
    const last = sets[sets.length - 1] ?? { weight: 0, reps: 0 };
    setSets((prev) => [...prev, { ...last }]);
    setErrors((prev) => [...prev, {}]);
  }

  function removeSet(index: number) {
    if (sets.length === 1) return;
    setSets((prev) => prev.filter((_, i) => i !== index));
    setErrors((prev) => prev.filter((_, i) => i !== index));
  }

  function handleConfirm() {
    const newErrors = sets.map(validateRow);
    const hasError = newErrors.some((e) => Object.keys(e).length > 0);
    if (hasError) {
      setErrors(newErrors);
      return;
    }
    onConfirm(sets);
  }

  const isNew = data.basedOnDate === null;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder className="w-full mt-3">
      <Text fw={600} size="sm" c="dimmed" mb="xs">목표 설정</Text>

      {isNew && (
        <Text size="xs" c="blue" mb="sm">
          처음 사용하는 기구입니다. 세트별 목표 무게와 횟수를 입력하세요.
        </Text>
      )}
      {!isNew && data.basedOnDate && (
        <Text size="xs" c="dimmed" mb="sm">
          {new Date(data.basedOnDate).toLocaleDateString('ko-KR')} 기록 기준
        </Text>
      )}

      {/* 헤더 */}
      <div className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-x-2! mb-1!">
        <Text size="xs" c="dimmed" fw={500} className="text-center">세트</Text>
        <Text size="xs" c="dimmed" fw={500}>무게 (kg)</Text>
        <Text size="xs" c="dimmed" fw={500}>횟수</Text>
        <div />
      </div>

      {/* 세트 행 목록 */}
      {sets.map((set, i) => (
        <div key={i} className="grid grid-cols-[2rem_1fr_1fr_2rem] gap-x-2 items-start mb-2!">
          <Text size="sm" c="dimmed" className="pt-2 text-center">{i + 1}</Text>
          <NumberInput
            value={set.weight}
            onChange={(v) => updateSet(i, 'weight', Number(v))}
            min={0}
            max={999.9}
            step={2.5}
            decimalScale={1}
            error={errors[i]?.weight}
            aria-label={`${i + 1}세트 무게`}
          // style={{ maxWidth: '20rem' }}
          />
          <NumberInput
            value={set.reps}
            onChange={(v) => updateSet(i, 'reps', Number(v))}
            min={1}
            max={999}
            error={errors[i]?.reps}
            aria-label={`${i + 1}세트 횟수`}
          />
          <ActionIcon
            variant="subtle"
            color="red"
            onClick={() => removeSet(i)}
            disabled={sets.length === 1}
            className="mt-1"
            aria-label={`${i + 1}세트 삭제`}
          >
            ×
          </ActionIcon>
        </div>
      ))}

      <Button variant="subtle" size="xs" onClick={addSet} mb="md" fullWidth>
        + 세트 추가
      </Button>

      <Button onClick={handleConfirm} fullWidth>
        확인
      </Button>
    </Card>
  );
}
