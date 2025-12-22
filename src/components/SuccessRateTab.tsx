import { useState } from 'react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { AlertTriangle } from 'lucide-react';
import type { GradeStats } from '../types/documents';

interface SuccessRateTabProps {
    courseCode: string;
}

// Grade order for consistent styling
const GRADE_ORDER: (keyof GradeStats)[] = ['A', 'B', 'C', 'D', 'E', 'F', 'FN'];

// Grade colors - warm progression
const GRADE_COLORS: Record<keyof GradeStats, string> = {
    A: '#22c55e', // green
    B: '#84cc16', // lime
    C: '#facc15', // yellow
    D: '#f59e0b', // amber
    E: '#f97316', // orange
    F: '#ef4444', // red
    FN: '#dc2626', // dark red
};

export function SuccessRateTab({ courseCode }: SuccessRateTabProps) {
    const { stats: data, loading } = useSuccessRate(courseCode);
    const [activeIndex, setActiveIndex] = useState(0);

    if (loading) return (
        <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-md text-primary"></span>
        </div>
    );

    if (!data || !data.stats.length) return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <AlertTriangle className="w-8 h-8 text-warning mb-3 opacity-40" />
            <p className="text-sm opacity-60">Data nejsou k dispozici</p>
        </div>
    );

    // Sort semesters: newest first
    const sortedStats = [...data.stats].sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        const isWinterA = a.semesterName.startsWith('ZS');
        const isWinterB = b.semesterName.startsWith('ZS');
        if (isWinterA && !isWinterB) return -1;
        if (!isWinterA && isWinterB) return 1;
        return 0;
    }).slice(0, 5); // Limit to 5 most recent

    // Ensure activeIndex is within bounds (if data changes)
    const safeIndex = Math.min(activeIndex, sortedStats.length - 1);
    const activeSemester = sortedStats[safeIndex];
    const totalStudents = activeSemester.totalPass + activeSemester.totalFail;

    // Aggregate grades from all terms
    const activeGrades = activeSemester.terms.reduce((acc, term) => {
        Object.entries(term.grades).forEach(([grade, count]) => {
            const g = grade as keyof GradeStats;
            acc[g] = (acc[g] || 0) + count;
        });
        return acc;
    }, {} as GradeStats);

    // Get max value for RELATIVE scaling (only within current semester)
    const gradeData = GRADE_ORDER.map(g => activeGrades[g] || 0);
    const maxGrade = Math.max(...gradeData, 1);
    const MAX_BAR_HEIGHT = 160; // Fixed pixel height for context

    // Format year label: "21/22" style
    const formatYearLabel = (year: number, semesterName: string) => {
        const yearShort = year % 100;
        const isWinter = semesterName.startsWith('ZS');
        return isWinter ? `${yearShort}/${yearShort + 1}` : `${yearShort - 1}/${yearShort}`;
    };

    return (
        <div className="flex flex-col h-full px-4 py-3 select-none" data-testid="success-rate-tab">
            {/* 1. Student count at top (Bigger as requested) */}
            <div className="text-center mb-6">
                <span className="text-sm opacity-50 font-bold uppercase tracking-wider">
                    {totalStudents} studentů
                </span>
            </div>

            {/* 2. Bar Chart - RELATIVE scaling with fixed max height */}
            <div className="flex items-end gap-3 px-1 mb-8" style={{ height: `${MAX_BAR_HEIGHT}px` }}>
                {GRADE_ORDER.map((grade, i) => {
                    const value = gradeData[i];
                    // Using fixed pixel height to ensure relative scaling works in flex layout
                    const barHeight = (value / maxGrade) * MAX_BAR_HEIGHT;
                    
                    return (
                        <div key={grade} className="flex-1 flex flex-col items-center gap-1 group">
                            {/* Value label */}
                            <span className={`text-[11px] font-bold transition-opacity ${value > 0 ? 'opacity-40 group-hover:opacity-100' : 'opacity-0'}`}>
                                {value}
                            </span>
                            {/* Bar */}
                            <div 
                                className="w-full rounded-t-md transition-all duration-300 shadow-sm"
                                style={{
                                    height: `${Math.max(barHeight, 4)}px`,
                                    backgroundColor: value > 0 ? GRADE_COLORS[grade] : 'var(--color-base-content)',
                                    opacity: value > 0 ? 0.95 : 0.05
                                }}
                            />
                            {/* Grade label */}
                            <span className="text-[11px] font-black opacity-30 mt-1 uppercase">
                                {grade === 'FN' ? '-' : grade}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* 3. Unified Year Selector with Success Rates (Bigger circles) */}
            <div className="flex justify-center gap-4 mt-auto">
                {sortedStats.map((s, i) => {
                    const total = s.totalPass + s.totalFail;
                    const rate = Math.round((s.totalPass / total) * 100) || 0;
                    const isActive = i === safeIndex;
                    const label = formatYearLabel(s.year, s.semesterName);
                    
                    return (
                        <button
                            key={`year-${s.year}-${s.semesterName}`}
                            onClick={() => setActiveIndex(i)}
                            className={`flex flex-col items-center gap-2 px-2 py-2 rounded-xl transition-all ${
                                isActive
                                    ? 'bg-primary/10 ring-2 ring-primary/40'
                                    : 'opacity-40 hover:opacity-100 hover:bg-base-200'
                            }`}
                        >
                            {/* Success rate circle - BIGGER as requested */}
                            <div className="relative w-12 h-12 flex items-center justify-center">
                                <svg className="w-full h-full -rotate-90" viewBox="0 0 32 32">
                                    <circle
                                        cx="16" cy="16" r="13"
                                        className="fill-none stroke-base-content/10"
                                        strokeWidth="3"
                                    />
                                    <circle
                                        cx="16" cy="16" r="13"
                                        className={`fill-none transition-all ${isActive ? 'stroke-success' : 'stroke-success/40'}`}
                                        strokeWidth="3"
                                        strokeDasharray={2 * Math.PI * 13}
                                        strokeDashoffset={2 * Math.PI * 13 * (1 - rate / 100)}
                                        strokeLinecap="round"
                                    />
                                </svg>
                                <span className={`absolute text-[10px] font-black ${isActive ? '' : 'opacity-80'}`}>
                                    {rate}%
                                </span>
                            </div>
                            {/* Year label */}
                            <span className={`text-[10px] font-black ${isActive ? 'text-primary' : ''}`}>
                                {label}
                            </span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
