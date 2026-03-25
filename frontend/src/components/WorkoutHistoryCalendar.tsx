import { useEffect, useState } from 'react';

import { Calendar } from '@mantine/dates';
import { Text } from '@mantine/core';
import dayjs from 'dayjs';

import { fetchWorkoutDatesInMonth } from '../api/client';
import { useDashboard } from '../hooks/useDashboard';
import { Dashboard } from './Dashboard';

type WorkoutHistoryCalendarProps = {
  userId: string;
};

export function WorkoutHistoryCalendar({ userId }: WorkoutHistoryCalendarProps) {
  const today = new Date(); // ex. 2026-03-25T17:16:27+09:00

  // 선택된 날짜 (기본값: 오늘)
  const [selectedDate, setSelectedDate] = useState<Date>(today);

  // 캘린더에 표시 중인 월 (기본값: 이번 달)
  const [currentMonth, setCurrentMonth] = useState<Date>(today);

  // 해당 월에 운동 기록이 있는 날짜 집합 ("YYYY-MM-DD")
  const [workoutDates, setWorkoutDates] = useState<Set<string>>(new Set());

  // 선택된 날짜의 운동 로그
  const { logs, isLoading } = useDashboard(userId, selectedDate);

  // 표시 월이 바뀔 때마다 운동 기록 날짜 조회
  useEffect(() => {
    fetchWorkoutDatesInMonth(userId, currentMonth)
      .then(setWorkoutDates)
      .catch(() => {
        // dot 미표시로 처리, 캘린더는 정상 동작
        setWorkoutDates(new Set());
      });
  }, [userId, currentMonth.getFullYear(), currentMonth.getMonth()]);

  return (
    <div className="flex flex-col gap-4">
      <Calendar
        size='xs'
        // 표시 월
        date={currentMonth}
        onDateChange={(date) => setCurrentMonth(new Date(date))}
        // 미래 날짜 비활성
        maxDate={today}
        // 오늘 날짜 강조
        highlightToday
        // 날짜 클릭 및 선택 하이라이트 — getDayProps로 직접 처리
        // (Mantine 8 Calendar의 value/onChange는 날짜 선택이 아닌 월 이동용)
        getDayProps={(date) => ({
          selected: dayjs(date).isSame(selectedDate, 'day'),
          onClick: () => setSelectedDate(new Date(date)),
        })}
        // 운동한 날 dot 표시
        renderDay={(date) => {
          const key = dayjs(date).format('YYYY-MM-DD');
          const hasWorkout = workoutDates.has(key);
          return (
            <div className="relative flex items-center justify-center w-full h-full">
              <span>{dayjs(date).date()}</span>
              {hasWorkout && (
                <span
                  className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500"
                />
              )}
            </div>
          );
        }}
      />

      {/* 선택된 날짜 표시 */}
      <Text size="sm" fw={600} c="dimmed">
        {dayjs(selectedDate).format('YYYY년 M월 D일')}
      </Text>

      {/* 선택된 날짜의 운동 로그 */}
      <Dashboard logs={logs} isLoading={isLoading} />
    </div>
  );
}
