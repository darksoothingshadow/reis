/**
 * TermTile - Individual exam term selection tile.
 * 
 * Shows date, time, room, capacity with single-click registration.
 * For future-opening terms, shows countdown until registration opens.
 * Uses DaisyUI components per @daisy-enforcer.
 */

import { useState, useEffect } from 'react';
import { Clock, MapPin, Users, Timer, CircleCheck, RotateCcw } from 'lucide-react';
import type { ExamTerm } from '../types/exams';

interface TermTileProps {
    term: ExamTerm;
    onSelect: () => void;
    isProcessing?: boolean;
}

/**
 * Parse capacity string to get occupied/total numbers.
 */
function parseCapacity(capacity?: string): { occupied: number; total: number; percent: number } | null {
    if (!capacity) return null;
    const [occupied, total] = capacity.split('/').map(Number);
    if (isNaN(occupied) || isNaN(total) || total === 0) return null;
    return { occupied, total, percent: Math.min(100, (occupied / total) * 100) };
}

/**
 * Get day of week from DD.MM.YYYY string.
 */
function getDayOfWeek(dateStr: string): string {
    const [day, month, year] = dateStr.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    return ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'][date.getDay()];
}

/**
 * Parse registrationStart string to Date object.
 */
function parseRegistrationStart(registrationStart: string): Date | null {
    try {
        const [datePart, timePart] = registrationStart.split(' ');
        const [day, month, year] = datePart.split('.').map(Number);
        const [hours, minutes] = (timePart || '00:00').split(':').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    } catch {
        return null;
    }
}

/**
 * Format countdown from milliseconds to human readable string.
 */
function formatCountdown(ms: number): string {
    if (ms <= 0) return 'Nyní';

    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        const remainingHours = hours % 24;
        return `${days}d ${remainingHours}h`;
    }
    if (hours > 0) {
        const remainingMinutes = minutes % 60;
        return `${hours}h ${remainingMinutes}m`;
    }
    if (minutes > 0) {
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
}

export function TermTile({ term, onSelect, isProcessing = false }: TermTileProps) {
    const capacity = parseCapacity(term.capacity);
    const isFull = term.full || (capacity && capacity.occupied >= capacity.total);

    // Countdown state for future-opening terms
    const [now, setNow] = useState(() => new Date());
    const registrationDate = term.registrationStart ? parseRegistrationStart(term.registrationStart) : null;
    const isFutureOpening = Boolean(registrationDate && registrationDate > now);
    const msUntilOpen = isFutureOpening && registrationDate ? registrationDate.getTime() - now.getTime() : 0;

    // Check if registration is closed (registrationEnd is in the past)
    const registrationEndDate = term.registrationEnd ? parseRegistrationStart(term.registrationEnd) : null;
    const isRegistrationClosed = Boolean(registrationEndDate && registrationEndDate < now);

    // Check if term cannot be registered now (no register link available)
    const isBlocked = term.canRegisterNow === false && !isFutureOpening && !isFull;

    // Update countdown every second when term is future-opening
    useEffect(() => {
        if (!isFutureOpening) return;

        const interval = setInterval(() => {
            setNow(new Date());
        }, 1000);

        return () => clearInterval(interval);
    }, [isFutureOpening]);

    console.debug('[TermTile] Rendering term:', {
        id: term.id,
        date: term.date,
        time: term.time,
        capacity: term.capacity,
        full: term.full,
        room: term.room,
        registrationStart: term.registrationStart,
        registrationEnd: term.registrationEnd,
        canRegisterNow: term.canRegisterNow,
        isFutureOpening,
        isRegistrationClosed,
        isBlocked
    });

    return (
        <button
            onClick={() => {
                if (!isFull && !isProcessing && !isFutureOpening && !isRegistrationClosed && !isBlocked) {
                    console.debug('[TermTile] Selected term:', term.id);
                    onSelect();
                }
            }}
            disabled={isFull || isProcessing || isFutureOpening || isRegistrationClosed || isBlocked}
            className={`
                flex items-center gap-3 w-full p-3 rounded-lg border transition-all text-left
                ${isFutureOpening
                    ? 'bg-warning/5 border-warning/30 cursor-not-allowed'
                    : (isFull || isRegistrationClosed || isBlocked)
                        ? 'bg-base-200 border-base-300 opacity-60 cursor-not-allowed'
                        : 'bg-base-100 border-base-300 hover:border-primary hover:shadow-sm cursor-pointer'
                }
            `}
        >
            {/* Date & Time */}
            <div className="flex flex-col min-w-[80px]">
                <span className={`font-semibold ${(isFull || isRegistrationClosed || isBlocked) ? 'text-base-content/50 line-through' : 'text-base-content'}`}>
                    {term.date.split('.').slice(0, 2).join('.')}
                </span>
                <span className="text-xs text-base-content/60">
                    {getDayOfWeek(term.date)}
                </span>
            </div>

            {/* Attempt Type Badge */}
            {term.attemptType && (
                <div className="flex items-center" title={
                    term.attemptType === 'regular' ? 'Řádný termín' :
                        term.attemptType === 'retake1' ? 'Opravný termín 1' :
                            term.attemptType === 'retake2' ? 'Opravný termín 2' :
                                'Opravný termín 3'
                }>
                    {term.attemptType === 'regular' ? (
                        <CircleCheck size={14} className="text-success" />
                    ) : (
                        <div className="flex items-center gap-0.5">
                            <RotateCcw size={12} className="text-warning" />
                            <span className="text-[10px] font-bold text-warning">
                                {term.attemptType === 'retake1' ? '1' :
                                    term.attemptType === 'retake2' ? '2' : '3'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-1 min-w-[60px]">
                <Clock size={12} className="text-base-content/40" />
                <span className={`text-sm ${(isFull || isRegistrationClosed || isBlocked) ? 'text-base-content/50' : 'text-base-content/70'}`}>
                    {term.time}
                </span>
            </div>

            {/* Room */}
            {term.room && (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                    <MapPin size={12} className="text-base-content/40 shrink-0" />
                    <span className={`text-sm truncate ${(isFull || isRegistrationClosed || isBlocked) ? 'text-base-content/50' : 'text-base-content/70'}`}>
                        {term.room}
                    </span>
                </div>
            )}

            {/* Future Opening Countdown - takes priority over capacity */}
            {isFutureOpening ? (
                <div className="flex items-center gap-2 min-w-[120px] bg-warning/10 px-2 py-1 rounded-md">
                    <Timer size={14} className="text-warning" />
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-warning">
                            Za {formatCountdown(msUntilOpen)}
                        </span>
                        <span className="text-[10px] text-warning/70">
                            {term.registrationStart?.split(' ')[0]}
                        </span>
                    </div>
                </div>
            ) : (
                /* Capacity */
                capacity && (
                    <div className="flex items-center gap-2 min-w-[90px]">
                        <Users size={12} className="text-base-content/40" />
                        <div className="flex items-center gap-1.5">
                            <progress
                                className={`progress w-12 h-1.5 ${(isFull || isRegistrationClosed || isBlocked) ? 'progress-error' : 'progress-primary'
                                    }`}
                                value={capacity.percent}
                                max="100"
                            />
                            <span className={`text-xs ${(isFull || isRegistrationClosed || isBlocked) ? 'text-error font-medium' : 'text-base-content/50'}`}>
                                {isFull ? 'PLNÝ' : (isRegistrationClosed || isBlocked) ? 'UZAVŘENO' : `${capacity.occupied}/${capacity.total}`}
                            </span>
                        </div>
                    </div>
                )
            )}

            {/* Action button - direct registration */}
            <div className="shrink-0 ml-auto">
                {isProcessing ? (
                    <span className="loading loading-spinner loading-sm text-primary"></span>
                ) : isFutureOpening ? (
                    <span className="text-warning text-sm font-medium">⏳</span>
                ) : (isFull || isRegistrationClosed || isBlocked) ? (
                    <span className="text-error/60 text-sm font-medium">✕</span>
                ) : (
                    <span className="btn btn-primary btn-sm">Přihlásit se</span>
                )}
            </div>
        </button>
    );
}
