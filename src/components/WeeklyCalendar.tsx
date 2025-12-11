/**
 * WeeklyCalendar - Vertical calendar layout.
 * 
 * Layout: Days as columns (Mon-Fri), time flows vertically (7:00-20:00).
 * Integrates REIS logic: useSchedule, useExams, auto-skip, Czech holidays, EventPopover.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import { CalendarEventCard } from './CalendarEventCard';
import { EventPopover } from './EventPopover';
import { useSchedule, useExams } from '../hooks/data';
import { getCzechHoliday } from '../utils/holidays';
import { parseDate } from '../utils/dateHelpers';
import type { BlockLesson, LessonWithRow, OrganizedLessons, DateInfo } from '../types/calendarTypes';

const DAYS = [
    { index: 0, short: 'Po', full: 'Pondělí' },
    { index: 1, short: 'Út', full: 'Úterý' },
    { index: 2, short: 'St', full: 'Středa' },
    { index: 3, short: 'Čt', full: 'Čtvrtek' },
    { index: 4, short: 'Pá', full: 'Pátek' },
];

const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
const HOUR_HEIGHT = 48; // pixels per hour (reduced from 60 to fit without scrolling)
const TOTAL_HOURS = 14; // 7:00 to 20:00 (inclusive)
const CALENDAR_HEIGHT = TOTAL_HOURS * HOUR_HEIGHT;

// Convert time string to pixels from top (7:00)
function timeToPixels(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const hoursFrom7 = hours - 7;
    return hoursFrom7 * HOUR_HEIGHT + (minutes / 60) * HOUR_HEIGHT;
}

// Calculate position style for an event
function getEventStyle(startTime: string, endTime: string): { top: string; height: string } {
    const topPixels = timeToPixels(startTime);
    const bottomPixels = timeToPixels(endTime);
    const heightPixels = bottomPixels - topPixels;
    return {
        top: `${topPixels}px`,
        height: `${heightPixels}px`,
    };
}

// Convert minutes to time string (HH:MM)
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Organize lessons into rows to prevent overlap
function organizeLessons(lessons: BlockLesson[]): OrganizedLessons {
    if (!lessons || lessons.length === 0) return { lessons: [], totalRows: 1 };

    const sortedLessons = [...lessons].sort((a, b) =>
        timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
    );

    const rows: number[] = [];
    const lessonsWithRows: LessonWithRow[] = [];

    sortedLessons.forEach(lesson => {
        const start = timeToMinutes(lesson.startTime);
        const end = timeToMinutes(lesson.endTime);
        let placed = false;

        for (let i = 0; i < rows.length; i++) {
            if (rows[i] <= start) {
                rows[i] = end;
                lessonsWithRows.push({ ...lesson, row: i });
                placed = true;
                break;
            }
        }

        if (!placed) {
            rows.push(end);
            lessonsWithRows.push({ ...lesson, row: rows.length - 1 });
        }
    });

    return { lessons: lessonsWithRows, totalRows: rows.length };
}

interface WeeklyCalendarProps {
    initialDate?: Date;
    onEmptyWeek?: (direction: 'next' | 'prev') => void;
}

export function WeeklyCalendar({ initialDate = new Date(), onEmptyWeek }: WeeklyCalendarProps) {
    // Get stored semester data from hooks
    const { schedule: storedSchedule } = useSchedule();
    const { exams: storedExams } = useExams();

    const [selected, setSelected] = useState<BlockLesson | null>(null);
    const anchorRef = useRef<HTMLDivElement | null>(null);

    // Calculate week dates (Mon-Fri)
    const weekDates = useMemo((): DateInfo[] => {
        const startOfWeek = new Date(initialDate);
        const day = startOfWeek.getDay() || 7;
        if (day !== 1) startOfWeek.setHours(-24 * (day - 1));
        startOfWeek.setHours(0, 0, 0, 0);

        const dates: DateInfo[] = [];
        for (let i = 0; i < 5; i++) {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            dates.push({
                weekday: DAYS[i].short,
                day: String(d.getDate()),
                month: String(d.getMonth() + 1),
                year: String(d.getFullYear()),
                full: d.toLocaleDateString('cs-CZ')
            });
        }
        return dates;
    }, [initialDate]);

    // Get week date strings (YYYYMMDD format)
    const weekDateStrings = useMemo(() => {
        return weekDates.map(d =>
            `${d.year}${d.month.padStart(2, '0')}${d.day.padStart(2, '0')}`
        );
    }, [weekDates]);

    // Process exams into BlockLesson format
    const examLessons = useMemo((): BlockLesson[] => {
        if (!storedExams || storedExams.length === 0) return [];

        const allExams: { id: string; title: string; start: Date; location: string; meta: { teacher: string } }[] = [];
        storedExams.forEach(subject => {
            subject.sections.forEach((section: { id: string; status: string; name: string; registeredTerm?: { date: string; time: string; room?: string; teacher?: string } }) => {
                if (section.status === 'registered' && section.registeredTerm) {
                    allExams.push({
                        id: section.id,
                        title: `${subject.name} - ${section.name}`,
                        start: parseDate(section.registeredTerm.date, section.registeredTerm.time),
                        location: section.registeredTerm.room || 'Unknown',
                        meta: { teacher: section.registeredTerm.teacher || 'Unknown' }
                    });
                }
            });
        });

        return allExams.map(exam => {
            const dateObj = new Date(exam.start);
            const dateStr = `${dateObj.getFullYear()}${String(dateObj.getMonth() + 1).padStart(2, '0')}${String(dateObj.getDate()).padStart(2, '0')}`;
            const startTime = `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
            const endObj = new Date(dateObj.getTime() + 90 * 60000);
            const endTime = `${String(endObj.getHours()).padStart(2, '0')}:${String(endObj.getMinutes()).padStart(2, '0')}`;

            return {
                id: `exam-${exam.id}-${exam.start}`,
                date: dateStr,
                startTime,
                endTime,
                courseCode: exam.id,
                courseName: exam.title,
                room: exam.location,
                roomStructured: { name: exam.location, id: '' },
                teachers: [{ fullName: exam.meta.teacher, shortName: exam.meta.teacher, id: '' }],
                isExam: true,
                examEvent: exam,
                isConsultation: 'false',
                studyId: '',
                facultyCode: '',
                isDefaultCampus: 'true',
                courseId: '',
                campus: '',
                isSeminar: 'false',
                periodId: ''
            } as BlockLesson;
        });
    }, [storedExams]);

    // Filter schedule for this week + add exams
    const scheduleData = useMemo((): BlockLesson[] => {
        let lessons: BlockLesson[] = [];

        if (storedSchedule && storedSchedule.length > 0) {
            lessons = storedSchedule.filter(lesson =>
                weekDateStrings.includes(lesson.date)
            );
        }

        const weekExams = examLessons.filter(exam =>
            weekDateStrings.includes(exam.date)
        );

        return [...lessons, ...weekExams];
    }, [storedSchedule, examLessons, weekDateStrings]);

    // Check if this week has events
    const hasEventsThisWeek = scheduleData.length > 0;

    // Auto-skip empty weeks
    useEffect(() => {
        if (storedSchedule && storedSchedule.length > 0 && !hasEventsThisWeek && onEmptyWeek) {
            const timer = setTimeout(() => {
                onEmptyWeek('next');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [hasEventsThisWeek, onEmptyWeek, storedSchedule]);

    // Group lessons by day index (0-4 for Mon-Fri)
    const lessonsByDay = useMemo(() => {
        const grouped: Record<number, BlockLesson[]> = { 0: [], 1: [], 2: [], 3: [], 4: [] };

        scheduleData.forEach(lesson => {
            const year = parseInt(lesson.date.substring(0, 4));
            const month = parseInt(lesson.date.substring(4, 6)) - 1;
            const day = parseInt(lesson.date.substring(6, 8));
            const date = new Date(year, month, day);
            const dayOfWeek = date.getDay();

            // Convert to 0-indexed (Mon=0, Tue=1, ...)
            const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            if (dayIndex >= 0 && dayIndex < 5) {
                grouped[dayIndex].push(lesson);
            }
        });

        return grouped;
    }, [scheduleData]);

    // Check for holidays on each day
    const holidaysByDay = useMemo(() => {
        const holidays: Record<number, string | null> = {};
        weekDates.forEach((dateInfo, index) => {
            const checkDate = new Date(
                parseInt(dateInfo.year),
                parseInt(dateInfo.month) - 1,
                parseInt(dateInfo.day)
            );
            holidays[index] = getCzechHoliday(checkDate);
        });
        return holidays;
    }, [weekDates]);

    // Check if today is in this week
    const todayIndex = useMemo(() => {
        const today = new Date();
        for (let i = 0; i < weekDates.length; i++) {
            const d = weekDates[i];
            if (
                parseInt(d.day) === today.getDate() &&
                parseInt(d.month) === today.getMonth() + 1 &&
                parseInt(d.year) === today.getFullYear()
            ) {
                return i;
            }
        }
        return -1;
    }, [weekDates]);

    return (
        <div className="flex h-screen overflow-hidden flex-col font-inter bg-base-100">
            {/* Day headers - sticky */}
            <div className="flex border-b border-base-300 bg-base-100 flex-shrink-0 h-[60px]">
                {/* Empty space for time column */}
                <div className="w-12 border-r border-base-300 bg-base-200"></div>

                {DAYS.map((day, index) => {
                    const dateInfo = weekDates[index];
                    const isToday = index === todayIndex;
                    const holiday = holidaysByDay[index];

                    return (
                        <div
                            key={index}
                            className={`flex-1 p-2 text-center border-r border-base-300 last:border-r-0 
                                       ${isToday ? 'bg-primary/10' : ''}`}
                        >
                            <div className="flex flex-col items-center">
                                <div className={`text-lg font-semibold ${holiday ? 'text-error' : isToday ? 'text-primary' : 'text-base-content'}`}>
                                    {dateInfo?.day}
                                </div>
                                <div className={`text-xs ${holiday ? 'text-error' : 'text-content-secondary'}`}>
                                    {day.full}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Calendar body - no scroll */}
            <div className="flex-1 overflow-hidden">
                <div className="flex" style={{ height: `${CALENDAR_HEIGHT}px` }}>
                    {/* Time column */}
                    <div className="w-12 flex-shrink-0 border-r border-base-300 bg-base-200 relative">
                        {HOURS.map((hour, index) => (
                            <div
                                key={hour}
                                className="absolute left-0 right-0 text-xs text-content-secondary text-right pr-1"
                                style={{
                                    top: `${index * HOUR_HEIGHT}px`,
                                    height: `${HOUR_HEIGHT}px`,
                                }}
                            >
                                {hour}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="flex-1 relative flex">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex pointer-events-none">
                            {DAYS.map((_, dayIndex) => {
                                // Debug: Log grid structure on first render
                                if (dayIndex === 0) {
                                    console.log('[CalendarGrid] Rendering grid:', {
                                        daysCount: DAYS.length,
                                        hoursCount: HOURS.length,
                                        verticalBorder: 'border-r border-base-300',
                                        horizontalBorder: 'border-b border-base-200',
                                        hourHeight: HOUR_HEIGHT,
                                    });
                                }
                                return (
                                    <div
                                        key={dayIndex}
                                        className="flex-1 border-r border-base-300 last:border-r-0"
                                    >
                                        {HOURS.map((_, hourIndex) => (
                                            <div
                                                key={hourIndex}
                                                className="border-b border-base-200"
                                                style={{ height: `${HOUR_HEIGHT}px` }}
                                            ></div>
                                        ))}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Day columns with events */}
                        {DAYS.map((_, dayIndex) => {
                            const dayLessons = lessonsByDay[dayIndex] || [];
                            const { lessons: organizedLessons, totalRows } = organizeLessons(dayLessons);
                            const holiday = holidaysByDay[dayIndex];
                            const isToday = dayIndex === todayIndex;

                            return (
                                <div
                                    key={dayIndex}
                                    className={`flex-1 relative ${isToday ? 'bg-primary/5' : ''}`}
                                >
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

                                    {/* Events */}
                                    {!holiday && organizedLessons.map((lesson) => {
                                        const style = getEventStyle(lesson.startTime, lesson.endTime);
                                        const hasOverlap = totalRows > 1;

                                        return (
                                            <div
                                                key={lesson.id}
                                                ref={selected?.id === lesson.id ? anchorRef : null}
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
                                                    onClick={(e) => {
                                                        anchorRef.current = e.currentTarget as HTMLDivElement;
                                                        setSelected(lesson);
                                                    }}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Event Popover - same as current implementation */}
            <EventPopover
                lesson={selected}
                isOpen={!!selected}
                onClose={() => setSelected(null)}
                anchorRef={anchorRef}
            />
        </div>
    );
}
