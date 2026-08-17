import React, { useState } from 'react';
import { registerBottle, DuplicateBottleError } from '../../api/client';
import type { Bottle } from '../../types';
import { TimePicker, PRESETS } from './Timepicker';
import {
  IconX,
  IconCheck,
  IconPill,
  IconClock,
  IconChevronDown,
  IconAlertCircle,
  IconLoader2,
  IconPlus,
  IconAlertTriangle,
  IconPencil,
  IconArchive
} from '@tabler/icons-react';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBottleAdded: (newBottle: Bottle) => void;
  existingBottleCount?: number;
  initialBottleId?: string;
}

export const AddBottleModal: React.FC<AddBottleModalProps> = ({
  isOpen,
  onClose,
  onBottleAdded,
  existingBottleCount = 2,
  initialBottleId,
}) => {
  const defaultBottleId = `SmartPillBox_0${existingBottleCount + 1}`;
  const [bottleId, setBottleId] = useState(initialBottleId || defaultBottleId);
  const [pillName, setPillName] = useState('');
  const [targetTime, setTargetTime] = useState('21:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // initialBottleId 변경 시 bottleId 업데이트
  React.useEffect(() => {
    if (isOpen) {
      if (initialBottleId) {
        setBottleId(initialBottleId);
      }
    }
  }, [isOpen, initialBottleId]);

  // 중복 발생 시 안내 모달 데이터
  const [conflictBottle, setConflictBottle] = useState<Bottle | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pillName.trim() || !bottleId.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setConflictBottle(null);

    try {
      const newBottle = await registerBottle(bottleId.trim(), pillName.trim(), targetTime, 'create');
      setIsSubmitting(false);
      onBottleAdded(newBottle);
      handleClose();
    } catch (err: any) {
      console.error('[AddBottleModal Error]', err);
      setIsSubmitting(false);
      if (err instanceof DuplicateBottleError) {
        setConflictBottle(err.existingBottle || { bottle_id: bottleId.trim(), name: '등록된 약통', target_time: '' });
      } else {
        setError(err.message || '약통 등록 중 오류가 발생했습니다.');
      }
    }
  };

  const handleResolveConflict = async (mode: 'update' | 'archive_and_create') => {
    setIsSubmitting(true);
    setError(null);

    try {
      const resolvedBottle = await registerBottle(bottleId.trim(), pillName.trim(), targetTime, mode);
      setIsSubmitting(false);
      setConflictBottle(null);
      onBottleAdded(resolvedBottle);
      handleClose();
    } catch (err: any) {
      console.error('[ResolveConflict Error]', err);
      setIsSubmitting(false);
      setError(err.message || '중복 처리 진행 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setPillName('');
    setError(null);
    setConflictBottle(null);
    setShowTimePicker(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full transition-all duration-200 relative">
        
        {/* ── 중복 안내 & 선택 다이얼로그 Step ────────────────────────── */}
        {conflictBottle ? (
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <IconAlertTriangle size={22} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">이미 등록된 약통 식별 ID입니다</h3>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">
                  <span className="font-mono font-semibold text-amber-700 bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                    {conflictBottle.bottle_id}
                  </span> 기기는 현재 <strong className="text-gray-800">'{conflictBottle.name}'</strong> ({conflictBottle.target_time})으로 사용 중입니다.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-1">
              <div className="text-gray-500 font-semibold">신규 설정 요청 정보:</div>
              <div className="flex items-center justify-between text-gray-700">
                <span>약 이름: <strong className="text-teal-700">{pillName}</strong></span>
                <span>목표 시각: <strong className="text-teal-700">{targetTime}</strong></span>
              </div>
            </div>

            {error && (
              <div className="bg-rose-50 border border-rose-200 rounded-md p-2.5 flex items-center gap-2 text-rose-800 text-xs">
                <IconAlertCircle size={15} className="shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              {/* 옵션 1: 약 정보 변경 */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleResolveConflict('update')}
                className="w-full p-3 rounded-lg border border-teal-200 bg-teal-50/60 hover:bg-teal-100/80 active:bg-teal-200 transition-all text-left group cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <IconPencil size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-teal-900">1. 약 정보 변경하기</div>
                    <div className="text-[11px] text-teal-700">기존 약통의 이름을 '{pillName}'(으)로 업데이트합니다</div>
                  </div>
                </div>
                <IconChevronDown size={16} className="-rotate-90 text-teal-600" />
              </button>

              {/* 옵션 2: 기존 기록 완료 처리 후 새로 시작 */}
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => handleResolveConflict('archive_and_create')}
                className="w-full p-3 rounded-lg border border-indigo-200 bg-indigo-50/60 hover:bg-indigo-100/80 active:bg-indigo-200 transition-all text-left group cursor-pointer flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-md bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <IconArchive size={15} />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-indigo-900">2. 기존 기록 완료(아카이브) 후 새로 시작</div>
                    <div className="text-[11px] text-indigo-700">이전 복용 히스토리를 보존 마감하고 새 약통으로 초기화합니다</div>
                  </div>
                </div>
                <IconChevronDown size={16} className="-rotate-90 text-indigo-600" />
              </button>
            </div>

            {/* Footer / Cancel */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setConflictBottle(null)}
                className="text-xs font-semibold text-gray-500 hover:text-gray-700 hover:underline cursor-pointer"
              >
                ← 입력 정보 다시 수정하기
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-md transition-colors cursor-pointer"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          /* ── 일반 입력 폼 ───────────────────────────────────────────── */
          <>
            {/* Header */}
            <div className="px-5 py-4 bg-white border-b border-gray-100 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                  <IconPlus size={20} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">새 약통 추가 등록</h2>
                  <p className="text-[11px] text-gray-500 font-normal">새로 관리할 약통의 이름과 복용 목표 시각을 등록합니다</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer !text-xs"
                aria-label="닫기"
              >
                <IconX size={18} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* 약통 식별자 ID */}
              <div>
                <label className="block !text-xs font-semibold text-gray-700 mb-0.5">
                  약통 식별 ID (Device ID) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: SmartPillBox_03"
                  value={bottleId}
                  onChange={(e) => setBottleId(e.target.value)}
                  disabled={isSubmitting}
                  className="w-full px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md !text-xs font-mono font-medium text-gray-800 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>

              {/* 약 이름 & 목표 복용 시각 (나란히 수평 배치) */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center h-6 mb-0.5">
                    <label className="block !text-xs font-semibold text-gray-700">
                      약 이름 <span className="text-rose-500">*</span>
                    </label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-gray-400">
                      <IconPill size={14} />
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="예: 취침 전 혈압약"
                      value={pillName}
                      onChange={(e) => setPillName(e.target.value)}
                      disabled={isSubmitting}
                      className="w-full pl-7 pr-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md !text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:border-teal-500 focus:bg-white focus:ring-1 focus:ring-teal-500 transition-all"
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between h-6 mb-0.5">
                    <label className="block !text-xs font-semibold text-gray-700">
                      목표 복용 시각
                    </label>
                    {/* 빠른 선택 프리셋 버튼 */}
                    <div className="flex items-center gap-0.5">
                      {PRESETS.map((p) => {
                        const active = targetTime === p.time;
                        return (
                          <button
                            type="button"
                            key={p.key}
                            onClick={() => setTargetTime(p.time)}
                            className={`px-1 py-0.5 rounded border !text-[10px] font-semibold transition-colors cursor-pointer ${
                              active
                                ? 'bg-teal-500 border-teal-500 text-white'
                                : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:border-gray-300'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowTimePicker(!showTimePicker)}
                    disabled={isSubmitting}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-md !text-xs font-medium text-gray-800 hover:bg-white hover:border-teal-400 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2 text-teal-600">
                      <IconClock size={14} />
                      <span className="font-bold text-teal-700">{targetTime}</span>
                    </div>
                    <IconChevronDown size={14} className="text-gray-400" />
                  </button>

                  {/* TimePicker 휠 전용 드롭다운 팝오버 */}
                  {showTimePicker && (
                    <div className="absolute right-0 top-full mt-1 z-50 shadow-xl rounded-xl animate-fade-in border border-gray-200 bg-white p-2.5 w-44">
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowTimePicker(false)}
                          className="absolute -top-1 -right-1 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 z-20 cursor-pointer"
                        >
                          <IconX size={14} />
                        </button>
                        <TimePicker
                          value={targetTime}
                          onChange={(t) => setTargetTime(t)}
                          showPresets={false}
                          showHeader={false}
                          className="w-full bg-white"
                        />
                        <div className="mt-2 pt-1.5 border-t border-gray-100 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowTimePicker(false)}
                            className="px-2.5 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-md font-semibold !text-xs shadow-2xs cursor-pointer"
                          >
                            선택 완료
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* 에러 메시지 */}
              {error && (
                <div className="bg-rose-50 border border-rose-200 rounded-md p-2.5 flex items-center gap-2 text-rose-800 !text-xs">
                  <IconAlertCircle size={15} className="shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting || !pillName.trim() || !bottleId.trim()}
                className={`w-full py-2.5 px-4 rounded-md !text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                  isSubmitting || !pillName.trim() || !bottleId.trim()
                    ? 'bg-gray-300 shadow-none cursor-not-allowed text-gray-500'
                    : 'bg-teal-600 hover:bg-teal-700 active:bg-teal-800'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <IconLoader2 size={15} className="animate-spin" />
                    <span>등록 처리 중...</span>
                  </>
                ) : (
                  <>
                    <IconCheck size={15} />
                    <span>약통 등록 완료</span>
                  </>
                )}
              </button>
            </form>

            {/* Footer */}
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500 rounded-b-xl">
              <span>새로운 약통 정보가 메인 복용 현황판에 즉시 추가됩니다.</span>
              <button
                type="button"
                onClick={handleClose}
                className="hover:underline font-semibold text-gray-600 cursor-pointer !text-xs"
              >
                취소
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
};
