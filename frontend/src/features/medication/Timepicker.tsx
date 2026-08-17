import React, { useMemo, useRef, useEffect } from 'react';

export interface TimePickerProps {
    value?: string; // "HH:mm" 24시간제
    onChange?: (time: string) => void;
    label?: string;
    showPresets?: boolean;
    showHeader?: boolean;
    className?: string;
}

export const PRESETS = [
    { key: 'morning', label: '아침', time: '08:00' },
    { key: 'lunch', label: '점심', time: '12:30' },
    { key: 'evening', label: '저녁', time: '18:30' },
    { key: 'bedtime', label: '취침 전', time: '22:00' },
];

const HOURS_24 = Array.from({ length: 24 }, (_, i) => i); // 0,1,2...23
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

const ITEM_HEIGHT = 32;
const VISIBLE_COUNT = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_COUNT;

// 스크롤 휠 하나의 컬럼
const WheelColumn: React.FC<{
    items: (string | number)[];
    selected: string | number;
    onSelect: (v: string | number) => void;
    formatItem?: (v: string | number) => string;
}> = ({ items, selected, onSelect, formatItem }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const isProgrammaticScroll = useRef(false);
    const timerRef = useRef<number | null>(null);

    useEffect(() => {
        const idx = items.findIndex((it) => it === selected);
        if (idx >= 0 && containerRef.current) {
            isProgrammaticScroll.current = true;
            containerRef.current.scrollTop = idx * ITEM_HEIGHT;
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                isProgrammaticScroll.current = false;
            }, 100);
        }
    }, [selected, items]);

    const handleScroll = () => {
        if (!containerRef.current || isProgrammaticScroll.current) return;
        const idx = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
        const clamped = Math.min(Math.max(idx, 0), items.length - 1);
        const val = items[clamped];
        if (val !== selected) {
            onSelect(val);
        }
    };

    const handleScrollEnd = () => {
        if (!containerRef.current) return;
        const idx = Math.round(containerRef.current.scrollTop / ITEM_HEIGHT);
        const clamped = Math.min(Math.max(idx, 0), items.length - 1);
        containerRef.current.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: 'smooth' });
    };

    return (
        <div className="relative" style={{ height: WHEEL_HEIGHT }}>
            {/* 선택 하이라이트 밴드 */}
            <div
                className="absolute left-0 right-0 top-1/2 -translate-y-1/2 bg-teal-50 border-y border-teal-200 pointer-events-none rounded-md z-0"
                style={{ height: ITEM_HEIGHT }}
            />
            <div
                ref={containerRef}
                onScroll={handleScroll}
                onTouchEnd={handleScrollEnd}
                onMouseUp={handleScrollEnd}
                className="relative z-10 h-full overflow-y-scroll snap-y snap-mandatory scrollbar-none"
                style={{
                    scrollSnapType: 'y mandatory',
                    paddingTop: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
                    paddingBottom: (WHEEL_HEIGHT - ITEM_HEIGHT) / 2,
                }}
            >
                {items.map((it) => {
                    const isSelected = it === selected;
                    return (
                        <div
                            key={it}
                            onClick={() => onSelect(it)}
                            className="snap-center flex items-center justify-center cursor-pointer select-none font-mono transition-colors"
                            style={{ height: ITEM_HEIGHT }}
                        >
                            <span
                                className={
                                    isSelected
                                        ? '!text-sm font-bold text-teal-700'
                                        : '!text-xs font-medium text-gray-300'
                                }
                            >
                                {formatItem ? formatItem(it) : it}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export const TimePicker: React.FC<TimePickerProps> = ({
    value = '08:00',
    onChange,
    label = '복용 시간 설정',
    showPresets = true,
    showHeader = true,
    className = 'bg-white border border-gray-200 rounded-xl p-4 shadow-xs w-full',
}) => {
    // 외부 value 프로퍼티에서 시/분 파싱 (순수 제어 컴포넌트 구조)
    const [vh, vm] = useMemo(() => {
        const [h, m] = (value || '08:00').split(':').map(Number);
        return [isNaN(h) ? 8 : h, isNaN(m) ? 0 : m];
    }, [value]);

    const activePreset = PRESETS.find((p) => p.time === value);

    const handleSelectHour = (newHour: string | number) => {
        const hStr = String(newHour).padStart(2, '0');
        const mStr = String(vm).padStart(2, '0');
        onChange?.(`${hStr}:${mStr}`);
    };

    const handleSelectMinute = (newMinute: string | number) => {
        const hStr = String(vh).padStart(2, '0');
        const mStr = String(newMinute).padStart(2, '0');
        onChange?.(`${hStr}:${mStr}`);
    };

    const applyPreset = (presetTime: string) => {
        onChange?.(presetTime);
    };

    return (
        <div className={className}>
            {showHeader && (
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-bold text-gray-800">{label}</h2>
                    <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {value}
                    </span>
                </div>
            )}

            {/* 빠른 선택 프리셋 (옵션) */}
            {showPresets && (
                <div className="grid grid-cols-4 gap-1.5 mb-3">
                    {PRESETS.map((p) => {
                        const active = p.key === activePreset?.key;
                        return (
                            <button
                                type="button"
                                key={p.key}
                                onClick={() => applyPreset(p.time)}
                                className={`py-1.5 rounded-md border !text-xs font-semibold transition-colors cursor-pointer ${active
                                        ? 'bg-teal-500 border-teal-500 text-white'
                                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                                    }`}
                            >
                                {p.label}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 시 / 분 스크롤 휠 */}
            <div className="grid grid-cols-2 gap-2 border-t border-gray-100 pt-2">
                <WheelColumn
                    items={HOURS_24}
                    selected={vh}
                    onSelect={handleSelectHour}
                    formatItem={(v) => String(v).padStart(2, '0')}
                />
                <WheelColumn
                    items={MINUTES}
                    selected={vm}
                    onSelect={handleSelectMinute}
                    formatItem={(v) => String(v).padStart(2, '0')}
                />
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-[10px] text-gray-400 mt-1">
                <span>시</span>
                <span>분</span>
            </div>
        </div>
    );
};

export default TimePicker;