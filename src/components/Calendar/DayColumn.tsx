import type { BlockLesson } from '../../types/calendarTypes';
import { CalendarEventCard } from '../CalendarEventCard';
import { getEventStyle, organizeLessons } from '../../hooks/ui/useCalendarLogic';

interface DayColumnProps {
    lessons: BlockLesson[];
    isToday: boolean;
    holiday: string | null;
    showSkeleton: boolean;
    onSelectLesson: (lesson: BlockLesson) => void;
}

export function DayColumn({ lessons, isToday, holiday, showSkeleton, onSelectLesson }: DayColumnProps) {
    const { lessons: organizedLessons, totalRows } = organizeLessons(lessons);

    return (
        <div className={`flex-1 relative ${isToday ? 'bg-current-day' : ''}`}>
            {/* Holiday overlay */}
            {holiday && (
                <div className="absolute inset-0 flex items-center justify-center bg-error/10 z-20">
                    <div className="flex flex-col items-center text-center p-4">
                        <span className="text-3xl mb-2">🇨🇿</span>
                        <h3 className="text-lg font-bold text-error">{holiday}</h3>
                        <span className="text-sm text-error/80 font-medium uppercase tracking-wider mt-1">
                            Státní svátek
                        </span>
                    </div>
                </div>
            )}

            {/* Skeleton */}
            {!holiday && showSkeleton && (
                <>
                    {[
                        { top: '7%', height: '15%' },  // ~8:00 - 10:00
                        { top: '30%', height: '12%' }, // ~11:00 - 12:30
                        { top: '50%', height: '11%' }  // ~13:30 - 15:00
                    ].map((pos, i) => (
                        <div 
                            key={i}
                            className="absolute w-[94%] left-[3%] rounded-lg skeleton bg-base-300"
                            style={{ 
                                top: pos.top, 
                                height: pos.height 
                            }}
                        />
                    ))}
                </>
            )}

            {/* Events */}
            {!holiday && !showSkeleton && organizedLessons.map((lesson) => {
                const style = getEventStyle(lesson.startTime, lesson.endTime);
                const hasOverlap = totalRows > 1;

                return (
                    <div
                        key={lesson.id}
                        className="absolute"
                        style={{
                            top: style.top,
                            height: style.height,
                            left: hasOverlap ? `${(lesson.row / totalRows) * 100}%` : '0',
                            width: hasOverlap ? `${100 / totalRows}%` : '100%',
                        }}
                    >
                        <CalendarEventCard
                            lesson={lesson}
                            onClick={() => onSelectLesson(lesson)}
                        />
                    </div>
                );
            })}
        </div>
    );
}
