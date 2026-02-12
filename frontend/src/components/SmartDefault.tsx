import { useState, useEffect } from 'react';

import { Button, Card, NumberInput, Skeleton, Text } from '@mantine/core';

import { ERROR_MESSAGES } from '../constants/errorMessages';
import type { SmartDefaultData } from '../types';

type SmartDefaultProps = {
  data: SmartDefaultData | null;
  isLoading: boolean;
  onConfirm: (weight: number, reps: number, sets: number) => void;
};

type FormErrors = {
  weight?: string;
  reps?: string;
  sets?: string;
};

function validate(weight: number, reps: number, sets: number): FormErrors {
  const errors: FormErrors = {};
  if (weight < 0)     errors.weight = ERROR_MESSAGES.weight.min;
  if (weight > 999.9) errors.weight = ERROR_MESSAGES.weight.max;
  if (reps < 1)       errors.reps   = ERROR_MESSAGES.reps.min;
  if (reps > 999)     errors.reps   = ERROR_MESSAGES.reps.max;
  if (sets < 1)       errors.sets   = ERROR_MESSAGES.sets.min;
  return errors;
}

export function SmartDefault({ data, isLoading, onConfirm }: SmartDefaultProps) {
  const [weight, setWeight] = useState(0);
  const [reps,   setReps]   = useState(0);
  const [sets,   setSets]   = useState(1);
  const [errors, setErrors] = useState<FormErrors>({});

  // data가 바뀌면 입력값을 제안값으로 초기화
  useEffect(() => {
    if (!data) return;
    setWeight(data.suggestedWeight);
    setReps(data.suggestedReps);
    setSets(data.suggestedSets);
    setErrors({});
  }, [data]);

  if (isLoading) {
    return (
      <Card shadow="sm" padding="md" radius="md" withBorder className="w-full mt-3">
        <Skeleton height={16} width="40%" mb="sm" />
        <Skeleton height={36} mb="sm" />
        <Skeleton height={36} mb="sm" />
        <Skeleton height={36} />
      </Card>
    );
  }

  if (!data) return null;

  function handleConfirm() {
    const errs = validate(weight, reps, sets);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    onConfirm(weight, reps, sets);
  }

  const isNew = data.basedOnDate === null;

  return (
    <Card shadow="sm" padding="md" radius="md" withBorder className="w-full mt-3">
      <Text fw={600} size="sm" c="dimmed" mb="xs">목표 설정</Text>

      {isNew && (
        <Text size="xs" c="blue" mb="sm">
          처음 사용하는 기구입니다. 목표 무게와 횟수를 입력하세요.
        </Text>
      )}
      {!isNew && data.basedOnDate && (
        <Text size="xs" c="dimmed" mb="sm">
          {new Date(data.basedOnDate).toLocaleDateString('ko-KR')} 기록 기준
        </Text>
      )}

      <NumberInput
        label="무게 (kg)"
        value={weight}
        onChange={(v) => { setWeight(Number(v)); setErrors((e) => ({ ...e, weight: undefined })); }}
        min={0}
        max={999.9}
        step={2.5}
        decimalScale={1}
        error={errors.weight}
        mb="xs"
      />
      <NumberInput
        label="횟수"
        value={reps}
        onChange={(v) => { setReps(Number(v)); setErrors((e) => ({ ...e, reps: undefined })); }}
        min={1}
        max={999}
        error={errors.reps}
        mb="xs"
      />
      <NumberInput
        label="세트 수"
        value={sets}
        onChange={(v) => { setSets(Number(v)); setErrors((e) => ({ ...e, sets: undefined })); }}
        min={1}
        max={99}
        error={errors.sets}
        mb="md"
      />

      <Button onClick={handleConfirm} fullWidth>
        확인
      </Button>
    </Card>
  );
}
