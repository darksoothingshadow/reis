import { X, ChevronDown, Calendar, Clock } from 'lucide-react';
import * as Accordion from '@radix-ui/react-accordion';
import { Button } from './ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select"
import { useState, useEffect } from 'react';
import { fetchExamData, registerExam, unregisterExam } from '../api/exams';

export interface ExamTerm {
    id: string;
    date: string;
    time: string;
    capacity?: string;
    full?: boolean;
    room?: string;
    teacher?: string;
    registrationStart?: string;
}

export interface ExamSection {
    id: string;
    name: string;
    type: string;
    status: string;
    registeredTerm?: { id?: string; date: string; time: string; room?: string; teacher?: string };
    terms: ExamTerm[];
}

export interface ExamSubject {
    id: string;
    name: string;
    code: string;
    sections: ExamSection[];
}

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

    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setIsLoading(true);
            fetchExamData()
                .then(data => {
                    setExams(data);
                    setIsLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setError("Failed to load exams");
                    setIsLoading(false);
                });
        }
    }, [isOpen]);

    const [selections, setSelections] = useState<Record<string, { date: string | undefined; time: string | undefined }>>({});
    const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
    const [processingSectionId, setProcessingSectionId] = useState<string | null>(null);
    const [autoBookingTermId, setAutoBookingTermId] = useState<string | null>(null);
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    const parseDate = (dateStr: string): Date => {
        const [datePart, timePart] = dateStr.split(' ');
        const [day, month, year] = datePart.split('.').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    };

    useEffect(() => {
        if (!autoBookingTermId) return;

        const interval = setInterval(() => {
            // Find the term
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
                // Term not found or no start date, stop
                setAutoBookingTermId(null);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [autoBookingTermId, exams]);

    const toggleEdit = (sectionId: string) => {
        setEditingSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    const handleDateSelect = (sectionId: string, date: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: { date, time: undefined } // Reset time when date changes
        }));
    };

    const handleTimeSelect = (sectionId: string, timeId: string) => {
        setSelections(prev => ({
            ...prev,
            [sectionId]: { ...prev[sectionId], time: timeId }
        }));
    };

    const handleRegister = async (section: ExamSection, termId: string) => {
        setProcessingSectionId(section.id);

        try {
            // If already registered and we are changing (editing), unregister first
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
                // Reset edit state
                setEditingSections(prev => ({ ...prev, [section.id]: false }));
                // Reset selection
                setSelections(prev => ({ ...prev, [section.id]: { date: undefined, time: undefined } }));
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

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            {/* Layer 0: Scrim */}
            <div
                className="absolute inset-0 bg-black/15 transition-opacity"
                onClick={onClose}
            />

            {/* Layer 1: The Component - Exam Drawer */}
            <div className="relative w-[800px] bg-white shadow-2xl rounded-2xl flex flex-col animate-in slide-in-from-right duration-300 overflow-hidden border border-gray-100 font-sans">

                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Zkoušky</h2>
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-full transition-colors"
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
                        <div className="flex items-center justify-center h-full text-red-500">
                            {error}
                        </div>
                    ) : (
                        <Accordion.Root type="single" collapsible className="flex flex-col">
                            {exams.map((subject) => {
                                // Determine subject status for the badge/dot
                                // If any section is registered -> Green Check
                                // If any section is open -> Orange Dot
                                const isRegistered = subject.sections.some(s => s.status === 'registered');

                                return (
                                    <Accordion.Item key={subject.id} value={subject.id} className="border-b border-slate-100 last:border-0">
                                        <Accordion.Header className="flex">
                                            <Accordion.Trigger className="flex flex-1 items-center justify-between px-6 py-4 bg-white hover:bg-slate-50 transition-all group data-[state=open]:bg-slate-50/50">
                                                <div className="flex flex-col items-start gap-0.5">
                                                    <span className="font-semibold text-slate-900 text-base truncate max-w-[250px]">{subject.code}</span>
                                                    <span className="text-sm text-slate-500 font-medium">{subject.name.replace(/ZS\s+\d{4}\/\d{4}\s+-\s+\w+/, '').trim()}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {!isRegistered && (
                                                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                                                    )}
                                                    <ChevronDown className="text-slate-400 transition-transform duration-200 ease-out group-data-[state=open]:rotate-180" size={16} />
                                                </div>
                                            </Accordion.Trigger>
                                        </Accordion.Header>
                                        <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                                            <div className="px-6 py-4 bg-slate-50/50 space-y-1">
                                                {subject.sections.map((section) => {
                                                    const selection = selections[section.id] || {};
                                                    const selectedDate = selection.date;
                                                    const selectedTime = selection.time;
                                                    const isEditing = editingSections[section.id];

                                                    // Filter terms based on selected date
                                                    const availableTerms = section.terms.filter(t => t.date === selectedDate);
                                                    const uniqueDates = Array.from(new Set(section.terms.map(t => t.date)));

                                                    return (
                                                        <div key={section.id} className="group flex items-center gap-4 p-3 rounded-lg hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-slate-200">

                                                            {/* Column 1: Name (Fixed Width) */}
                                                            <div className="w-[200px] shrink-0 flex flex-col justify-center">
                                                                <span className="font-medium text-slate-900 text-sm capitalize truncate" title={section.name}>
                                                                    {section.name}
                                                                </span>
                                                                {section.registeredTerm?.room && (
                                                                    <span className="text-slate-500 text-xs truncate" title={section.registeredTerm?.room}>
                                                                        {section.registeredTerm.room}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Column 2: Date/Time (Fixed Width) */}
                                                            <div className="w-[320px] shrink-0 flex items-center">
                                                                {section.status === 'registered' && !isEditing ? (
                                                                    /* Registered State: Text Display */
                                                                    <div className="font-medium text-slate-900 text-sm">
                                                                        {section.registeredTerm?.date} {section.registeredTerm?.time} ({getDayOfWeek(section.registeredTerm?.date || '')})
                                                                    </div>
                                                                ) : (
                                                                    /* Open/Editing State: Selectors */
                                                                    <div className="flex items-center gap-2 w-full">
                                                                        {/* Date Select */}
                                                                        <div className="w-[160px] shrink-0">
                                                                            <Select
                                                                                value={selectedDate}
                                                                                onValueChange={(val) => handleDateSelect(section.id, val)}
                                                                            >
                                                                                <SelectTrigger className={`w-full h-9 text-sm transition-colors ${selectedDate ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-50 border-transparent text-slate-500'}`}>
                                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                                        <Calendar size={14} className={selectedDate ? "text-slate-500 shrink-0" : "text-slate-400 shrink-0"} />
                                                                                        <SelectValue placeholder="Datum" />
                                                                                    </div>
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {uniqueDates.map(date => (
                                                                                        <SelectItem key={date} value={date}>{date}</SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>

                                                                        {/* Arrow */}
                                                                        <div className={`shrink-0 transition-colors ${selectedDate ? 'text-slate-400' : 'text-slate-200'}`}>
                                                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                                                                        </div>

                                                                        {/* Time Select */}
                                                                        <div className="flex-1 min-w-0">
                                                                            <Select
                                                                                value={selectedTime}
                                                                                onValueChange={(val) => handleTimeSelect(section.id, val)}
                                                                                disabled={!selectedDate}
                                                                            >
                                                                                <SelectTrigger className={`w-full h-9 text-sm transition-colors ${selectedTime ? 'bg-white border-slate-200 text-slate-900' : (!selectedDate ? 'bg-slate-50 border-transparent text-slate-300 cursor-not-allowed' : 'bg-slate-100 border-transparent text-slate-500 hover:bg-white hover:border-slate-200')}`}>
                                                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                                                        <Clock size={14} className={!selectedDate ? "text-slate-200 shrink-0" : "text-slate-400 shrink-0"} />
                                                                                        {selectedTime ? (
                                                                                            <span>{availableTerms.find(t => t.id === selectedTime)?.time}</span>
                                                                                        ) : (
                                                                                            <SelectValue placeholder="Čas" />
                                                                                        )}
                                                                                    </div>
                                                                                </SelectTrigger>
                                                                                <SelectContent>
                                                                                    {availableTerms.map(term => (
                                                                                        <SelectItem key={term.id} value={term.id} disabled={term.full} textValue={term.time}>
                                                                                            <span className={term.full ? 'text-red-500' : ''}>
                                                                                                {term.time} {term.capacity ? `(${term.capacity})` : ''}
                                                                                            </span>
                                                                                        </SelectItem>
                                                                                    ))}
                                                                                </SelectContent>
                                                                            </Select>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* Column 3: Action (Flex) */}
                                                            <div className="flex-1 flex justify-end gap-2">
                                                                {section.status === 'registered' && !isEditing ? (
                                                                    <button
                                                                        onClick={() => toggleEdit(section.id)}
                                                                        className="text-sm font-medium text-rose-400 hover:text-rose-500 transition-colors"
                                                                    >
                                                                        Změnit
                                                                    </button>
                                                                ) : (
                                                                    <>
                                                                        {isEditing && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                className="h-9 text-slate-400 hover:text-slate-600"
                                                                                onClick={() => toggleEdit(section.id)}
                                                                                disabled={processingSectionId === section.id}
                                                                            >
                                                                                Zrušit
                                                                            </Button>
                                                                        )}
                                                                        {(() => {
                                                                            const selectedTermData = selectedTime ? section.terms.find(t => t.id === selectedTime) : null;
                                                                            const registrationStart = selectedTermData?.registrationStart ? parseDate(selectedTermData.registrationStart) : null;
                                                                            const isLocked = registrationStart && registrationStart > now;
                                                                            const isAutoBooking = autoBookingTermId === selectedTime;

                                                                            return (
                                                                                <div className="flex flex-col items-end gap-1">
                                                                                    <Button
                                                                                        size="sm"
                                                                                        disabled={!selectedDate || !selectedTime || processingSectionId === section.id || (!!isLocked && isAutoBooking && false)} // Allow cancelling
                                                                                        onClick={() => {
                                                                                            if (isLocked) {
                                                                                                if (isAutoBooking) {
                                                                                                    setAutoBookingTermId(null);
                                                                                                } else {
                                                                                                    setAutoBookingTermId(selectedTime!);
                                                                                                }
                                                                                            } else {
                                                                                                handleRegister(section, selectedTime!);
                                                                                            }
                                                                                        }}
                                                                                        className={`font-medium h-9 px-4 rounded-md shadow-sm transition-all ${isAutoBooking
                                                                                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200'
                                                                                            : selectedDate && selectedTime
                                                                                                ? (isLocked ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200')
                                                                                                : 'bg-slate-100 text-slate-300 shadow-none cursor-not-allowed'
                                                                                            }`}
                                                                                    >
                                                                                        {processingSectionId === section.id ? '...' :
                                                                                            isAutoBooking ? 'Zrušit rezervaci' :
                                                                                                isLocked ? 'Rezervovat' : 'Potvrdit'}
                                                                                    </Button>
                                                                                    {isLocked && !isAutoBooking && (
                                                                                        <span className="text-[10px] text-slate-400">
                                                                                            Otevře se: {selectedTermData?.registrationStart}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })()}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </Accordion.Content>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion.Root>
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
    );
}
