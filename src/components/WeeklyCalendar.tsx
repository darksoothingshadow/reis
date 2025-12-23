/**
 * WeeklyCalendar - Vertical calendar layout.
 * 
 * Decomposed into:
 * - useCalendarLogic: Data and date handling
 * - CalendarHeader: Top date/day row
 * - CalendarGrid: Time axis and background grid
 * - DayColumn: Individual day rendering with events
 */

import { useCalendarLogic } from '../hooks/ui/useCalendarLogic';
import { CalendarHeader } from './Calendar/CalendarHeader';
import { CalendarGrid } from './Calendar/CalendarGrid';
import { DayColumn } from './Calendar/DayColumn';
import type { BlockLesson } from '../types/calendarTypes';
import { useOutlookSync } from '../hooks/data';

import { useState } from 'react';
import { X } from 'lucide-react';

const DAYS = [
    { index: 0, short: 'Po', full: 'Pondělí' },
    { index: 1, short: 'Út', full: 'Úterý' },
    { index: 2, short: 'St', full: 'Středa' },
    { index: 3, short: 'Čt', full: 'Čtvrtek' },
    { index: 4, short: 'Pá', full: 'Pátek' },
];

interface WeeklyCalendarProps {
    initialDate?: Date;
    onSelectLesson: (lesson: BlockLesson) => void;
}

export function WeeklyCalendar({ initialDate = new Date(), onSelectLesson }: WeeklyCalendarProps) {
    const {
        weekDates,
        lessonsByDay,
        holidaysByDay,
        todayIndex,
        showSkeleton
    } = useCalendarLogic(initialDate);

    // Smart Sync Tip Logic:
    // Only show if sync is NOT enabled.
    const { isEnabled: isSyncEnabled } = useOutlookSync();
    // If user enables sync, this component re-renders and the tip disappears naturally if we condition it.
    // Ideally we want: if (outlookSyncEnabled) return null;
    const [isDismissed, setIsDismissed] = useState(() => {
        return localStorage.getItem('reis_outlook_banner_dismissed') === 'true';
    });

    if (isDismissed && !isSyncEnabled) return null;

    return (
        <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
            {/* Native Outlook Connect Banner */}
            {!isSyncEnabled && !isDismissed && (
                <div className="mx-4 mt-2 alert alert-info/10 border-info/20 shadow-sm py-2 px-3 flex flex-row items-center justify-between min-h-0 rounded-lg">
                    <div className="flex items-center gap-2">
                        <span className="text-sm">Nechceš vidět výuku a zkoušky přímo v Outlook kalendáři?</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => document.dispatchEvent(new CustomEvent('reis-open-settings'))}
                            className="btn btn-xs btn-ghost border border-base-content/20 hover:bg-base-content/10 font-normal shrink-0"
                        >
                            Připojit
                        </button>
                        <button 
                            onClick={() => {
                                setIsDismissed(true);
                                localStorage.setItem('reis_outlook_banner_dismissed', 'true');
                            }}
                            className="btn btn-xs btn-circle btn-ghost opacity-50 hover:opacity-100"
                            aria-label="Zavřít"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
            <CalendarHeader 
                days={DAYS}
                weekDates={weekDates}
                todayIndex={todayIndex}
                holidaysByDay={holidaysByDay}
            />

            <div className="flex-1 overflow-hidden">
                <CalendarGrid>
                    {DAYS.map((_, dayIndex) => (
                        <DayColumn
                            key={dayIndex}
                            lessons={lessonsByDay[dayIndex] || []}
                            isToday={dayIndex === todayIndex}
                            holiday={holidaysByDay[dayIndex]}
                            showSkeleton={showSkeleton}
                            onSelectLesson={onSelectLesson}
                        />
                    ))}
                </CalendarGrid>
            </div>
        </div>
    );
}
