/**
 * ExamPanel Filter Bar Component
 */

import { CheckCircle2, CalendarDays, Timer, Check, X } from 'lucide-react';

export type StatusFilter = 'registered' | 'available' | 'opening';

interface FilterCounts {
    registered: number;
    available: number;
    opening: number;
}

interface SubjectOption {
    code: string;
    name: string;
}

interface ExamFilterBarProps {
    statusFilter: StatusFilter;
    selectedSubjects: string[];
    filterCounts: FilterCounts;
    subjectOptions: SubjectOption[];
    onStatusChange: (status: StatusFilter) => void;
    onToggleSubject: (code: string) => void;
    onClearFilters: () => void;
}

export function ExamFilterBar({
    statusFilter,
    selectedSubjects,
    filterCounts,
    subjectOptions,
    onStatusChange,
    onToggleSubject,
    onClearFilters
}: ExamFilterBarProps) {
    return (
        <div className="px-6 py-4 border-b border-base-200 space-y-4">
            {/* Status Segmented Control */}
            <div className="flex gap-2">
                <StatusButton
                    active={statusFilter === 'registered'}
                    onClick={() => onStatusChange('registered')}
                    icon={<CheckCircle2 size={18} />}
                    label="Přihlášen"
                    count={filterCounts.registered}
                    colorClass="success"
                />
                <StatusButton
                    active={statusFilter === 'available'}
                    onClick={() => onStatusChange('available')}
                    icon={<CalendarDays size={18} />}
                    label="Volné"
                    count={filterCounts.available}
                    colorClass="primary"
                />
                <StatusButton
                    active={statusFilter === 'opening'}
                    onClick={() => onStatusChange('opening')}
                    icon={<Timer size={18} />}
                    label="Otevírá se"
                    count={filterCounts.opening}
                    colorClass="warning"
                />
            </div>

            {/* Subject Chips */}
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-base-content/60 mr-1">Předmět:</span>
                {subjectOptions.map(({ code, name }) => {
                    const isSelected = selectedSubjects.includes(code);
                    return (
                        <button
                            key={code}
                            onClick={() => onToggleSubject(code)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${isSelected
                                ? 'bg-primary text-primary-content'
                                : 'bg-base-200 text-base-content/70 hover:bg-base-300'
                            }`}
                        >
                            {isSelected && <Check size={14} />}
                            {name}
                        </button>
                    );
                })}
                {selectedSubjects.length > 0 && (
                    <button
                        onClick={onClearFilters}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-error/80 hover:text-error hover:bg-error/10 transition-colors"
                    >
                        <X size={14} />
                        Vymazat
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * Status filter button
 */
interface StatusButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    count: number;
    colorClass: 'success' | 'primary' | 'warning';
}

function StatusButton({ active, onClick, icon, label, count, colorClass }: StatusButtonProps) {
    const activeClasses = {
        success: 'bg-success/15 text-success border-2 border-success',
        primary: 'bg-primary/15 text-primary border-2 border-primary',
        warning: 'bg-warning/15 text-warning border-2 border-warning'
    };

    const badgeClasses = {
        success: 'badge-success',
        primary: 'badge-primary',
        warning: 'badge-warning'
    };

    return (
        <button
            onClick={onClick}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${active
                ? activeClasses[colorClass]
                : 'bg-base-200 text-base-content/70 border-2 border-transparent hover:bg-base-300'
            }`}
        >
            {icon}
            <span>{label}</span>
            <span className={`badge badge-sm ${active ? badgeClasses[colorClass] : 'badge-ghost'}`}>
                {count}
            </span>
        </button>
    );
}
