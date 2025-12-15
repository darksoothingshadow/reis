import { X, ChevronDown } from 'lucide-react';
import { Accordion, AccordionItem, AccordionHeader, AccordionContent, AccordionTrigger } from './ui/accordion';
import { Button } from './ui/button';
import { useState, useEffect, useRef } from 'react';
import { fetchExamData, registerExam, unregisterExam } from '../api/exams';
import { useExams } from '../hooks/data';
import { DatePickerPopup } from './DatePickerPopup';

// Re-export types from centralized types file
export type { ExamTerm, ExamSection, ExamSubject } from '../types/exams';
import type { ExamTerm, ExamSection, ExamSubject } from '../types/exams';

interface ExamDrawerProps {
    isOpen: boolean;
    onClose: () => void;
}

function getDayOfWeek(dateString: string): string {
    const [day, month, year] = dateString.split('.');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const days = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
    return days[date.getDay()];
}

export function ExamDrawer({ isOpen, onClose }: ExamDrawerProps) {
    if (!isOpen) return null;

    // Get stored exam data from hook (stale-while-revalidate)
    const { exams: storedExams, isLoaded } = useExams();

    // Local state for exams (allows updates after registration actions)
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, _setError] = useState<string | null>(null);

    // Sync stored exams to local state
    useEffect(() => {
        if (storedExams && storedExams.length > 0) {
            setExams(storedExams);
            setIsLoading(false);
        } else if (isLoaded) {
            setIsLoading(false);
        }
    }, [storedExams, isLoaded]);

    // Accordion Control
    const [expandedSubjectId, setExpandedSubjectId] = useState<string>("");

    // Popup state - now stores anchor ref too
    const [popupSection, setPopupSection] = useState<ExamSection | null>(null);
    const [popupAnchor, setPopupAnchor] = useState<HTMLButtonElement | null>(null);
    const popupAnchorRef = useRef<HTMLButtonElement | null>(null);
    popupAnchorRef.current = popupAnchor;

    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);

    // Auto-booking state
    const [autoBookingTermId, setAutoBookingTermId] = useState<string | null>(null);
    // const [now, setNow] = useState(new Date());

    // useEffect(() => {
    //     const interval = setInterval(() => setNow(new Date()), 1000);
    //     return () => clearInterval(interval);
    // }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (popupSection) {
                    setPopupSection(null);
                } else {
                    onClose();
                }
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose, popupSection]);

    const parseDate = (dateStr: string): Date => {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('.').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    };

    // Auto-booking effect
    useEffect(() => {
        if (!autoBookingTermId) return;

        const interval = setInterval(() => {
            let foundTerm: ExamTerm | undefined;
            let foundSection: ExamSection | undefined;

            for (const subject of exams) {
                for (const section of subject.sections) {
                    const term = section.terms.find(t => t.id === autoBookingTermId);
                    if (term) {
                        foundTerm = term;
                        foundSection = section;
                        break;
                    }
                }
                if (foundTerm) break;
            }

            if (foundTerm && foundSection && foundTerm.registrationStart) {
                const start = parseDate(foundTerm.registrationStart);
                if (new Date() >= start) {
                    handleRegister(foundSection, foundTerm.id);
                    setAutoBookingTermId(null);
                }
            } else {
                setAutoBookingTermId(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [autoBookingTermId, exams]);

    const handleRegister = async (section: ExamSection, termId: string) => {
        setProcessingSectionId(section.id);

        try {
            // If already registered and we are changing, unregister first
            if (section.status === 'registered' && section.registeredTerm?.id) {
                const successUnreg = await unregisterExam(section.registeredTerm.id);
                if (!successUnreg) {
                    alert("Failed to unregister from previous term.");
                    setProcessingSectionId(null);
                    return;
                }
            }

            // Register for new term
            const successReg = await registerExam(termId);
            if (successReg) {
                // Refresh data
                const data = await fetchExamData();
                setExams(data);
                // Close popup
                setPopupSection(null);
            } else {
                alert("Registration failed. The term might be full.");
            }
        } catch (err) {
            console.error(err);
            alert("An error occurred.");
        } finally {
            setProcessingSectionId(null);
        }
    };

    const openDatePicker = (section: ExamSection, button: HTMLButtonElement) => {
        setPopupSection(section);
        setPopupAnchor(button);
    };

    const closeDatePicker = () => {
        setPopupSection(null);
        setPopupAnchor(null);
    };

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
                {/* Layer 0: Scrim */}
                <div
                    className="absolute inset-0 bg-black/15 transition-opacity"
                    onClick={onClose}
                />

                {/* Drawer Container - No floating calendar */}
                <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                    {/* Layer 1: The Component - Exam Drawer */}
                    <div className="w-[600px] bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-gray-100 font-sans h-full animate-in slide-in-from-right duration-300 pointer-events-auto">

                        {/* Header */}
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Zkoušky</h2>
                            <button
                                onClick={onClose}
                                className="btn btn-ghost btn-circle btn-sm -mr-2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Auto-booking Banner */}
                        {autoBookingTermId && (
                            <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center gap-3 animate-in slide-in-from-top-2">
                                <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-sm text-amber-800 font-medium">
                                    Auto-rezervace aktivní. Nezavírejte tuto záložku!
                                </span>
                            </div>
                        )}

                        {/* Content - Scrollable List */}
                        <div className="flex-1 overflow-y-auto">
                            {isLoading ? (
                                <div className="flex items-center justify-center h-full text-slate-400">
                                    Načítání zkoušek...
                                </div>
                            ) : error ? (
                                <div className="flex items-center justify-center h-full text-error">
                                    {error}
                                </div>
                            ) : (
                                <Accordion
                                    type="single"
                                    collapsible
                                    className="flex flex-col"
                                    value={expandedSubjectId}
                                    onValueChange={setExpandedSubjectId}
                                >
                                    {exams.map((subject) => {
                                        const isRegistered = subject.sections.some(s => s.status === 'registered');

                                        return (
                                            <AccordionItem key={subject.id} value={subject.id} className="border-b border-slate-100 last:border-0">
                                                <AccordionHeader className="flex">
                                                    <AccordionTrigger className="flex flex-1 items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-all group data-[state=open]:bg-slate-50/50">
                                                        <div className="flex flex-col items-start gap-0.5">
                                                            <span className="font-semibold text-slate-900 text-base truncate max-w-[350px]">{subject.name}</span>
                                                            <span className="text-xs text-slate-500 font-medium">{subject.code}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {!isRegistered && (
                                                                <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                            )}
                                                            <ChevronDown className="text-slate-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" size={16} />
                                                        </div>
                                                    </AccordionTrigger>
                                                </AccordionHeader>
                                                <AccordionContent className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                                    <div className="px-6 py-4 bg-slate-50/50 space-y-2">
                                                        {subject.sections.map((section) => {
                                                            const isProcessing = processingSectionId === section.id;

                                                            return (
                                                                <div
                                                                    key={section.id}
                                                                    className="group flex items-center justify-between p-3 rounded-lg transition-all border hover:bg-white hover:shadow-sm border-transparent hover:border-slate-200"
                                                                >
                                                                    {/* Left: Section Name */}
                                                                    <div className="flex flex-col gap-0.5 min-w-0">
                                                                        <span className="font-medium text-slate-900 text-sm capitalize truncate" title={section.name}>
                                                                            {section.name}
                                                                        </span>
                                                                        {section.status === 'registered' && section.registeredTerm && (
                                                                            <span className="text-xs text-slate-500">
                                                                                {section.registeredTerm.date} {section.registeredTerm.time} ({getDayOfWeek(section.registeredTerm.date)})
                                                                                {section.registeredTerm.room && ` • ${section.registeredTerm.room}`}
                                                                            </span>
                                                                        )}
                                                                    </div>

                                                                    {/* Right: Action Button */}
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        {section.status === 'registered' ? (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={(e) => openDatePicker(section, e.currentTarget)}
                                                                                disabled={isProcessing}
                                                                                className="text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                                                            >
                                                                                Změnit
                                                                            </Button>
                                                                        ) : (
                                                                            <Button
                                                                                size="sm"
                                                                                onClick={(e) => openDatePicker(section, e.currentTarget)}
                                                                                disabled={isProcessing}
                                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                                                                            >
                                                                                Vyber datum
                                                                            </Button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </AccordionContent>
                                            </AccordionItem>
                                        );
                                    })}
                                </Accordion>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center">
                            <a
                                href="https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors flex items-center gap-1"
                            >
                                Přejít na stránku zkoušek v IS
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            {/* Date Picker Popup */}
            <DatePickerPopup
                isOpen={!!popupSection}
                onClose={closeDatePicker}
                onConfirm={(termId) => popupSection && handleRegister(popupSection, termId)}
                terms={popupSection?.terms ?? []}
                anchorRef={popupAnchorRef}
                allExams={exams}
            />
        </>
    );
}
