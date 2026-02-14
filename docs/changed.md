# 변경 이력

## 대시보드 데이터 구조 변경 — 세트 단위 평탄화 → 로그 단위

[SmartDefault 화면 플로우 설계](./smartdefault_screen_flow.md)에서 운동 로그를 `in_progress → completed` 두 단계로 분리하면서, 대시보드는 로그 단위(`completed` 상태)로 데이터를 다루는 구조로 전환했다.

### 변경 전

**대시보드 갱신 플로우:**
```
확인 클릭 → 즉시 DB 저장 → set_logged WS 이벤트 수신
→ useDashboard의 set_logged 핸들러가 세트를 목록 상단에 즉시 삽입
→ 대시보드 즉시 반영 (API 재조회 없음)
```

**데이터 구조:**
```
백엔드 응답:
[
  { id: "log1", equipment_name: "레그프레스", sets: [...], started_at, ended_at },
  { id: "log2", equipment_name: "레그프레스", sets: [...], started_at, ended_at },
]

fetchTodayLogs에서 평탄화:
→ DashboardEntry[] (세트 단위 배열)

Dashboard에서 groupByEquipment:
→ equipmentName 기준으로 재그룹핑
```

### 변경 후

**대시보드 갱신 플로우:**
```
확인 클릭 → in_progress로 DB 저장 (대시보드 미반영)
→ [운동 완료] 클릭 → completed로 DB 업데이트
→ refetch() 호출 → API 재조회 → 대시보드 반영
(set_logged WS 핸들러 제거, refetch()로 대체)
```

**데이터 구조:**
```
백엔드 응답: 동일
[
  { id: "log1", equipment_name: "레그프레스", sets: [...], started_at, ended_at },
  { id: "log2", equipment_name: "레그프레스", sets: [...], started_at, ended_at },
]

fetchTodayLogs에서 평탄화 안 함:
→ DashboardLog[] (로그 단위 배열, 백엔드 구조 그대로)

Dashboard에서 groupByEquipment 없음:
→ log.id 기준으로 카드 1개씩 렌더링
→ 카드 헤더에 started_at ~ ended_at (소요시간) 표시
```
