/**
 * ExamTimeline - Horizontal timeline showing registered exams with gap indicators.
 * 
 * Uses DaisyUI timeline component to visualize:
 * - Registered exams in chronological order
 * - Gap days between consecutive exams with behavioral nudge icons
 * - Spacing score header encouraging spaced learning
 * - Warning colors when gap < 2 days (cramming risk)
 */

import { useMemo } from 'react';
import { CheckCircle, AlertCircle, Frown, Meh, Smile, Laugh, TrendingUp, CalendarCheck, TriangleAlert } from 'lucide-react';
import type { ExamSubject, RegisteredExam } from '../types/exams';
import { getStoredSuccessRates } from '../api/successRate';

interface ExamTimelineProps {
    exams: ExamSubject[];
}

/**
 * Parse DD.MM.YYYY date string to Date object.
 */
function parseDate(dateStr: string): Date {
    const [day, month, year] = dateStr.split('.').map(Number);
    return new Date(year, month - 1, day);
}

/**
 * Calculate days between two dates.
 */
function daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format date for display (e.g., "18.12.")
 */
function formatShortDate(dateStr: string): string {
    const [day, month] = dateStr.split('.');
    return `${day}.${month}.`;
}

/**
 * Get gap icon component based on days between exams AND success rate risk.
 * Uses Lucide face icons for behavioral nudging.
 */
function getGapInfo(days: number, nextExamSuccessRate?: number): { Icon: typeof Frown | typeof TriangleAlert; color: string; tooltip: string; isRisk: boolean } {
    // Contextual Risk Intelligence:
    // If gap is short AND the upcoming exam has a low success rate (< 60%), trigger High Risk Warning.
    // DESIGN UPDATE: "Only one warning shines". We keep the gap distinct (temporal) and let the Card be the primary Risk Indicator.
    // So we calculate isRisk for styling (red line), but we don't change the Gap Icon to TriangleAlert.
    if (days <= 2 && nextExamSuccessRate !== undefined && nextExamSuccessRate < 0.6) {
        const ratePercent = Math.round(nextExamSuccessRate * 100);
        return { 
            Icon: Frown, // Downgraded from TriangleAlert to avoid "double warning" icons
            color: 'text-error', 
            tooltip: `Vysoké riziko: Následující zkouška má úspěšnost jen ${ratePercent}%. ${days} den na přípravu je kriticky málo.`,
            isRisk: true
        };
    }

    if (days <= 1) {
        return { Icon: Frown, color: 'text-error', tooltip: 'Vysoké riziko - malý čas na přípravu', isRisk: false };
    }
    if (days <= 3) {
        return { Icon: Meh, color: 'text-warning', tooltip: 'Těsné, ale zvládnutelné', isRisk: false };
    }
    if (days <= 6) {
        return { Icon: Smile, color: 'text-success', tooltip: 'Zdravé rozložení', isRisk: false };
    }
    return { Icon: Laugh, color: 'text-success', tooltip: 'Optimální pro zapamatování!', isRisk: false };
}

/**
 * Get spacing score message based on score value.
 */
function getScoreMessage(score: number): { text: string; Icon: typeof Frown } {
    if (score >= 90) return { text: 'Perfektní rozložení!', Icon: Laugh };
    if (score >= 70) return { text: 'Dobré rozložení', Icon: Smile };
    if (score >= 50) return { text: 'Některé zkoušky jsou blízko', Icon: Meh };
    return { text: 'Riziko přetížení', Icon: Frown };
}

/**
 * Get exam urgency color based on days until exam.
 * Temporal differentiation: closer exams = warmer colors.
 */
function getExamUrgency(dateStr: string): { colorClass: string; pulse: boolean } {
    const examDate = parseDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil(
        (examDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let result: { colorClass: string; pulse: boolean };
    if (daysUntil <= 1) result = { colorClass: 'text-error', pulse: true };
    else if (daysUntil <= 4) result = { colorClass: 'text-warning', pulse: false };
    else if (daysUntil <= 7) result = { colorClass: 'text-success', pulse: false };
    else result = { colorClass: 'text-primary', pulse: false };

    console.debug('[ExamTimeline] getExamUrgency:', { dateStr, examDate: examDate.toISOString(), daysUntil, result });
    return result;
}

export function ExamTimeline({ exams }: ExamTimelineProps) {
    // Extract registered exams from all subjects
    const registeredExams = useMemo<(RegisteredExam & { successRate?: number })[]>(() => {
        const registered: (RegisteredExam & { successRate?: number })[] = [];
        const ratesData = getStoredSuccessRates()?.data || {};

        exams.forEach(subject => {
            const subjectStats = ratesData[subject.code]?.stats; 
            let subjectRate: number | undefined;

            if (subjectStats && subjectStats.length > 0) {
                 // Calculate aggregated success rate across all semesters
                 let totalPass = 0;
                 let totalFail = 0;
                 subjectStats.forEach(sem => {
                     totalPass += sem.totalPass;
                     totalFail += sem.totalFail;
                 });
                 if (totalPass + totalFail > 0) {
                     subjectRate = totalPass / (totalPass + totalFail);
                 }
            }

            subject.sections.forEach(section => {
                if (section.status === 'registered' && section.registeredTerm) {
                    registered.push({
                        code: subject.code,
                        name: subject.name,
                        sectionName: section.name,
                        date: section.registeredTerm.date,
                        time: section.registeredTerm.time,
                        room: section.registeredTerm.room,
                        successRate: subjectRate
                    });
                }
            });
        });

        // Sort by date
        return registered.sort((a, b) =>
            parseDate(a.date).getTime() - parseDate(b.date).getTime()
        );
    }, [exams]);

    // Calculate spacing score (0-100) based on gaps between exams
    const spacingScore = useMemo(() => {
        if (registeredExams.length < 2) return 100;
        let score = 100;
        for (let i = 1; i < registeredExams.length; i++) {
            const gap = daysBetween(
                parseDate(registeredExams[i - 1].date),
                parseDate(registeredExams[i].date)
            );
            if (gap < 2) score -= 30;
            else if (gap < 4) score -= 10;
        }
        return Math.max(0, score);
    }, [registeredExams]);

    // If no registered exams, show empty state
    if (registeredExams.length === 0) {
        return (
            <div className="flex items-center gap-2 px-4 py-3 bg-base-200 rounded-lg text-base-content/60">
                <AlertCircle size={16} />
                <span className="text-sm">Žádné přihlášené zkoušky</span>
            </div>
        );
    }

    // Build timeline items with gaps
    const timelineItems: Array<
        | { type: 'exam'; exam: RegisteredExam & { successRate?: number }; isHighRisk: boolean }
        | { type: 'gap'; days: number; isWarning: boolean; nextExamRate?: number }
    > = [];

    registeredExams.forEach((exam, index) => {
        let isHighRisk = false;

        // Add gap indicator before this exam (except first)
        if (index > 0) {
            const prevExam = registeredExams[index - 1];
            const days = daysBetween(parseDate(prevExam.date), parseDate(exam.date));
            const isWarning = days < 2;
            
            // Check for High Risk Collision (Gap <= 2 days AND Success Rate < 60%)
            if (days <= 2 && exam.successRate !== undefined && exam.successRate < 0.6) {
                isHighRisk = true;
            }

            // Store the success rate of the UPCOMING exam (the one user is cramming for)
            timelineItems.push({ type: 'gap', days, isWarning, nextExamRate: exam.successRate });
        }

        timelineItems.push({ type: 'exam', exam, isHighRisk });
    });

    const scoreInfo = getScoreMessage(spacingScore);
    const ScoreIcon = scoreInfo.Icon;

    return (
        <div className="px-4 py-3 bg-base-200 rounded-lg overflow-x-auto">
            {/* Main Header */}
            <div className="flex items-center gap-2 mb-3">
                <CalendarCheck size={18} className="text-primary" />
                <h3 className="font-semibold text-base-content">Přihlášené zkoušky</h3>
            </div>
            {/* Spacing Score Header - only show when 2+ exams */}
            {registeredExams.length >= 2 && (
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-base-300">
                    <TrendingUp size={16} className="text-base-content/70" />
                    <span className="text-sm font-medium text-base-content/70">Rozložení:</span>
                    <progress
                        className={`progress w-24 ${spacingScore >= 70 ? 'progress-success' :
                            spacingScore >= 40 ? 'progress-warning' : 'progress-error'
                            }`}
                        value={spacingScore}
                        max={100}
                    />
                    <div className="flex items-center gap-1.5">
                        <ScoreIcon size={14} className={
                            spacingScore >= 70 ? 'text-success' :
                                spacingScore >= 40 ? 'text-warning' : 'text-error'
                        } />
                        <span className="text-xs text-base-content/60">
                            {scoreInfo.text}
                        </span>
                    </div>
                </div>
            )}

            <ul className="timeline timeline-horizontal w-full">
                {timelineItems.map((item, index) => {
                    if (item.type === 'gap') {
                        const { Icon: GapIcon, color, tooltip, isRisk } = getGapInfo(item.days, item.nextExamRate);

                        // Gap indicator with behavioral nudge icon
                        return (
                            <li key={`gap-${index}`}>
                                <hr className={item.isWarning || isRisk ? 'bg-error' : 'bg-base-300'} />
                                <div className="timeline-middle tooltip tooltip-bottom" data-tip={tooltip}>
                                    <div className="flex flex-col items-center">
                                        <GapIcon 
                                            size={12} 
                                            className={color} 
                                        />
                                        <span className={`text-2xs ${item.isWarning || isRisk ? 'text-error font-medium' : 'text-base-content/30'}`}>
                                            {item.days}d
                                        </span>
                                    </div>
                                </div>
                                <hr className={item.isWarning || isRisk ? 'bg-error' : 'bg-base-300'} />
                            </li>
                        );
                    }

                    // Exam item with temporal urgency coloring
                    const exam = item.exam;
                    const isFirst = index === 0;
                    const isLast = index === timelineItems.length - 1;
                    const urgency = getExamUrgency(exam.date);
                    
                    // Risk Contamination Style
                    const isRisk = item.isHighRisk;
                    const riskRate = exam.successRate ? Math.round(exam.successRate * 100) : 0;

                    // Use explicit class mapping for Tailwind JIT detection
                    const colorClasses = {
                        'text-error': urgency.colorClass === 'text-error',
                        'text-warning': urgency.colorClass === 'text-warning',
                        'text-success': urgency.colorClass === 'text-success',
                        'text-primary': urgency.colorClass === 'text-primary',
                    };
                    const activeColorClass = Object.entries(colorClasses).find(([, v]) => v)?.[0] || 'text-success';
                    
                    // Card styling: red border if risk, else current color
                    const cardBorderClass = isRisk ? 'border-error bg-error/5' : 'bg-base-100 border-current';
                    const titleClass = isRisk ? 'text-error' : activeColorClass;

                    return (
                        <li key={`exam-${exam.code}-${exam.date}`}>
                            {!isFirst && <hr className={isRisk ? 'bg-error' : 'bg-primary'} />}
                            <div 
                                className={`timeline-start timeline-box shadow-md border-l-[3px] ${cardBorderClass}`} 
                                style={{ borderColor: isRisk ? undefined : 'currentColor' }}
                            >
                                <div className="flex flex-col gap-1">
                                    <div className={`font-bold text-sm ${titleClass} whitespace-nowrap flex items-center gap-2`} title={exam.name}>
                                        {exam.name}
                                    </div>
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="text-xs text-base-content/60">{formatShortDate(exam.date)}</div>
                                        {isRisk && (
                                            <div 
                                                className="badge badge-error badge-xs gap-1 font-semibold text-white"
                                                title="Průměrná úspěšnost předmětu"
                                            >
                                                <TriangleAlert size={8} />
                                                Úsp. {riskRate}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className={`timeline-middle ${isRisk ? 'text-error' : activeColorClass} ${urgency.pulse || isRisk ? 'animate-pulse' : ''}`}>
                                {isRisk ? <TriangleAlert size={16} /> : <CheckCircle size={16} />}
                            </div>
                            {!isLast && <hr className={isRisk ? 'bg-error' : 'bg-primary'} />}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
