export const ERROR_MESSAGES = {
  equipmentName: {
    required: '기구 이름을 입력해주세요.',
    maxLength: '기구 이름은 50자 이하로 입력해주세요.',
  },
  weight: {
    min: '무게는 0 이상이어야 합니다.',
    max: '무게는 999.9kg 이하로 입력해주세요.',
    invalid: '올바른 숫자를 입력해주세요.',
  },
  reps: {
    min: '횟수는 1 이상이어야 합니다.',
    max: '횟수는 999 이하로 입력해주세요.',
  },
  sets: {
    min: '세트 수는 1 이상이어야 합니다.',
  },
  websocket: {
    connectionFailed: '서버 연결에 실패했습니다. 재연결을 시도합니다.',
    reconnecting: '연결이 끊어졌습니다. 재연결 중...',
    invalidEvent: '알 수 없는 이벤트가 수신되었습니다.',
  },
  api: {
    networkError: '네트워크 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
    serverError: '서버 오류가 발생했습니다. 문제가 지속되면 고객센터에 문의해주세요.',
    notFound: '요청한 데이터를 찾을 수 없습니다.',
  },
  workoutHistory: {
    fetchFailed: '운동 기록 조회에 실패했습니다.',
    monthFetchFailed: '이달의 운동 현황을 불러오지 못했습니다.',
  },
} as const;
