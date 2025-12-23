import type { DateInfo } from '../../types/calendarTypes';

interface CalendarHeaderProps {
    days: { full: string; short: string }[];
    weekDates: DateInfo[];
    todayIndex: number;
    holidaysByDay: Record<number, string | null>;
}

export function CalendarHeader({ days, weekDates, todayIndex, holidaysByDay }: CalendarHeaderProps) {
    return (
        <div className="flex border-b border-base-300 bg-base-100 flex-shrink-0 h-[48px]">
            {/* Empty space for time column */}
            <div className="w-12 border-r border-base-300 bg-base-200"></div>

            {days.map((day, index) => {
                const dateInfo = weekDates[index];
                const isToday = index === todayIndex;
                const holiday = holidaysByDay[index];

                return (
                    <div
                        key={index}
                        className={`flex-1 py-1 px-2 text-center border-r border-base-300 last:border-r-0 
                                   ${isToday ? 'bg-current-day-header' : ''}`}
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className={`text-base font-semibold leading-tight ${holiday ? 'text-error' : isToday ? 'text-current-day' : 'text-base-content'}`}>
                                {dateInfo?.day}
                            </div>
                            <div className={`text-xs leading-tight ${holiday ? 'text-error' : 'text-content-secondary'}`}>
                                {day.full}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
