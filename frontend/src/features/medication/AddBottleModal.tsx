import React, { useState } from 'react';
import { registerBottle } from '../../api/client';
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
  IconPlus
} from '@tabler/icons-react';

interface AddBottleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBottleAdded: (newBottle: Bottle) => void;
  existingBottleCount?: number;
}

export const AddBottleModal: React.FC<AddBottleModalProps> = ({
  isOpen,
  onClose,
  onBottleAdded,
  existingBottleCount = 2,
}) => {
  const defaultBottleId = `SmartPillBox_0${existingBottleCount + 1}`;
  const [bottleId, setBottleId] = useState(defaultBottleId);
  const [pillName, setPillName] = useState('');
  const [targetTime, setTargetTime] = useState('21:00');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pillName.trim() || !bottleId.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const newBottle = await registerBottle(bottleId.trim(), pillName.trim(), targetTime);
      setIsSubmitting(false);
      onBottleAdded(newBottle);
      handleClose();
    } catch (err: any) {
      console.error('[AddBottleModal Error]', err);
      setIsSubmitting(false);
      setError(err.message || '약통 등록 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setPillName('');
    setError(null);
    setShowTimePicker(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-2xs p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 max-w-md w-full transition-all duration-200 relative">
        
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

      </div>
    </div>
  );
};
