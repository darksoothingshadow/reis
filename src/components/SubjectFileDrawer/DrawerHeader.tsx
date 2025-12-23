/**
 * Drawer Header Component
 * 
 * Renders the header section with course info, meta, and tabs.
 */

import { X, Download, Loader2, ExternalLink, User, Map as MapIcon, Clock } from 'lucide-react';
import type { DrawerHeaderProps } from './types';

// Helper: Format date string (YYYYMMDD) to readable format
function formatDate(dateStr: string): string {
    if (!dateStr || dateStr.length !== 8) return '';
    const year = parseInt(dateStr.substring(0, 4));
    const month = parseInt(dateStr.substring(4, 6)) - 1;
    const day = parseInt(dateStr.substring(6, 8));
    const date = new Date(year, month, day);
    const weekdays = ['Neděle', 'Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota'];
    return `${weekdays[date.getDay()]} ${day}.${month + 1}.`;
}

// Helper: Get event type label and color
function getEventType(lesson: { isExam?: boolean; isSeminar?: string } | null): { label: string; bgColor: string; textColor: string } {
    if (!lesson) return { label: '', bgColor: '', textColor: '' };
    if (lesson.isExam) return { label: 'Zkouška', bgColor: 'bg-red-100', textColor: 'text-red-700' };
    if (lesson.isSeminar === 'true') return { label: 'Cvičení', bgColor: 'bg-emerald-100', textColor: 'text-emerald-700' };
    return { label: 'Přednáška', bgColor: 'bg-blue-100', textColor: 'text-blue-700' };
}

export function DrawerHeader({
    lesson,
    courseId,
    selectedCount,
    isDownloading,
    activeTab,
    onClose,
    onDownload,
    onTabChange
}: DrawerHeaderProps) {
    const eventType = getEventType(lesson);

    return (
        <div className="px-6 py-4 border-b border-base-300 bg-base-100 z-20">
            {/* Top row: Badge + Date + Actions */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    {/* Event Type Badge */}
                    {eventType.label && (
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventType.bgColor} ${eventType.textColor}`}>
                            {eventType.label}
                        </span>
                    )}
                    {/* Date */}
                    {lesson?.date && (
                        <span className="text-sm text-base-content/60">
                            {formatDate(lesson.date)}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {selectedCount > 0 && (
                        <button 
                            onClick={onDownload}
                            disabled={isDownloading}
                            className="btn btn-sm btn-primary gap-2 interactive disabled:opacity-75 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-white"
                        >
                            {isDownloading ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Download size={16} />
                            )}
                            {isDownloading ? 'Stahování...' : `Stáhnout (${selectedCount})`}
                        </button>
                    )}
                    <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm interactive">
                        <X size={20} className="text-base-content/40" />
                    </button>
                </div>
            </div>
            
            {/* Course Name */}
            <div className="mb-2">
                {courseId ? (
                    <a 
                        href={`https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${courseId};lang=cz`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clickable-link text-xl font-bold text-base-content flex items-center gap-1"
                    >
                        <span>{lesson?.courseName}</span>
                        <ExternalLink size={14} className="opacity-50 flex-shrink-0" />
                    </a>
                ) : (
                    <span className="text-xl font-bold text-base-content">
                        {lesson?.courseName}
                    </span>
                )}
            </div>
            
            {/* Meta row: Teacher + Room + Time */}
            <div className="flex items-center gap-4 text-sm text-base-content/60 flex-wrap">
                {/* Teacher */}
                {lesson?.teachers && lesson.teachers.length > 0 && (
                    lesson.teachers[0].id ? (
                        <a
                            href={`https://is.mendelu.cz/auth/lide/clovek.pl?;id=${lesson.teachers[0].id};lang=cz`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="clickable-link flex items-center gap-1"
                        >
                            <User size={14} className="flex-shrink-0" />
                            <span>{lesson.teachers[0].fullName}</span>
                        </a>
                    ) : (
                        <span className="flex items-center gap-1">
                            <User size={14} className="flex-shrink-0" />
                            <span>{lesson.teachers.map(t => t.fullName).join(', ')}</span>
                        </span>
                    )
                )}
                
                {/* Room (Q-buildings only, with map) */}
                {lesson?.room?.startsWith('Q') && (
                    <button
                        onClick={() => window.open(`https://mm.mendelu.cz/mapwidget/embed?placeName=${lesson.room}`, '_blank')}
                        className="flex items-center gap-1 hover:text-emerald-600 transition-colors"
                        title="Zobrazit na mapě"
                    >
                        <MapIcon size={14} />
                        <span>{lesson.room}</span>
                    </button>
                )}
                
                {/* Time */}
                {lesson?.startTime && lesson?.endTime && (
                    <span className="flex items-center gap-1">
                        <Clock size={14} />
                        <span>{lesson.startTime} - {lesson.endTime}</span>
                    </span>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-8 mt-6">
                <button 
                    onClick={() => onTabChange('files')}
                    className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`}
                >
                    Soubory
                </button>
                <button 
                    onClick={() => onTabChange('stats')}
                    className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`}
                    data-testid="tab-stats"
                >
                    Úspěšnost
                </button>
            </div>
        </div>
    );
}
