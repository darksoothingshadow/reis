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

    return (
        <div className="flex h-full overflow-hidden flex-col font-inter bg-base-100">
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
