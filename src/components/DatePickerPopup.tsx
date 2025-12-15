import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday
} from 'date-fns';
import { cs } from 'date-fns/locale';
import type { ExamTerm, ExamSubject } from '../types/exams';

interface DatePickerPopupProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (termId: string) => void;
    terms: ExamTerm[];
    anchorRef: React.RefObject<HTMLElement | null>;
    allExams?: ExamSubject[];
}

export function DatePickerPopup({
    isOpen,
    onClose,
    onConfirm,
    terms,
    anchorRef,
    allExams = []
}: DatePickerPopupProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [selectedTermId, setSelectedTermId] = useState<string | null>(null);
    const [position, setPosition] = useState({ top: 0, left: 0 });

    // Calculate position - prefer below anchor, flip above if needed
    useEffect(() => {
        if (isOpen && anchorRef.current) {
            const rect = anchorRef.current.getBoundingClientRect();
            const popupWidth = 260;
            const popupHeight = 420; // Approximate max height
            const padding = 12;

            let left = rect.left;
            let top = rect.bottom + 4; // Try below first

            // Check right boundary
            if (left + popupWidth > window.innerWidth - padding) {
                left = rect.right - popupWidth;
            }
            if (left < padding) {
                left = padding;
            }

            // Check bottom boundary - flip above if not enough space
            if (top + popupHeight > window.innerHeight - padding) {
                top = rect.top - popupHeight - 4; // Position above
                // If still not enough space above, just position at top with scroll
                if (top < padding) {
                    top = padding;
                }
            }

            setPosition({ top, left });
        }
    }, [isOpen, anchorRef]);

    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(null);
            setSelectedTermId(null);
            if (terms.length > 0) {
                const [day, month, year] = terms[0].date.split('.').map(Number);
                setCurrentDate(new Date(year, month - 1, day));
            }
        }
    }, [isOpen, terms]);

    // Handle click outside - uses ref check
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        // Only close if clicking the backdrop itself
        if (e.target === e.currentTarget) {
            onClose();
        }
    }, [onClose]);

    // Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Available dates from terms
    const availableDates = useMemo(() => {
        const dates: { date: Date; dateStr: string; isFull: boolean }[] = [];
        const seen = new Set<string>();

        terms.forEach(term => {
            if (!seen.has(term.date)) {
                seen.add(term.date);
                const [day, month, year] = term.date.split('.').map(Number);
                const termsOnDate = terms.filter(t => t.date === term.date);
                const allFull = termsOnDate.every(t => t.full);
                dates.push({
                    date: new Date(year, month - 1, day),
                    dateStr: term.date,
                    isFull: allFull
                });
            }
        });
        return dates;
    }, [terms]);

    // Other registered exams
    const otherRegisteredDates = useMemo(() => {
        const dates: { date: Date; label: string }[] = [];
        allExams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered' && section.registeredTerm?.date) {
                    const [day, month, year] = section.registeredTerm.date.split('.').map(Number);
                    dates.push({
                        date: new Date(year, month - 1, day),
                        label: subject.name
                    });
                }
            });
        });
        return dates;
    }, [allExams]);

    // Terms for selected date
    const termsForSelectedDate = useMemo(() => {
        if (!selectedDate) return [];
        return terms.filter(t => t.date === selectedDate);
    }, [selectedDate, terms]);

    // Calendar data
    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentDate]);

    const weeks = useMemo(() => {
        const weeksArray = [];
        for (let i = 0; i < days.length; i += 7) {
            weeksArray.push(days.slice(i, i + 7));
        }
        return weeksArray;
    }, [days]);

    const daysOfWeek = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

    if (!isOpen) return null;

    return (
        // Full-screen invisible backdrop that captures outside clicks
        <div
            className="fixed inset-0 z-[100]"
            onClick={handleBackdropClick}
        >
            {/* The popup */}
            <div
                ref={popupRef}
                className="absolute bg-white rounded-xl shadow-popover-heavy border border-slate-200 w-[260px]"
                style={{ top: position.top, left: position.left }}
                onClick={e => e.stopPropagation()}
            >
                {/* Calendar */}
                <div className="p-3">
                    {/* Month Header */}
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-slate-700 capitalize">
                            {format(currentDate, 'LLLL yyyy', { locale: cs })}
                        </span>
                        <div className="flex gap-0.5">
                            <button
                                onClick={() => setCurrentDate(subMonths(currentDate, 1))}
                                className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setCurrentDate(addMonths(currentDate, 1))}
                                className="w-6 h-6 flex items-center justify-center hover:bg-slate-200 rounded text-slate-500"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Days Header */}
                    <div className="grid grid-cols-7 gap-0">
                        {daysOfWeek.map((day, i) => (
                            <div key={i} className="h-6 flex items-center justify-center text-[10px] font-medium text-slate-400 uppercase">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Date Grid */}
                    <div className="flex flex-col">
                        {weeks.map((week, weekIndex) => (
                            <div key={weekIndex} className="grid grid-cols-7">
                                {week.map((day) => {
                                    const dateInfo = availableDates.find(d => isSameDay(d.date, day));
                                    const hasAvailableExam = !!dateInfo && !dateInfo.isFull;
                                    const isFull = dateInfo?.isFull ?? false;
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const isTodayDate = isToday(day);
                                    const isSelected = dateInfo && selectedDate === dateInfo.dateStr;
                                    const otherExam = otherRegisteredDates.find(d => isSameDay(d.date, day));

                                    return (
                                        <div
                                            key={day.toString()}
                                            className={`flex flex-col items-center justify-start relative ${otherExam ? 'h-12' : 'h-8'}`}
                                        >
                                            <button
                                                onClick={() => {
                                                    if (hasAvailableExam && dateInfo) {
                                                        setSelectedDate(dateInfo.dateStr);
                                                        setSelectedTermId(null);
                                                    }
                                                }}
                                                disabled={!hasAvailableExam}
                                                className={`
                                                    w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all relative
                                                    ${isSelected
                                                        ? 'bg-primary text-white font-bold shadow-sm'
                                                        : hasAvailableExam
                                                            ? 'bg-primary text-white font-bold hover:bg-primary/80 cursor-pointer shadow-sm'
                                                            : isFull
                                                                ? 'text-slate-300 cursor-default line-through'
                                                                : isTodayDate
                                                                    ? 'bg-slate-100 ring-2 ring-slate-400 text-slate-700 font-semibold cursor-default'
                                                                    : isCurrentMonth
                                                                        ? 'text-slate-400 cursor-default'
                                                                        : 'text-slate-200 cursor-default'
                                                    }
                                                `}
                                            >
                                                {format(day, 'd')}
                                            </button>

                                            {/* Today label */}
                                            {isTodayDate && !hasAvailableExam && (
                                                <span className="text-[8px] font-medium text-slate-500 mt-0.5">Dnes</span>
                                            )}

                                            {/* Mini event preview for other exams */}
                                            {otherExam && (
                                                <div
                                                    className="text-[7px] text-error font-medium mt-0.5 max-w-[32px] truncate text-center"
                                                    title={otherExam.label}
                                                >
                                                    {otherExam.label.split(' - ')[0]}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-primary flex items-center justify-center text-white font-bold text-[8px] shadow-sm">15</span>
                            Volný termín
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="w-4 h-4 rounded-full bg-slate-100 ring-2 ring-slate-400 flex items-center justify-center text-slate-700 font-semibold text-[8px]">12</span>
                            Dnes
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="text-[7px] text-error font-medium">ALG</span>
                            Jiná zkouška
                        </span>
                    </div>
                </div>

                {/* Time Selector */}
                {selectedDate && (
                    <div className="px-3 pb-2 border-t border-slate-200 pt-2 bg-white">
                        <div className="text-[10px] font-medium text-slate-500 mb-1.5">Vyber čas:</div>
                        <div className="flex flex-wrap gap-1.5">
                            {termsForSelectedDate.map(term => (
                                <button
                                    key={term.id}
                                    onClick={() => setSelectedTermId(term.id)}
                                    disabled={term.full}
                                    className={`
                                        btn btn-xs font-medium h-auto py-1 px-2 min-h-0
                                        ${term.full
                                            ? 'btn-disabled bg-slate-100 text-slate-300'
                                            : selectedTermId === term.id
                                                ? 'btn-primary text-white'
                                                : 'btn-ghost bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                                        }
                                    `}
                                >
                                    {term.time}
                                    {term.capacity && <span className="ml-0.5 opacity-60">({term.capacity})</span>}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Confirm Button */}
                {selectedTermId && (
                    <div className="px-3 pb-3 bg-white">
                        <button
                            onClick={() => onConfirm(selectedTermId)}
                            className="btn btn-primary btn-sm w-full"
                        >
                            Potvrdit
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
