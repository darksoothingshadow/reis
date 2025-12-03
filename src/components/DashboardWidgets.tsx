import { useState, useEffect } from 'react';
import { Clock, MapPin, Calendar } from 'lucide-react';
import { fetchWeekSchedule } from '../api/schedule';
import { fetchExams, getCachedExams } from '../api/exams';
import { timeToMinutes, getSmartWeekRange } from '../utils/calendarUtils';
import type { BlockLesson } from '../types/calendarTypes';

export function DashboardWidgets() {
    const [nextClass, setNextClass] = useState<BlockLesson | null>(null);
    const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            const now = new Date();

            // 1. Fetch Schedule for Next Class
            // Use smart week range to get the relevant week (current or next)
            const { start: startOfWeek, end: endOfWeek } = getSmartWeekRange(now);

            const schedule = await fetchWeekSchedule({ start: startOfWeek, end: endOfWeek });

            if (schedule) {
                const currentDayStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                const currentMinutes = now.getHours() * 60 + now.getMinutes();

                // Filter for classes happening today after now, or future days
                const futureClasses = schedule.filter(lesson => {
                    // Parse lesson date
                    // lesson.date is YYYYMMDD
                    if (lesson.date > currentDayStr) return true;
                    if (lesson.date === currentDayStr) {
                        const start = timeToMinutes(lesson.startTime);
                        return start > currentMinutes;
                    }
                    return false;
                });

                // Sort by date and time
                futureClasses.sort((a, b) => {
                    if (a.date !== b.date) return a.date.localeCompare(b.date);
                    return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
                });

                if (futureClasses.length > 0) {
                    setNextClass(futureClasses[0]);
                } else {
                    setNextClass(null);
                }
            }

            // 2. Fetch Exams
            let exams = await getCachedExams();
            if (!exams || exams.length === 0) {
                exams = await fetchExams();
            }

            if (exams) {
                // Filter for next 14 days
                const twoWeeksFromNow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

                const upcoming = exams.filter((exam: any) => {
                    const examDate = new Date(exam.start);
                    return examDate >= now && examDate <= twoWeeksFromNow;
                });

                // Sort by date
                upcoming.sort((a: any, b: any) => new Date(a.start).getTime() - new Date(b.start).getTime());
                setUpcomingExams(upcoming);
            }

            setLoading(false);
        };

        loadData();
    }, []);

    const getDayName = (dateStr: string) => {
        // dateStr is YYYYMMDD
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        const date = new Date(year, month, day);
        const dayIndex = date.getDay();
        // DAY_NAMES is {0: "Ne", 1: "Po", ...}
        // We want full names or at least consistent with DAY_NAMES
        const days = ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"];
        return days[dayIndex];
    };

    if (loading) return null; // Or a skeleton loader

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Next Class Widget */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Clock size={80} className="text-primary" />
                </div>

                <div>
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-1">Následující hodina</h3>
                    {nextClass ? (
                        <>
                            <div className="text-2xl font-bold text-gray-900 line-clamp-1" title={nextClass.courseName}>
                                {nextClass.courseName}
                            </div>
                            <div className="flex items-center gap-2 mt-2 text-gray-600">
                                <span className="font-medium text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">
                                    {getDayName(nextClass.date)} • {nextClass.startTime}
                                </span>
                                <span className="text-sm text-gray-400">•</span>
                                <div className="flex items-center gap-1 text-sm font-medium">
                                    <MapPin size={14} />
                                    {nextClass.roomStructured.name}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="text-xl font-medium text-gray-400 mt-2">
                            Žádná další výuka tento týden 🎉
                        </div>
                    )}
                </div>

                {nextClass && (
                    <div className="mt-4 pt-4 border-t border-gray-50 flex justify-between items-center">
                        <span className="text-xs text-gray-400 font-medium">
                            {nextClass.teachers[0]?.shortName}
                        </span>
                        {/* Could add a "Show details" button here later */}
                    </div>
                )}
            </div>

            {/* Exam Radar Widget */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Calendar size={80} className="text-red-500" />
                </div>

                <div>
                    <h3 className="text-gray-500 text-sm font-medium uppercase tracking-wide mb-1">Exam Radar (14 dní)</h3>
                    {upcomingExams.length > 0 ? (
                        <>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-gray-900">{upcomingExams.length}</span>
                                <span className="text-gray-500 font-medium">nadcházející</span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {upcomingExams.slice(0, 2).map((exam: any, i: number) => (
                                    <div key={i} className="flex items-center gap-3 bg-red-50/50 p-2 rounded-lg border border-red-100">
                                        <div className="bg-white p-1.5 rounded shadow-sm text-center min-w-[40px]">
                                            <div className="text-[10px] font-bold text-red-500 uppercase">
                                                {new Date(exam.start).toLocaleDateString('cs-CZ', { weekday: 'short' })}
                                            </div>
                                            <div className="text-sm font-bold text-gray-900 leading-none">
                                                {new Date(exam.start).getDate()}
                                            </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-bold text-gray-900 truncate">{exam.title}</div>
                                            <div className="text-xs text-gray-500 flex items-center gap-1">
                                                <Clock size={10} />
                                                {new Date(exam.start).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                                                <span className="mx-1">•</span>
                                                <MapPin size={10} />
                                                {exam.location}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {upcomingExams.length > 2 && (
                                    <div className="text-xs text-center text-gray-400 font-medium">
                                        + {upcomingExams.length - 2} další
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-start mt-2">
                            <div className="text-xl font-medium text-gray-900">Čistý štít!</div>
                            <div className="text-sm text-gray-500 mt-1">Žádné zkoušky v dohledu.</div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
