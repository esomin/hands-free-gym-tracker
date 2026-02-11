import { useState } from 'react';

import { Button, Group, Modal, Text, TextInput } from '@mantine/core';

import { ERROR_MESSAGES } from '../constants/errorMessages';

type EquipmentRegisterModalProps = {
  open: boolean;
  fingerprintId: string;
  onRegister: (equipmentName: string) => Promise<void>;
  onDismiss: () => void;
};

export function EquipmentRegisterModal({
  open,
  fingerprintId,
  onRegister,
  onDismiss,
}: EquipmentRegisterModalProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function validate(value: string): string | null {
    if (!value.trim()) return ERROR_MESSAGES.equipmentName.required;
    if (value.length > 50) return ERROR_MESSAGES.equipmentName.maxLength;
    return null;
  }

  async function handleSubmit() {
    const validationError = validate(name);
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    try {
      await onRegister(name.trim());
      setName('');
      setError(null);
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    setName('');
    setError(null);
    onDismiss();
  }

  return (
    <Modal
      opened={open}
      onClose={handleDismiss}
      title="새 기구 등록"
      centered
    >
      <Text size="sm" c="dimmed" mb="md">
        처음 감지된 기구입니다. 이름을 입력하면 다음부터 자동으로 인식됩니다.
      </Text>
      <Text size="xs" c="dimmed" mb="xs">
        지문 ID: {fingerprintId}
      </Text>
      <TextInput
        label="기구 이름"
        placeholder="예: 레그프레스"
        value={name}
        onChange={(e) => {
          setName(e.currentTarget.value);
          setError(null);
        }}
        error={error}
        maxLength={50}
        mb="md"
      />
      <Group justify="flex-end">
        <Button variant="default" onClick={handleDismiss} disabled={loading}>
          취소
        </Button>
        <Button onClick={handleSubmit} loading={loading}>
          등록
        </Button>
      </Group>
    </Modal>
  );
}
