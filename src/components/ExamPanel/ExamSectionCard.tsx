/**
 * ExamSectionCard Component
 * 
 * Renders a single exam section with its terms.
 */

import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { TermTile } from '../TermTile';
import { getDayOfWeek, capacityToPercent } from './utils';

interface ExamSectionCardProps {
    subject: ExamSubject;
    section: ExamSection;
    isExpanded: boolean;
    isProcessing: boolean;
    onToggleExpand: (sectionId: string) => void;
    onRegister: (section: ExamSection, termId: string) => void;
    onUnregister: (section: ExamSection) => void;
}

export function ExamSectionCard({
    subject,
    section,
    isExpanded,
    isProcessing,
    onToggleExpand,
    onRegister,
    onUnregister
}: ExamSectionCardProps) {
    const isRegistered = section.status === 'registered';

    return (
        <div className="card bg-base-100 shadow-sm border border-base-200 hover:shadow-md transition-shadow">
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
                            <RegisteredTermDetails section={section} />
                        )}

                        {/* Available Terms Summary - only when collapsed */}
                        {!isRegistered && section.terms.length > 0 && !isExpanded && (
                            <TermsSummary terms={section.terms} />
                        )}
                    </div>

                    {/* Right: Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Unregister button for registered exams */}
                        {isRegistered && (
                            <button
                                onClick={() => onUnregister(section)}
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
                                onClick={() => onToggleExpand(section.id)}
                                disabled={isProcessing}
                                className="btn btn-sm btn-ghost gap-1"
                            >
                                {isExpanded ? (
                                    <>Zavřít <ChevronUp size={14} /></>
                                ) : (
                                    <>{isRegistered ? 'Změnit' : 'Vybrat'} <ChevronDown size={14} /></>
                                )}
                            </button>
                        )}
                    </div>
                </div>

                {/* Expanded: Inline Term Tiles */}
                {isExpanded && section.terms.length > 0 && (
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
                                        console.debug('[ExamSectionCard] Direct registration for term:', term.id);
                                        onRegister(section, term.id);
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
}

/**
 * Registered term details subcomponent
 */
function RegisteredTermDetails({ section }: { section: ExamSection }) {
    const term = section.registeredTerm;
    if (!term) return null;

    return (
        <div className="text-sm text-base-content/70 flex flex-col gap-1">
            <div className="flex items-center gap-1.5 flex-wrap">
                <span>📅 {term.date} ({getDayOfWeek(term.date)})</span>
                <span className="text-base-content/30">•</span>
                <span>⏰ {term.time}</span>
                {term.room && (
                    <>
                        <span className="text-base-content/30">•</span>
                        <span>📍 {term.room}</span>
                    </>
                )}
            </div>

            {term.deregistrationDeadline && (
                <div className="flex items-center gap-1.5 text-xs text-warning mt-1">
                    <AlertCircle size={12} />
                    <span>Odhlášení do: {term.deregistrationDeadline}</span>
                </div>
            )}
        </div>
    );
}

/**
 * Terms summary for collapsed state
 */
function TermsSummary({ terms }: { terms: ExamSection['terms'] }) {
    return (
        <div className="flex items-center gap-3 mt-2">
            <span className="text-xs text-base-content/50">
                {terms.length} termín{terms.length > 1 ? 'ů' : ''}
            </span>
            {terms.slice(0, 3).map(term => (
                <div key={term.id} className="flex items-center gap-1">
                    <span className="text-xs text-base-content/70">
                        {term.date.split('.').slice(0, 2).join('.')}
                    </span>
                    {term.capacity && (
                        <progress
                            className={`progress w-12 h-1.5 ${term.full ? 'progress-error' : 'progress-primary'}`}
                            value={capacityToPercent(term.capacity)}
                            max="100"
                        />
                    )}
                </div>
            ))}
        </div>
    );
}
