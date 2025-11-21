import { useState, useEffect } from 'react';
import { SubjectPopup } from './SubjectPopup';
import { timeToMinutes } from '../utils/calendarUtils';
import { fetchWeekSchedule } from '../api/schedule';
import type { BlockLesson, LessonWithRow, OrganizedLessons, DateInfo } from '../types/calendarTypes';

const DAYS = ['PO', 'ÚT', 'ST', 'ČT', 'PÁ'];
const START_HOUR = 7;
const END_HOUR = 20;
const ROW_HEIGHT = 120; // px

interface SchoolCalendarProps {
    initialDate?: Date;
}

export function SchoolCalendar({ initialDate = new Date() }: SchoolCalendarProps) {
    const [scheduleData, setScheduleData] = useState<BlockLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<BlockLesson | null>(null);
    const [weekDates, setWeekDates] = useState<DateInfo[]>([]);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            // Calculate start and end of the week based on initialDate
            const startOfWeek = new Date(initialDate);
            const day = startOfWeek.getDay() || 7; // Get current day number, converting Sun (0) to 7
            if (day !== 1) startOfWeek.setHours(-24 * (day - 1)); // Set to Monday

            const endOfWeek = new Date(startOfWeek);
            endOfWeek.setDate(startOfWeek.getDate() + 4); // Set to Friday

            const data = await fetchWeekSchedule({ start: startOfWeek, end: endOfWeek });
            if (data) {
                setScheduleData(data);
            }
            setLoading(false);

            // Set week dates for display
            const dates: DateInfo[] = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                dates.push({
                    weekday: DAYS[i],
                    day: String(d.getDate()),
                    month: String(d.getMonth() + 1),
                    full: d.toLocaleDateString('cs-CZ')
                });
            }
            setWeekDates(dates);
        };
        loadData();
    }, [initialDate]);


    // Helper to organize lessons into rows to prevent overlap
    const organizeLessons = (lessons: BlockLesson[]): OrganizedLessons => {
        if (!lessons || lessons.length === 0) return { lessons: [], totalRows: 1 };

        // Sort by start time
        const sortedLessons = [...lessons].sort((a, b) =>
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );

        const rows: number[] = []; // Stores the end time (in minutes) of the last lesson in each row
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
    };

    if (loading) {
        return (
            <div className="w-full h-[600px] flex justify-center items-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col font-dm relative">
            {/* Header - Times */}
            <div className="flex border-b border-gray-200 bg-gray-50/50">
                <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50"></div> {/* Corner */}
                <div className="flex-1 flex relative">
                    {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => {
                        const hour = START_HOUR + i;
                        return (
                            <div key={hour} className="flex-1 py-3 text-center border-r border-gray-100 last:border-r-0">
                                <span className="text-sm font-medium text-gray-500">{hour}:00</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Calendar Body */}
            <div className="flex-1 overflow-y-auto relative">


                {weekDates.map((dateInfo, dayIndex) => {
                    // Filter lessons for this day
                    const dayLessons = scheduleData.filter(l => {
                        // Assuming l.date is YYYYMMDD
                        const month = l.date.substring(4, 6);
                        const day = l.date.substring(6, 8);
                        return parseInt(day) === parseInt(dateInfo.day) && parseInt(month) === parseInt(dateInfo.month);
                    });

                    const { lessons, totalRows } = organizeLessons(dayLessons);
                    const rowHeight = Math.max(ROW_HEIGHT, totalRows * 60); // Dynamic height if many overlaps

                    return (
                        <div key={dayIndex} className="flex border-b border-gray-100 min-h-[120px] relative z-10">
                            {/* Date Column */}
                            <div className="w-20 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-2">
                                <span className="text-xs font-bold text-gray-400 uppercase">{dateInfo.weekday}</span>
                                <span className="text-xl font-bold text-gray-800">{dateInfo.day}/{dateInfo.month}</span>
                            </div>

                            {/* Events Column */}
                            <div className="flex-1 relative bg-transparent" style={{ height: `${rowHeight}px` }}>
                                {/* Row Grid */}
                                <div className="absolute inset-0 flex pointer-events-none z-0">
                                    {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                                        <div key={i} className="flex-1 border-r border-gray-300 h-full"></div>
                                    ))}
                                </div>
                                {lessons.map((lesson) => {
                                    const startMinutes = timeToMinutes(lesson.startTime);
                                    const endMinutes = timeToMinutes(lesson.endTime);
                                    const dayStartMinutes = START_HOUR * 60;
                                    const dayEndMinutes = END_HOUR * 60;
                                    const totalDayMinutes = dayEndMinutes - dayStartMinutes;

                                    // Calculate position percentages
                                    const leftPercent = ((startMinutes - dayStartMinutes) / totalDayMinutes) * 100;
                                    const widthPercent = ((endMinutes - startMinutes) / totalDayMinutes) * 100;

                                    // Vertical position for overlaps
                                    const topPercent = (lesson.row / totalRows) * 100;
                                    const heightPercent = (1 / totalRows) * 100;

                                    return (
                                        <div
                                            key={lesson.id}
                                            className={`absolute ${lesson.isSeminar == "true" ? "bg-blue-50 border-blue-200 hover:bg-blue-100" : "bg-green-50 border-green-200 hover:bg-green-100"} border text-left text-gray-800 font-dm p-2 rounded-lg shadow-sm cursor-pointer transition-all overflow-hidden group`}
                                            style={{
                                                left: `${leftPercent}%`,
                                                width: `${widthPercent}%`,
                                                top: `${topPercent}%`,
                                                height: `${heightPercent}%`,
                                                zIndex: 10 + lesson.row
                                            }}
                                            onClick={() => { setSelected(lesson) }}
                                            title={`${lesson.courseName}\n${lesson.startTime} - ${lesson.endTime}\n${lesson.room}\n${lesson.teachers[0]?.shortName}`}
                                        >
                                            <div className="flex flex-col h-full justify-between">
                                                <div>
                                                    <div className="text-xs font-bold text-gray-900 truncate flex items-center gap-1">
                                                        {lesson.courseCode}
                                                        <span className="font-normal text-gray-500 text-[10px] ml-auto">{lesson.roomStructured.name}</span>
                                                    </div>
                                                    <div className="text-[10px] leading-tight text-gray-600 truncate mt-0.5 group-hover:whitespace-normal group-hover:overflow-visible group-hover:bg-inherit group-hover:z-50">
                                                        {lesson.courseName}
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-auto">
                                                    {lesson.startTime} - {lesson.endTime}
                                                </div>
                                            </div>
                                            <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r ${lesson.isSeminar == "true" ? "bg-blue-400" : "bg-green-400"}`}></span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>

            {selected && (
                <SubjectPopup
                    code={selected}
                    onClose={() => setSelected(null)}
                />
            )}
        </div>
    );
}
