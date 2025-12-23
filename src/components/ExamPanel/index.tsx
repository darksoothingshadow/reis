/**
 * ExamPanel (Refactored)
 * 
 * Full-size exam registration panel with modular subcomponents.
 */

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useExams } from '../../hooks/data';
import { fetchExamData, registerExam, unregisterExam } from '../../api/exams';
import { ExamTimeline } from '../ExamTimeline';
import { StorageService } from '../../services/storage';
import type { ExamSubject, ExamSection, ExamFilterState } from '../../types/exams';

import { ExamPanelHeader, AutoBookingBanner } from './ExamPanelHeader';
import { ExamFilterBar, type StatusFilter } from './ExamFilterBar';
import { ExamSectionCard } from './ExamSectionCard';

interface ExamPanelProps {
    onClose: () => void;
}

const FILTER_STORAGE_KEY = 'exam_panel_filters';

export function ExamPanel({ onClose }: ExamPanelProps) {
    const { exams: storedExams, isLoaded, lastSync } = useExams();

    // Local state
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Sync stored exams to local state
    useEffect(() => {
        if (storedExams && storedExams.length > 0) {
            setExams(storedExams);
            setIsLoading(false);
        } else if (isLoaded) {
            setIsLoading(false);
        }
    }, [storedExams, isLoaded]);

    // Filter state with localStorage persistence
    const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return (stored?.statusFilter as StatusFilter) ?? 'available';
    });
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>(() => {
        const stored = StorageService.get<ExamFilterState>(FILTER_STORAGE_KEY);
        return stored?.selectedSubjects ?? [];
    });

    // Persist filter state
    useEffect(() => {
        StorageService.set(FILTER_STORAGE_KEY, { statusFilter, selectedSubjects });
    }, [statusFilter, selectedSubjects]);

    // UI state
    const [expandedSectionId, setExpandedSectionId] = useState<string | null>(null);
    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);
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

    // Computed values
    const filterCounts = useMemo(() => {
        const counts = { registered: 0, available: 0, opening: 0 };

        exams.forEach(subject => {
            subject.sections.forEach(section => {
                if (section.status === 'registered') {
                    counts.registered++;
                } else {
                    const hasAvailable = section.terms.some(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    const hasOpeningSoon = section.terms.some(term =>
                        !term.full && term.canRegisterNow !== true
                    );

                    if (hasAvailable) counts.available++;
                    if (hasOpeningSoon) counts.opening++;
                }
            });
        });

        return counts;
    }, [exams]);

    const subjectOptions = useMemo(() =>
        exams.map(e => ({ code: e.code, name: e.name }))
            .filter((v, i, a) => a.findIndex(t => t.code === v.code) === i)
            .sort((a, b) => a.name.localeCompare(b.name)),
        [exams]);

    const filteredSections = useMemo(() => {
        const results: Array<{ subject: ExamSubject; section: ExamSection }> = [];

        exams.forEach(subject => {
            if (selectedSubjects.length > 0 && !selectedSubjects.includes(subject.code)) return;

            subject.sections.forEach(section => {
                if (statusFilter === 'registered') {
                    if (section.status !== 'registered') return;
                    results.push({ subject, section });
                } else if (statusFilter === 'available') {
                    if (section.status === 'registered') return;
                    const availableTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow === true
                    );
                    if (availableTerms.length === 0) return;
                    results.push({ subject, section: { ...section, terms: availableTerms } });
                } else if (statusFilter === 'opening') {
                    if (section.status === 'registered') return;
                    const openingTerms = section.terms.filter(term =>
                        !term.full && term.canRegisterNow !== true
                    );
                    if (openingTerms.length === 0) return;
                    results.push({ subject, section: { ...section, terms: openingTerms } });
                } else {
                    results.push({ subject, section });
                }
            });
        });

        return results;
    }, [exams, statusFilter, selectedSubjects]);

    // Handlers
    const handleRegister = async (section: ExamSection, termId: string) => {
        setProcessingSectionId(section.id);

        try {
            if (section.status === 'registered' && section.registeredTerm?.id) {
                const unregResult = await unregisterExam(section.registeredTerm.id);
                if (!unregResult.success) {
                    toast.error(unregResult.error || 'Nepodařilo se odhlásit z předchozího termínu.');
                    setProcessingSectionId(null);
                    return;
                }
            }

            const regResult = await registerExam(termId);
            if (regResult.success) {
                toast.success('Úspěšně přihlášeno na termín!');
                const data = await fetchExamData();
                setExams(data);
                setExpandedSectionId(null);
            } else {
                toast.error(regResult.error || 'Registrace selhala.');
            }
        } catch {
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

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
        } catch {
            toast.error('Nastala neočekávaná chyba.');
        } finally {
            setProcessingSectionId(null);
        }
    };

    const toggleExpand = (sectionId: string) => {
        setExpandedSectionId(prev => prev === sectionId ? null : sectionId);
    };

    const toggleSubjectFilter = (code: string) => {
        setSelectedSubjects(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    };

    return (
        <>
            <div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden">
                <ExamPanelHeader lastSync={lastSync} onClose={onClose} />
                
                <AutoBookingBanner 
                    isActive={!!autoBookingTermId} 
                    onCancel={() => setAutoBookingTermId(null)} 
                />

                {/* Timeline */}
                <div className="px-6 py-3 border-b border-base-200">
                    <ExamTimeline exams={exams} />
                </div>

                <ExamFilterBar
                    statusFilter={statusFilter}
                    selectedSubjects={selectedSubjects}
                    filterCounts={filterCounts}
                    subjectOptions={subjectOptions}
                    onStatusChange={setStatusFilter}
                    onToggleSubject={toggleSubjectFilter}
                    onClearFilters={() => setSelectedSubjects([])}
                />

                {/* Content */}
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
                        filteredSections.map(({ subject, section }) => (
                            <ExamSectionCard
                                key={section.id}
                                subject={subject}
                                section={section}
                                isExpanded={expandedSectionId === section.id}
                                isProcessing={processingSectionId === section.id}
                                onToggleExpand={toggleExpand}
                                onRegister={handleRegister}
                                onUnregister={handleUnregister}
                            />
                        ))
                    )}
                </div>
            </div>
        </>
    );
}
