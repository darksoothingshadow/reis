import React, { useState, useMemo } from 'react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { BarChart3 } from 'lucide-react';
import { StorageService, STORAGE_KEYS } from '../services/storage';
import type { SemesterStats, GradeStats } from '../types/documents';

interface SuccessRateTabProps {
    courseCode: string;
}

// Grade colors for consistent styling
const GRADE_COLORS: Record<keyof GradeStats, string> = {
    A: '#10b981', // emerald-500
    B: '#34d399', // emerald-400
    C: '#84cc16', // lime-500
    D: '#facc15', // yellow-400
    E: '#fb923c', // orange-400
    F: '#ef4444', // red-500
    FN: '#dc2626', // red-600
};

const GRADE_ORDER: (keyof GradeStats)[] = ['A', 'B', 'C', 'D', 'E', 'F', 'FN'];

// Helper: Aggregate grades across all terms in a semester
function aggregateGrades(semester: SemesterStats): GradeStats {
    const combined: GradeStats = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 };
    for (const term of semester.terms) {
        for (const [grade, count] of Object.entries(term.grades)) {
            combined[grade as keyof GradeStats] += count;
        }
    }
    return combined;
}

// SVG Line Chart Component
function GradeLineChart({ grades }: { grades: GradeStats }) {
    const maxCount = Math.max(...Object.values(grades), 1);
    const chartWidth = 280;
    const chartHeight = 100;
    const padding = { top: 10, right: 10, bottom: 25, left: 10 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    // Calculate points for the line
    const points = GRADE_ORDER.map((grade, i) => {
        const x = padding.left + (i / (GRADE_ORDER.length - 1)) * innerWidth;
        const y = padding.top + innerHeight - (grades[grade] / maxCount) * innerHeight;
        return { x, y, grade, count: grades[grade] };
    });

    // Create the line path
    const linePath = points
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
        .join(' ');

    // Create gradient area path
    const areaPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + innerHeight} L ${points[0].x} ${padding.top + innerHeight} Z`;

    return (
        <svg width={chartWidth} height={chartHeight} className="mx-auto">
            <defs>
                <linearGradient id="gradeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={GRADE_COLORS.A} />
                    <stop offset="50%" stopColor={GRADE_COLORS.D} />
                    <stop offset="100%" stopColor={GRADE_COLORS.F} />
                </linearGradient>
                <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
            </defs>
            
            {/* Grid lines */}
            {[0, 0.5, 1].map((ratio) => (
                <line
                    key={ratio}
                    x1={padding.left}
                    y1={padding.top + innerHeight * (1 - ratio)}
                    x2={padding.left + innerWidth}
                    y2={padding.top + innerHeight * (1 - ratio)}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                    strokeDasharray="4,4"
                />
            ))}

            {/* Area fill */}
            <path
                d={areaPath}
                fill="url(#areaGradient)"
                className="text-emerald-500"
            />

            {/* Line */}
            <path
                d={linePath}
                fill="none"
                stroke="url(#gradeGradient)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Data points */}
            {points.map((p) => (
                <g key={p.grade}>
                    <circle
                        cx={p.x}
                        cy={p.y}
                        r={4}
                        fill={GRADE_COLORS[p.grade]}
                        stroke="white"
                        strokeWidth={2}
                    />
                    {/* Count label above point */}
                    {p.count > 0 && (
                        <text
                            x={p.x}
                            y={p.y - 8}
                            textAnchor="middle"
                            className="text-[9px] fill-neutral-content/70 font-medium"
                        >
                            {p.count}
                        </text>
                    )}
                </g>
            ))}

            {/* X-axis labels */}
            {points.map((p) => (
                <text
                    key={`label-${p.grade}`}
                    x={p.x}
                    y={chartHeight - 5}
                    textAnchor="middle"
                    className="text-[10px] fill-neutral-content/50 font-bold"
                >
                    {p.grade}
                </text>
            ))}
        </svg>
    );
}

export function SuccessRateTab({ courseCode }: SuccessRateTabProps) {
    const { stats, loading, hasFetched, isGlobalLoaded, refresh } = useSuccessRate(courseCode);
    const [selectedIndex, setSelectedIndex] = useState(0);

    const globalLastSync = StorageService.get<number>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC);
    const lastSyncDate = globalLastSync ? new Date(globalLastSync).toLocaleDateString() : 'nikdy';

    // Get semesters (not aggregated by year) - each semester is distinct
    const semesters = useMemo(() => {
        if (!stats?.stats) return [];
        return [...stats.stats]
            .filter(s => {
                const total = s.totalPass + s.totalFail;
                return total > 0 && !isNaN(s.totalPass / total);
            })
            .sort((a, b) => {
                // Sort by year descending, then by semester name
                if (b.year !== a.year) return b.year - a.year;
                return b.semesterName.localeCompare(a.semesterName);
            })
            .slice(0, 6); // Show max 6 semesters
    }, [stats]);

    const activeSemester = semesters[selectedIndex];
    
    // Aggregate grades for the active semester
    const aggregatedGrades = useMemo(() => {
        if (!activeSemester) return { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 };
        return aggregateGrades(activeSemester);
    }, [activeSemester]);

    // For E2E tests, we need a reliable way to know if global data is loaded
    // If courseCode is provided but stats aren't there and we haven't fetched, it's loading
    if ((loading && !hasFetched) || (courseCode && !stats && !hasFetched)) {
        return (
            <div className="p-6 space-y-6 animate-in fade-in duration-500">
                <div className="bg-neutral rounded-xl p-4">
                    <div className="h-32 flex items-center justify-center">
                        <div className="skeleton w-64 h-24 rounded bg-neutral-content/10"></div>
                    </div>
                </div>
                <div className="bg-neutral rounded-xl p-4">
                    <div className="flex justify-around">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="skeleton w-14 h-14 rounded-full bg-neutral-content/10"></div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Show empty state if we've fetched but have no data
    if (semesters.length === 0 && hasFetched) {
        return (
            <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
                <BarChart3 size={48} className="text-base-content/20" />
                <div className="space-y-2">
                    <h3 className="font-bold text-lg text-base-content/40">Statistiky nejsou dostupné</h3>
                    <p className="text-sm text-base-content/30 max-w-xs">Pro tento předmět IS MENDELU neposkytuje historická data.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full animate-in fade-in duration-300 p-4 gap-4">
            {/* Line Chart Card */}
            <div className="bg-neutral rounded-xl p-4 shadow-lg">
                {/* Line Chart */}
                <div className="mb-4">
                    <GradeLineChart grades={aggregatedGrades} />
                </div>

                {/* Semester Tabs */}
                <div className="flex justify-center gap-4 border-t border-neutral-content/10 pt-3 flex-wrap">
                    {semesters.map((semester, idx) => {
                        const isSelected = selectedIndex === idx;
                        return (
                            <button
                                key={semester.semesterId}
                                onClick={() => setSelectedIndex(idx)}
                                className={`text-xs font-bold pb-1 border-b-2 transition-all ${
                                    isSelected 
                                        ? 'text-error border-error' 
                                        : 'text-neutral-content/50 border-transparent hover:text-neutral-content/80'
                                }`}
                            >
                                {semester.semesterName}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Success Rate Gauges Card */}
            <div className="bg-neutral rounded-xl p-4 shadow-lg">
                <div className="text-center text-neutral-content/70 text-sm font-medium mb-4">
                    Úspěšnost
                </div>
                <div className="flex justify-around items-center flex-wrap gap-2">
                    {semesters.map((semester, idx) => {
                        const passRate = (semester.totalPass / (semester.totalPass + semester.totalFail)) * 100;
                        const isSelected = selectedIndex === idx;
                        
                        return (
                            <button
                                key={semester.semesterId}
                                onClick={() => setSelectedIndex(idx)}
                                className={`flex flex-col items-center gap-2 transition-all ${isSelected ? 'scale-110' : 'opacity-70 hover:opacity-100'}`}
                            >
                                <div 
                                    className="radial-progress text-emerald-500 border-4 border-neutral-content/10" 
                                    style={{ 
                                        "--value": Math.round(passRate), 
                                        "--size": "3.5rem", 
                                        "--thickness": "4px"
                                    } as React.CSSProperties}
                                >
                                    <span className="text-xs font-bold text-neutral-content">
                                        {Math.round(passRate)}%
                                    </span>
                                </div>
                                <span className={`text-[10px] font-bold text-center max-w-16 leading-tight ${isSelected ? 'text-neutral-content' : 'text-neutral-content/50'}`}>
                                    {semester.semesterName.split(' ')[0]}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Sync Info Footer */}
            <div className="mt-2 pt-4 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 uppercase tracking-[0.2em] font-medium px-2">
                <div className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-emerald-500/50"></span>
                    <span>Aktualizace: {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleDateString() : 'Neznámo'}</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-1 h-1 rounded-full bg-blue-500/50"></span>
                    <span>Globální cache: {lastSyncDate}</span>
                </div>
            </div>
        </div>
    );
}
