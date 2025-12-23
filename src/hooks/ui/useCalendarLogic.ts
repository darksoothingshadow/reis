import { useMemo } from 'react';
import { useSchedule, useExams } from '../data';
import { getCzechHoliday } from '../../utils/holidays';
import { parseDate } from '../../utils/dateHelpers';
import type { BlockLesson, LessonWithRow, OrganizedLessons, DateInfo } from '../../types/calendarTypes';

const DAYS_META = [
    { index: 0, short: 'Po', full: 'Pondělí' },
    { index: 1, short: 'Út', full: 'Úterý' },
    { index: 2, short: 'St', full: 'Středa' },
    { index: 3, short: 'Čt', full: 'Čtvrtek' },
    { index: 4, short: 'Pá', full: 'Pátek' },
];

const TOTAL_HOURS = 13; // 7:00 to 20:00 (13 hour slots)

// Convert time string to percentage from top (7:00 = 0%, 20:00 = 100%)
export function timeToPercent(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    const hoursFrom7 = hours - 7;
    const totalMinutesFrom7 = hoursFrom7 * 60 + minutes;
    const totalMinutesInDay = TOTAL_HOURS * 60; // 13 hours * 60 minutes
    return (totalMinutesFrom7 / totalMinutesInDay) * 100;
}

// Calculate position style for an event using percentages
export function getEventStyle(startTime: string, endTime: string): { top: string; height: string } {
    const topPercent = timeToPercent(startTime);
    const bottomPercent = timeToPercent(endTime);
    const heightPercent = bottomPercent - topPercent;
    return {
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
    };
}

// Convert time string to minutes
function timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

// Organize lessons into rows to prevent overlap
export function organizeLessons(lessons: BlockLesson[]): OrganizedLessons {
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

export function useCalendarLogic(initialDate: Date) {
    const { schedule: storedSchedule, isLoaded: isScheduleLoaded } = useSchedule();
    const { exams: storedExams } = useExams();

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
                weekday: DAYS_META[i].short,
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

        const allExams: { id: string; subjectCode: string; title: string; start: Date; location: string; meta: { teacher: string; teacherId: string } }[] = [];
        storedExams.forEach(subject => {
            subject.sections.forEach((section) => {
                if (section.status === 'registered' && section.registeredTerm) {
                    allExams.push({
                        id: section.id,
                        subjectCode: subject.code,
                        title: `${subject.name} - ${section.name}`,
                        start: parseDate(section.registeredTerm.date, section.registeredTerm.time),
                        location: section.registeredTerm.room || 'Unknown',
                        meta: { 
                            teacher: section.registeredTerm.teacher || 'Unknown',
                            teacherId: section.registeredTerm.teacherId || ''
                        }
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
                courseCode: exam.subjectCode,
                courseName: exam.title,
                room: exam.location,
                roomStructured: { name: exam.location, id: '' },
                teachers: [{ fullName: exam.meta.teacher, shortName: exam.meta.teacher, id: exam.meta.teacherId }],
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

    const showSkeleton = scheduleData.length === 0 && !isScheduleLoaded;

    return {
        weekDates,
        lessonsByDay,
        holidaysByDay,
        todayIndex,
        showSkeleton
    };
}
