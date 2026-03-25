import { useEffect, useState } from 'react';

import { Calendar } from '@mantine/dates';
import { Card, Divider, Text } from '@mantine/core';
import dayjs from 'dayjs';

import { fetchWorkoutDatesInMonth } from '../../api/client';
import { useDashboard } from '../../hooks/useDashboard';
import { Dashboard } from '../workout/Dashboard';

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

  // 달 이동 핸들러 — 같은 날짜 유지, 해당 월 말일 초과 시 말일로 클램핑
  function handleMonthChange(newMonth: Date) {
    const lastDayOfNewMonth = new Date(
      newMonth.getFullYear(), newMonth.getMonth() + 1, 0
    ).getDate();
    const clampedDay = Math.min(selectedDate.getDate(), lastDayOfNewMonth);
    setSelectedDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), clampedDay));
    setCurrentMonth(newMonth);
  }

  // 표시 월이 바뀔 때마다 운동 기록 날짜 조회
  useEffect(() => {
    fetchWorkoutDatesInMonth(userId, currentMonth)
      .then(setWorkoutDates)
      .catch(() => {
        setWorkoutDates(new Set());
      });
  }, [userId, currentMonth.getFullYear(), currentMonth.getMonth()]);

  return (
    <div className="flex flex-col gap-3">

      {/* 캘린더 블록 */}
      <Card shadow="sm" padding="sm" radius="md" withBorder className="py-8!">
        <Calendar
          className='flex justify-center'
          date={currentMonth}
          onDateChange={(date) => handleMonthChange(new Date(date))}
          maxDate={today}
          highlightToday
          getDayProps={(date) => {
            const isSelected = dayjs(date).isSame(selectedDate, 'day');
            return {
              selected: isSelected,
              onClick:  () => setSelectedDate(new Date(date)),
              // 선택된 날짜 색상 — Mantine 기본 selected(파랑)와 구분되는 주황색
              style: isSelected
                ? { backgroundColor: '#f97316', color: '#fff', borderRadius: '50%' }
                : undefined,
            };
          }}
          renderDay={(date) => {
            const key = dayjs(date).format('YYYY-MM-DD');
            const hasWorkout = workoutDates.has(key);
            return (
              <div className="relative flex items-center justify-center w-full h-full">
                <span>{dayjs(date).date()}</span>
                {hasWorkout && (
                  <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-green-500" />
                )}
              </div>
            );
          }}
        />
      </Card>

      {/* 선택된 날짜 + 로그 블록 */}
      <Card shadow="sm" padding="sm" radius="md" withBorder>
        <Text size="sm" fw={600} mb="xs">
          {dayjs(selectedDate).format('YYYY년 M월 D일')}
        </Text>
        <Divider mb="sm" />
        <Dashboard logs={logs} />
      </Card>

    </div >
  );
}
