/**
 * ExamPanel - Full-size exam registration panel.
 * 
 * Replaces ExamDrawer with a calendar-sized view:
 * - ExamTimeline header showing registered exams with gaps
 * - Status tabs for filtering (Přihlášen | Volné | Otevírá se)
 * - Subject chip filters
 * - Enhanced table rows with capacity progress bars
 * 
 * Uses DaisyUI components per @daisy-enforcer requirements.
 */

import { useState, useEffect, useMemo } from 'react';
import { X, ExternalLink, ChevronDown, ChevronUp, CheckCircle2, CalendarDays, Timer, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useExams } from '../hooks/data';
import { fetchExamData, registerExam, unregisterExam } from '../api/exams';
import { ExamTimeline } from './ExamTimeline';
import { TermTile } from './TermTile';
import { StorageService } from '../services/storage';
import type { ExamSubject, ExamSection, ExamFilterState } from '../types/exams';

interface ExamPanelProps {
    onClose: () => void;
}

const FILTER_STORAGE_KEY = 'exam_panel_filters';

/**
 * Get day of week abbreviation from date string.
 */
function getDayOfWeek(dateString: string): string {
    const [day, month, year] = dateString.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    return days[date.getDay()];
}

/**
 * Parse capacity string (e.g., "18/20") to percentage.
 */
function capacityToPercent(capacity?: string): number {
    if (!capacity) return 0;
    const [occupied, total] = capacity.split('/').map(Number);
    if (isNaN(occupied) || isNaN(total) || total === 0) return 0;
    return Math.min(100, (occupied / total) * 100);
}

/**
 * Format timestamp to relative time string.
 */
function formatRelativeTime(timestamp: number | null): string {
    if (!timestamp) return 'Neznámý čas';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return 'Právě teď';
    if (diffMinutes < 60) return `Před ${diffMinutes} min`;
    if (diffHours < 24) return `Před ${diffHours} h`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}

export function ExamPanel({ onClose }: ExamPanelProps) {
    // Get stored exam data from hook
    const { exams: storedExams, isLoaded, lastSync } = useExams();

    // Local state for exams (allows updates after registration)
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Sync stored exams to local state
    useEffect(() => {
        console.debug('[ExamPanel] Data sync effect. storedExams:', storedExams?.length, 'isLoaded:', isLoaded);
        if (storedExams && storedExams.length > 0) {
            console.debug('[ExamPanel] Loading exams from storage:', storedExams.length, 'subjects');
            storedExams.forEach(s => {
                console.debug('[ExamPanel]   Subject:', s.code, 'sections:', s.sections.map(sec => ({
                    name: sec.name,
                    status: sec.status,
                    hasRegisteredTerm: !!sec.registeredTerm,
                    terms: sec.terms.length
                })));
            });
            setExams(storedExams);
            setIsLoading(false);
        } else if (isLoaded) {
            console.debug('[ExamPanel] Storage loaded but no exams found');
            setIsLoading(false);
        }
    }, [storedExams, isLoaded]);

    // Filter state with localStorage persistence
    const [statusFilter, setStatusFilter] = useState<'registered' | 'available' | 'opening'>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return stored?.statusFilter ?? 'available';
    });
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return stored?.selectedSubjects ?? [];
    });

    // Persist filter state
    useEffect(() => {
        StorageService.set(FILTER_STORAGE_KEY, { statusFilter, selectedSubjects });
    }, [statusFilter, selectedSubjects]);

    // Expandable section state (replaces popup)
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);

    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);

    // Auto-booking state
    const [autoBookingTermId, setAutoBookingTermId] = useState<string | null>(null);

    // Escape key handler
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (expandedSectionId) {
                    setExpandedSectionId(null);
                } else {
                    onClose();
                }
            }
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, expandedSectionId]);

    const filterCounts = useMemo(() => {
        const counts = { registered: 0, available: 0, opening: 0 };

        exams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered') {
                    counts.registered++;
                } else {
                    // Simple logic:
                    // "Volné" = has terms where canRegisterNow === true
                    // "Otevírá se" = has terms where canRegisterNow !== true (false or undefined)
                    const hasAvailable = section.terms.some(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    const hasOpeningSoon = section.terms.some(term =>
                        !term.full && term.canRegisterNow !== true
                    );

                    if (hasAvailable) {
                        counts.available++;
                    }
                    if (hasOpeningSoon) {
                        counts.opening++;
                    }
                }
            });
        });

        return counts;
    }, [exams]);

    // Get unique subjects for chip filters (code for filtering, name for display)
    const subjectOptions = useMemo(() =>
        exams.map(e => ({ code: e.code, name: e.name }))
            .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [exams]);

    // Filter exams based on current filters
    const filteredSections = useMemo(() => {
        console.debug('[ExamPanel] Filtering exams. statusFilter:', statusFilter, 'selectedSubjects:', selectedSubjects);
        console.debug('[ExamPanel] Total subjects:', exams.length);

        const results: Array<{ subject: ExamSubject; section: ExamSection }> = [];

        exams.forEach(subject => {
            // Subject filter
            if (selectedSubjects.length > 0 && !selectedSubjects.includes(subject.code)) {
                console.debug('[ExamPanel] Skipping subject (not in filter):', subject.code);
                return;
            }

            subject.sections.forEach(section => {
                console.debug('[ExamPanel] Processing section:', {
                    subject: subject.code,
                    section: section.name,
                    status: section.status,
                    hasRegisteredTerm: !!section.registeredTerm,
                    termsCount: section.terms.length
                });

                // Status filter logic - determine which terms to include
                if (statusFilter === 'registered') {
                    // Only show sections where user is already registered
                    if (section.status !== 'registered') {
                        console.debug('[ExamPanel] Filtered out (not registered):', section.name);
                        return;
                    }
                    // Show all terms for registered sections
                    results.push({ subject, section });
                } else if (statusFilter === 'available') {
                    // Show only canRegisterNow === true terms
                    if (section.status === 'registered') {
                        console.debug('[ExamPanel] Filtered out (already registered):', section.name);
                        return;
                    }
                    const availableTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    if (availableTerms.length === 0) {
                        console.debug('[ExamPanel] Filtered out (no available terms):', section.name);
                        return;
                    }
                    // Create a modified section with only the filtered terms
                    const filteredSection = { ...section, terms: availableTerms };
                    console.debug('[ExamPanel] ✓ Section passed filter (available):', section.name, 'terms:', availableTerms.length);
                    results.push({ subject, section: filteredSection });
                } else if (statusFilter === 'opening') {
                    // Show only canRegisterNow !== true terms
                    if (section.status === 'registered') {
                        console.debug('[ExamPanel] Filtered out (already registered):', section.name);
                        return;
                    }
                    const openingTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow !== true
                    );
                    if (openingTerms.length === 0) {
                        console.debug('[ExamPanel] Filtered out (no opening soon terms):', section.name);
                        return;
                    }
                    // Create a modified section with only the filtered terms
                    const filteredSection = { ...section, terms: openingTerms };
                    console.debug('[ExamPanel] ✓ Section passed filter (opening):', section.name, 'terms:', openingTerms.length);
                    results.push({ subject, section: filteredSection });
                } else {
                    // No status filter - show all terms
                    console.debug('[ExamPanel] ✓ Section passed filter (no filter):', section.name);
                    results.push({ subject, section });
                }
            });
        });

        console.debug('[ExamPanel] Filter result:', results.length, 'sections');
        return results;
    }, [exams, statusFilter, selectedSubjects]);

    // Registration handler
    const handleRegister = async (section: ExamSection, termId: string) => {
        setProcessingSectionId(section.id);

        try {
            // If already registered, unregister first
            if (section.status === 'registered' && section.registeredTerm?.id) {
                const unregResult = await unregisterExam(section.registeredTerm.id);
                if (!unregResult.success) {
                    toast.error(unregResult.error || 'Nepodařilo se odhlásit z předchozího termínu.');
                    setProcessingSectionId(null);
                    return;
                }
            }

            // Register for new term
            const regResult = await registerExam(termId);
            if (regResult.success) {
                console.debug('[ExamPanel] Registration successful, refreshing data');
                toast.success('Úspěšně přihlášeno na termín!');
                const data = await fetchExamData();
                setExams(data);
                setExpandedSectionId(null); // Collapse after registration
            } else {
                toast.error(regResult.error || 'Registrace selhala.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

    // Unregister handler
    const handleUnregister = async (section: ExamSection) => {
        if (!section.registeredTerm?.id) {
            toast.error('Chybí ID termínu.');
            return;
        }

        setProcessingSectionId(section.id);

        try {
            const result = await unregisterExam(section.registeredTerm.id);
            if (result.success) {
                toast.success('Úspěšně odhlášeno z termínu.');
                const data = await fetchExamData();
                setExams(data);
            } else {
                toast.error(result.error || 'Odhlášení selhalo.');
            }
        } catch (err) {
            console.error(err);
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

    const toggleExpand = (sectionId: string) => {
        console.debug('[ExamPanel] Toggle expand:', sectionId);
        setExpandedSectionId(prev => prev === sectionId ? null : sectionId);
    };

    const toggleSubjectFilter = (code: string) => {
        setSelectedSubjects(prev =>
            prev.includes(code)
                ? prev.filter(c => c !== code)
                : [...prev, code]
        );
    };

    const clearAllFilters = () => {
        setSelectedSubjects([]);
    };

    return (
        <>
            <div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-base-200 bg-base-100">
                    <div className="flex flex-col">
                        <h2 className="text-xl font-semibold text-base-content">Zápisy na zkoušky</h2>
                        <span className="text-xs text-base-content/50">
                            Aktualizováno: {formatRelativeTime(lastSync)}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <a
                            href="https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-ghost btn-sm gap-1"
                        >
                            <ExternalLink size={14} />
                            IS MENDELU
                        </a>
                        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Auto-booking Banner */}
                {autoBookingTermId && (
                    <div className="flex items-center gap-3 px-6 py-2 bg-warning/10 border-b border-warning/20">
                        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
                        <span className="text-sm text-warning font-medium">
                            Auto-rezervace aktivní. Nezavírejte tuto stránku!
                        </span>
                        <button
                            onClick={() => setAutoBookingTermId(null)}
                            className="btn btn-ghost btn-xs ml-auto"
                        >
                            Zrušit
                        </button>
                    </div>
                )}

                {/* Timeline Header */}
                <div className="px-6 py-3 border-b border-base-200">
                    <ExamTimeline exams={exams} />
                </div>

                {/* Filter Bar - Redesigned for clarity */}
                <div className="px-6 py-4 border-b border-base-200 space-y-4">
                    {/* Status Segmented Control */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setStatusFilter('registered')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${statusFilter === 'registered'
                                ? 'bg-success/15 text-success border-2 border-success'
                                : 'bg-base-200 text-base-content/70 border-2 border-transparent hover:bg-base-300'
                                }`}
                        >
                            <CheckCircle2 size={18} />
                            <span>Přihlášen</span>
                            <span className={`badge badge-sm ${statusFilter === 'registered' ? 'badge-success' : 'badge-ghost'}`}>
                                {filterCounts.registered}
                            </span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('available')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${statusFilter === 'available'
                                ? 'bg-primary/15 text-primary border-2 border-primary'
                                : 'bg-base-200 text-base-content/70 border-2 border-transparent hover:bg-base-300'
                                }`}
                        >
                            <CalendarDays size={18} />
                            <span>Volné</span>
                            <span className={`badge badge-sm ${statusFilter === 'available' ? 'badge-primary' : 'badge-ghost'}`}>
                                {filterCounts.available}
                            </span>
                        </button>
                        <button
                            onClick={() => setStatusFilter('opening')}
                            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg font-medium transition-all ${statusFilter === 'opening'
                                ? 'bg-warning/15 text-warning border-2 border-warning'
                                : 'bg-base-200 text-base-content/70 border-2 border-transparent hover:bg-base-300'
                                }`}
                        >
                            <Timer size={18} />
                            <span>Otevírá se</span>
                            <span className={`badge badge-sm ${statusFilter === 'opening' ? 'badge-warning' : 'badge-ghost'}`}>
                                {filterCounts.opening}
                            </span>
                        </button>
                    </div>

                    {/* Subject Chips - Larger touch targets */}
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-base-content/60 mr-1">Předmět:</span>
                        {subjectOptions.map(({ code, name }) => {
                            const isSelected = selectedSubjects.includes(code);
                            return (
                                <button
                                    key={code}
                                    onClick={() => toggleSubjectFilter(code)}
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
                                onClick={clearAllFilters}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm text-error/80 hover:text-error hover:bg-error/10 transition-colors"
                            >
                                <X size={14} />
                                Vymazat
                            </button>
                        )}
                    </div>
                </div>

                {/* Content - Exam List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-32 text-base-content/50">
                            <span className="loading loading-spinner loading-md mr-2"></span>
                            Načítání zkoušek...
                        </div>
                    ) : filteredSections.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-32 text-base-content/50">
                            <span className="text-4xl mb-2">📭</span>
                            <span>Žádné zkoušky pro vybrané filtry</span>
                        </div>
                    ) : (
                        filteredSections.map(({ subject, section }) => {
                            const isProcessing = processingSectionId === section.id;
                            const isRegistered = section.status === 'registered';

                            return (
                                <div
                                    key={section.id}
                                    className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="card-body p-4">
                                        <div className="flex items-start justify-between gap-4">
                                            {/* Left: Subject + Section Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="badge badge-primary badge-sm font-semibold">
                                                        {subject.name}
                                                    </span>
                                                    <span className="text-sm font-medium text-base-content truncate">
                                                        {section.name}
                                                    </span>
                                                    {isRegistered && (
                                                        <span className="badge badge-success badge-sm">Přihlášen</span>
                                                    )}
                                                </div>

                                                {/* Registered Term Details */}
                                                {isRegistered && section.registeredTerm && (
                                                    <div className="text-sm text-base-content/70 flex flex-col gap-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span>📅 {section.registeredTerm.date} ({getDayOfWeek(section.registeredTerm.date)})</span>
                                                            <span className="text-base-content/30">•</span>
                                                            <span>⏰ {section.registeredTerm.time}</span>
                                                            {section.registeredTerm.room && (
                                                                <>
                                                                    <span className="text-base-content/30">•</span>
                                                                    <span>📍 {section.registeredTerm.room}</span>
                                                                </>
                                                            )}
                                                        </div>

                                                        {section.registeredTerm.deregistrationDeadline && (
                                                            <div className="flex items-center gap-1.5 text-xs text-warning mt-1">
                                                                <AlertCircle size={12} />
                                                                <span>Odhlášení do: {section.registeredTerm.deregistrationDeadline}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Available Terms Summary - only when collapsed */}
                                                {!isRegistered && section.terms.length > 0 && expandedSectionId !== section.id && (
                                                    <div className="flex items-center gap-3 mt-2">
                                                        <span className="text-xs text-base-content/50">
                                                            {section.terms.length} termín{section.terms.length > 1 ? 'ů' : ''}
                                                        </span>
                                                        {section.terms.slice(0, 3).map(term => (
                                                            <div key={term.id} className="flex items-center gap-1">
                                                                <span className="text-xs text-base-content/70">
                                                                    {term.date.split('.').slice(0, 2).join('.')}
                                                                </span>
                                                                {term.capacity && (
                                                                    <progress
                                                                        className={`progress w-12 h-1.5 ${term.full ? 'progress-error' : 'progress-primary'
                                                                            }`}
                                                                        value={capacityToPercent(term.capacity)}
                                                                        max="100"
                                                                    />
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Right: Action Buttons */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                {/* Unregister button for registered exams */}
                                                {isRegistered && (
                                                    <button
                                                        onClick={() => handleUnregister(section)}
                                                        disabled={isProcessing}
                                                        className="btn btn-sm btn-error btn-outline gap-1"
                                                    >
                                                        {isProcessing ? (
                                                            <span className="loading loading-spinner loading-xs"></span>
                                                        ) : (
                                                            'Odhlásit se'
                                                        )}
                                                    </button>
                                                )}

                                                {/* Expand button to show other terms */}
                                                {section.terms.length > 0 && (
                                                    <button
                                                        onClick={() => toggleExpand(section.id)}
                                                        disabled={isProcessing}
                                                        className={`btn btn-sm btn-ghost gap-1`}
                                                    >
                                                        {expandedSectionId === section.id ? (
                                                            <>Zavřít <ChevronUp size={14} /></>
                                                        ) : (
                                                            <>{isRegistered ? 'Změnit' : 'Vybrat'} <ChevronDown size={14} /></>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        {/* Expanded: Inline Term Tiles */}
                                        {expandedSectionId === section.id && section.terms.length > 0 && (
                                            <div className="mt-4 pt-3 border-t border-base-200">
                                                <div className="text-xs text-base-content/50 mb-2">
                                                    Klikněte pro přihlášení:
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {section.terms.map(term => (
                                                        <TermTile
                                                            key={term.id}
                                                            term={term}
                                                            onSelect={() => {
                                                                console.debug('[ExamPanel] Direct registration for term:', term.id);
                                                                handleRegister(section, term.id);
                                                            }}
                                                            isProcessing={isProcessing}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </>
    );
}
