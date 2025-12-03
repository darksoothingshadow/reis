import { useState, useEffect } from 'react';
import { SubjectPopup } from './SubjectPopup';
import { timeToMinutes } from '../utils/calendarUtils';
import { fetchWeekSchedule } from '../api/schedule';
import { fetchExams, getCachedExams } from '../api/exams';
import type { BlockLesson, LessonWithRow, OrganizedLessons, DateInfo } from '../types/calendarTypes';
import { getCzechHoliday } from '../utils/holidays';

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

            // Try to get cached exams first
            let exams = await getCachedExams();

            // Helper to process exams
            const processExams = (examEvents: any[]) => {
                const processed = examEvents.map(exam => {
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
                return processed;
            };

            let allLessons: BlockLesson[] = [];
            if (data) {
                allLessons = [...data];
            }

            // If we have cached exams, add them immediately
            if (exams && exams.length > 0) {
                const examLessons = processExams(exams);
                setScheduleData([...allLessons, ...examLessons]);
            } else {
                setScheduleData(allLessons);
            }

            setLoading(false);

            // Fetch fresh exams in background
            fetchExams().then(freshExams => {
                if (freshExams && freshExams.length > 0) {
                    const examLessons = processExams(freshExams);
                    // Re-merge with current schedule data (which might have changed if week changed, but here we are in closure)
                    // Better to just update state again
                    setScheduleData(prev => {
                        // Filter out old exams from prev state to avoid duplicates if we just append
                        const nonExams = prev.filter(l => !l.isExam);
                        return [...nonExams, ...examLessons];
                    });
                }
            });

            // Set week dates for display
            const dates: DateInfo[] = [];
            for (let i = 0; i < 5; i++) {
                const d = new Date(startOfWeek);
                d.setDate(startOfWeek.getDate() + i);
                dates.push({
                    weekday: DAYS[i],
                    day: String(d.getDate()),
                    month: String(d.getMonth() + 1),
                    year: String(d.getFullYear()),
                    full: d.toLocaleDateString('cs-CZ')
                });
            }
            setWeekDates(dates);
        };
        loadData();

        // Poll exams every minute - REMOVED to prevent UI flashing
        // const intervalId = setInterval(() => {
        //     loadData();
        // }, 60000);

        // return () => clearInterval(intervalId);
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
                        const year = l.date.substring(0, 4);
                        const month = l.date.substring(4, 6);
                        const day = l.date.substring(6, 8);
                        return parseInt(year) === parseInt(dateInfo.year) &&
                            parseInt(day) === parseInt(dateInfo.day) &&
                            parseInt(month) === parseInt(dateInfo.month);
                    });

                    // Hide empty days
                    if (dayLessons.length === 0) return null;

                    const { lessons, totalRows } = organizeLessons(dayLessons);
                    const rowHeight = Math.max(ROW_HEIGHT, totalRows * 60); // Dynamic height if many overlaps

                    const isToday = (() => {
                        const today = new Date();
                        return parseInt(dateInfo.day) === today.getDate() &&
                            parseInt(dateInfo.month) === (today.getMonth() + 1) &&
                            today.getFullYear() === new Date().getFullYear();
                    })();

                    // Check for holiday
                    // Construct Date object from dateInfo (assuming current year for now, or better use the actual date from weekDates generation logic if available, but here we reconstruct)
                    const currentYear = new Date().getFullYear(); // Or better, use the year from the week start
                    const checkDate = new Date(currentYear, parseInt(dateInfo.month) - 1, parseInt(dateInfo.day));
                    const holidayName = getCzechHoliday(checkDate);

                    return (
                        <div key={dayIndex} className={`flex border rounded-xl mb-3 overflow-hidden min-h-[120px] relative z-10 shadow-sm transition-all ${isToday ? 'bg-blue-50/50 border-primary ring-1 ring-primary shadow-md' : 'bg-white border-gray-100'}`}>
                            {/* Date Column */}
                            <div className={`w-20 flex-shrink-0 border-r flex flex-col items-center justify-center p-2 ${isToday ? 'bg-blue-100/30 border-blue-100' : 'bg-gray-50 border-gray-200'}`}>
                                <span className={`text-xs font-bold uppercase ${holidayName ? 'text-red-500' : isToday ? 'text-primary' : 'text-gray-400'}`}>{dateInfo.weekday}</span>
                                <span className={`text-xl font-bold ${holidayName ? 'text-red-600' : isToday ? 'text-primary' : 'text-gray-800'}`}>{dateInfo.day}/{dateInfo.month}</span>
                            </div>

                            {/* Events Column */}
                            <div className="flex-1 relative bg-transparent" style={{ height: `${rowHeight}px` }}>
                                {holidayName ? (
                                    <div className="absolute inset-0 flex items-center justify-center bg-red-50/30 p-4">
                                        <div className="flex flex-col items-center text-center">
                                            <span className="text-3xl mb-2">🇨🇿</span>
                                            <h3 className="text-lg font-bold text-red-800">{holidayName}</h3>
                                            <span className="text-sm text-red-600 font-medium uppercase tracking-wider mt-1">Státní svátek</span>
                                        </div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Row Grid */}
                                        <div className="absolute inset-0 flex pointer-events-none z-0">
                                            {Array.from({ length: END_HOUR - START_HOUR + 1 }).map((_, i) => (
                                                <div key={i} className="flex-1 border-r border-gray-100 h-full last:border-r-0"></div>
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

                                            // Determine if the event is "short" (e.g., less than 60 minutes) to adjust layout
                                            const durationMinutes = endMinutes - startMinutes;
                                            const isShort = durationMinutes <= 60;
                                            const isVeryShort = durationMinutes <= 45;

                                            return (
                                                <div
                                                    key={lesson.id}
                                                    className={`absolute ${lesson.isExam
                                                        ? "bg-[#FEF2F2] border-[#dc2626] border-2 shadow-md hover:shadow-lg"
                                                        : lesson.isSeminar == "true"
                                                            ? "bg-[#F3FAEA] border border-gray-200 shadow-sm hover:shadow-md"
                                                            : "bg-[#F0F7FF] border border-gray-200 shadow-sm hover:shadow-md"
                                                        } text-left font-dm rounded-lg cursor-pointer transition-all overflow-hidden group`}
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
                                                    {/* Colored Strip for Lessons */}
                                                    {!lesson.isExam && (
                                                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${lesson.isSeminar == "true" ? "bg-[#79be15]" : "bg-[#00548f]"
                                                            }`}></div>
                                                    )}

                                                    <div className={`flex flex-col h-full justify-between p-2 ${!lesson.isExam ? "pl-3" : ""}`}>
                                                        <div>
                                                            <div className="flex items-start justify-between gap-1">
                                                                <span className={`text-sm font-bold whitespace-nowrap ${lesson.isExam ? "text-[#991b1b]" : "text-gray-900"}`}>
                                                                    {lesson.courseCode}
                                                                </span>
                                                                {!isVeryShort && (
                                                                    <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full whitespace-nowrap flex-shrink-0">
                                                                        {lesson.roomStructured.name}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {!isShort && (
                                                                <div className={`text-xs font-normal mt-1 leading-tight line-clamp-2 ${lesson.isExam ? "text-[#991b1b]/90" : lesson.isSeminar == "true" ? "text-[#365314]" : "text-[#1e3a8a]"}`}>
                                                                    {lesson.courseName}
                                                                </div>
                                                            )}

                                                            {lesson.isExam && (
                                                                <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-[#991b1b] uppercase tracking-wide">
                                                                    <span>⚠️ {lesson.courseName.toLowerCase().includes('test') ? 'TEST' : 'ZKOUŠKA'}</span>
                                                                </div>
                                                            )}
                                                        </div>

                                                        {!isVeryShort && (
                                                            <div className={`text-[10px] font-medium mt-auto ${lesson.isExam ? "text-[#991b1b]/80" : "text-gray-400"}`}>
                                                                {lesson.startTime} - {lesson.endTime}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </>
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* Empty State - No events this week */}
                {(() => {
                    // Check if this week has any events
                    const hasEventsThisWeek = weekDates.some(dateInfo => {
                        const dayLessons = scheduleData.filter(l => {
                            const year = l.date.substring(0, 4);
                            const month = l.date.substring(4, 6);
                            const day = l.date.substring(6, 8);
                            return parseInt(year) === parseInt(dateInfo.year) &&
                                parseInt(day) === parseInt(dateInfo.day) &&
                                parseInt(month) === parseInt(dateInfo.month);
                        });
                        return dayLessons.length > 0;
                    });

                    if (!hasEventsThisWeek) {
                        return (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center p-8 rounded-xl bg-gray-50 border border-gray-200">
                                    <div className="text-5xl mb-3">📅</div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-2">Žádné události tento týden</h3>
                                </div>
                            </div>
                        );
                    }
                    return null;
                })()}
            </div>

            {
                selected && (
                    <SubjectPopup
                        code={selected}
                        onClose={() => setSelected(null)}
                    />
                )
            }
        </div >
    );
}

