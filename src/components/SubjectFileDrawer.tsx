import { X, Loader2, Download, Check, FileText, Folder, Map as MapIcon, ExternalLink, User, MousePointer2, Clock } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { loggers } from '../utils/logger';
import { useSubjects, useSchedule } from '../hooks/data';
import { getFilesForSubject } from '../utils/apiUtils';
import { cleanFolderName } from '../utils/fileUrl';
import { useFileActions } from '../hooks/ui/useFileActions';
import { SuccessRateTab } from './SuccessRateTab';
import type { BlockLesson } from '../types/calendarTypes';
import type { ParsedFile } from '../types/documents';

const DRAG_HINT_STORAGE_KEY = 'reis_drag_hint_shown';

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

interface SubjectFileDrawerProps {
    lesson: BlockLesson | null;
    isOpen: boolean;
    onClose: () => void;
}

export function SubjectFileDrawer({ lesson, isOpen, onClose }: SubjectFileDrawerProps) {
    const { isLoaded: subjectsLoaded } = useSubjects();
    const { schedule } = useSchedule();
    const { isDownloading, openFile, downloadZip } = useFileActions();

    loggers.ui.info('[SubjectFileDrawer] Rendering. Open:', isOpen, 'Lesson:', lesson?.courseCode);

    // State
    const [activeTab, setActiveTab] = useState<'files' | 'stats'>('files');
    const [files, setFiles] = useState<ParsedFile[] | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
    
    // Drag hint state
    const [showDragHint, setShowDragHint] = useState(false);
    const [selectionEnd, setSelectionEnd] = useState<{ x: number, y: number } | null>(null);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const autoScrollInterval = useRef<NodeJS.Timeout | null>(null);
    const lastMousePos = useRef<{ x: number, y: number } | null>(null);
    const initialSelectedIds = useRef<string[]>([]);
    const isDraggingRef = useRef(false);
    const selectionStartRef = useRef<{ x: number, y: number } | null>(null);
    const ignoreClickRef = useRef(false);

    // Load files
    useEffect(() => {
        if (!isOpen || !lesson || !subjectsLoaded) return;
        setLoading(true);
        const cachedFiles = getFilesForSubject(lesson.courseCode);
        setFiles(cachedFiles);
        setLoading(false);
    }, [isOpen, lesson, subjectsLoaded]);

    // Reset selection and tab on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            setSelectionStart(null);
            setSelectionEnd(null);
            isDraggingRef.current = false;
            setShowDragHint(false);
            setActiveTab('files');
        }
    }, [isOpen]);

    // Show drag hint on first use
    useEffect(() => {
        if (!isOpen || loading || !files || files.length === 0) return;
        
        const hasSeenHint = localStorage.getItem(DRAG_HINT_STORAGE_KEY);
        if (hasSeenHint) return;
        
        // Mark as seen immediately so it won't show again even if drawer is closed
        localStorage.setItem(DRAG_HINT_STORAGE_KEY, 'true');
        
        // Delay to let content render first
        const showTimer = setTimeout(() => {
            setShowDragHint(true);
        }, 800);
        
        // Auto-hide after 4 seconds
        const hideTimer = setTimeout(() => {
            setShowDragHint(false);
        }, 4800);
        
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
    }, [isOpen, loading, files]);

    // Group files logic
    // Lookup courseId from schedule if not present in lesson (e.g., exams)
    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        if (!lesson?.courseCode || !schedule?.length) return '';
        
        // Find a regular lesson with matching courseCode to get its courseId
        const matchingLesson = schedule.find(s => s.courseCode === lesson.courseCode && s.courseId);
        return matchingLesson?.courseId || '';
    }, [lesson?.courseId, lesson?.courseCode, schedule]);

    const groupedFiles = useMemo(() => {
        if (!files) return [];
        const groups = new Map<string, ParsedFile[]>();
        
        files.forEach(f => {
            const subfolder = f.subfolder?.trim() || 'Ostatní';
            if (!groups.has(subfolder)) groups.set(subfolder, []);
            groups.get(subfolder)?.push(f);
        });

        // Sort keys (Ostatní last)
        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === 'Ostatní') return 1;
            if (b === 'Ostatní') return -1;
            return a.localeCompare(b, 'cs');
        });

        // Natural sort function: handles "Přednáška 2" before "Přednáška 10"
        const naturalCompare = (s1: string, s2: string) =>
            s1.localeCompare(s2, 'cs', { numeric: true, sensitivity: 'base' });

        // Sort files within each group
        const sortFiles = (groupFiles: ParsedFile[]): ParsedFile[] => {
            return [...groupFiles].sort((a, b) => {
                // Priority 1: Both have comments → sort by comment
                const commentA = a.file_comment?.trim();
                const commentB = b.file_comment?.trim();
                
                if (commentA && commentB) {
                    return naturalCompare(commentA, commentB);
                }
                
                // Priority 2: Only one has comment → comment wins (comes first)
                if (commentA && !commentB) return -1;
                if (!commentA && commentB) return 1;
                
                // Priority 3: Neither has comment → sort by file_name
                return naturalCompare(a.file_name, b.file_name);
            });
        };

        return sortedKeys.map(key => ({
            name: key,
            displayName: key === 'Ostatní' ? 'Ostatní' : cleanFolderName(key, lesson?.courseCode),
            files: sortFiles(groups.get(key) || [])
        }));
    }, [files, lesson?.courseCode]);

    // Drag Selection Logic (Ported from SubjectPopup)
    const processSelection = useCallback((clientX: number, clientY: number) => {
        if (!selectionStartRef.current || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        // Calculate relative coordinates including scroll
        const x = clientX - rect.left + containerRef.current.scrollLeft;
        const y = clientY - rect.top + containerRef.current.scrollTop;

        // Clamp to content bounds
        const contentWidth = contentRef.current ? contentRef.current.scrollWidth : containerRef.current.scrollWidth;
        const contentHeight = contentRef.current ? contentRef.current.scrollHeight : containerRef.current.scrollHeight;
        
        const clampedX = Math.max(0, Math.min(x, contentWidth));
        const clampedY = Math.max(0, Math.min(y, contentHeight));

        setSelectionEnd({ x: clampedX, y: clampedY });

        // Calculate selection box in scroll-relative coordinates
        const boxLeft = Math.min(selectionStartRef.current.x, clampedX);
        const boxTop = Math.min(selectionStartRef.current.y, clampedY);
        const boxRight = Math.max(selectionStartRef.current.x, clampedX);
        const boxBottom = Math.max(selectionStartRef.current.y, clampedY);

        const newSelectedIds = new Set(initialSelectedIds.current);

        fileRefs.current.forEach((node, link) => {
            if (node) {
                // Node positions are already relative to the container content
                const nodeLeft = node.offsetLeft;
                const nodeTop = node.offsetTop;
                const nodeRight = nodeLeft + node.offsetWidth;
                const nodeBottom = nodeTop + node.offsetHeight;

                const isIntersecting = !(
                    boxLeft > nodeRight ||
                    boxRight < nodeLeft ||
                    boxTop > nodeBottom ||
                    boxBottom < nodeTop
                );

                if (isIntersecting) {
                    newSelectedIds.add(link);
                }
            }
        });

        setSelectedIds(Array.from(newSelectedIds));
    }, []);

    // Global Mouse Handlers for Drag
    useEffect(() => {
        if (!isOpen) return;

        const handleGlobalMouseMove = (e: MouseEvent) => {
            lastMousePos.current = { x: e.clientX, y: e.clientY };

            // Auto-scroll logic
            if (containerRef.current) {
                const { top, bottom } = containerRef.current.getBoundingClientRect();
                const threshold = 50;
                const speed = 15;

                if (e.clientY < top + threshold) {
                    // Scroll Up
                    if (!autoScrollInterval.current) {
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current && containerRef.current.scrollTop > 0) {
                                containerRef.current.scrollTop -= speed;
                                if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y);
                            }
                        }, 16);
                    }
                } else if (e.clientY > bottom - threshold) {
                    // Scroll Down
                    if (!autoScrollInterval.current) {
                        autoScrollInterval.current = setInterval(() => {
                            if (containerRef.current) {
                                containerRef.current.scrollTop += speed;
                                if (lastMousePos.current) processSelection(lastMousePos.current.x, lastMousePos.current.y);
                            }
                        }, 16);
                    }
                } else {
                    // Stop scrolling if in safe zone
                    if (autoScrollInterval.current) {
                        clearInterval(autoScrollInterval.current);
                        autoScrollInterval.current = null;
                    }
                }
            }

            // Drag detection threshold
            if (!isDraggingRef.current && selectionStartRef.current) {
                const rect = containerRef.current!.getBoundingClientRect();
                const x = e.clientX - rect.left + containerRef.current!.scrollLeft;
                const y = e.clientY - rect.top + containerRef.current!.scrollTop;
                
                const dx = x - selectionStartRef.current.x;
                const dy = y - selectionStartRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) > 5) {
                    isDraggingRef.current = true;
                    setIsDragging(true);
                }
            }

            if (isDraggingRef.current) {
                processSelection(e.clientX, e.clientY);
            }
        };

        const handleGlobalMouseUp = () => {
             if (autoScrollInterval.current) {
                clearInterval(autoScrollInterval.current);
                autoScrollInterval.current = null;
            }

            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);

            if (isDraggingRef.current) {
                ignoreClickRef.current = true;
                setTimeout(() => { ignoreClickRef.current = false; }, 100);
                setIsDragging(false);
                isDraggingRef.current = false;
            }
            setSelectionStart(null);
            setSelectionEnd(null);
            selectionStartRef.current = null;
        };

        if (selectionStart) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
            if (autoScrollInterval.current) clearInterval(autoScrollInterval.current);
        };
    }, [isOpen, selectionStart, processSelection]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('.interactive') || target.tagName === 'BUTTON' || target.tagName === 'A') return;

        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left + containerRef.current.scrollLeft;
            const y = e.clientY - rect.top + containerRef.current.scrollTop;

            setSelectionStart({ x, y });
            setSelectionEnd({ x, y });
            selectionStartRef.current = { x, y };
            
            initialSelectedIds.current = (e.ctrlKey || e.shiftKey || e.metaKey) ? selectedIds : [];
            if (!e.ctrlKey && !e.shiftKey && !e.metaKey) {
                setSelectedIds([]);
            }
        }
    };

    const toggleSelect = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Calculate selection box style
    const selectionBoxStyle = useMemo(() => {
        if (!selectionStart || !selectionEnd || !containerRef.current) return null;
        
        // Coordinates are already relative to container content (including scroll)
        // We just need to subtract scroll for 'fixed' positioning or use 'absolute' inside a relative container.
        
        // Since we are rendering the box inside the absolute content container, we can use the coordinates directly.
        const left = Math.min(selectionStart.x, selectionEnd.x);
        const top = Math.min(selectionStart.y, selectionEnd.y);
        const width = Math.abs(selectionEnd.x - selectionStart.x);
        const height = Math.abs(selectionEnd.y - selectionStart.y);

        return { left, top, width, height };
    }, [selectionStart, selectionEnd]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/15 transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Container - wrapper for floating effect */}
            <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                {/* Drawer */}
                <div className="w-[600px] bg-base-100 shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-base-300 font-inter h-full animate-in slide-in-from-right duration-300 pointer-events-auto">
                    
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-base-300 bg-base-100 z-20">
                        {/* Top row: Badge + Date + Actions */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                {/* Event Type Badge */}
                                {(() => {
                                    const eventType = getEventType(lesson);
                                    return eventType.label && (
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${eventType.bgColor} ${eventType.textColor}`}>
                                            {eventType.label}
                                        </span>
                                    );
                                })()}
                                {/* Date */}
                                {lesson?.date && (
                                    <span className="text-sm text-base-content/60">
                                        {formatDate(lesson.date)}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {selectedIds.length > 0 && (
                                    <button 
                                        onClick={() => downloadZip(selectedIds, `${lesson?.courseCode}_files.zip`)}
                                        disabled={isDownloading}
                                        className="btn btn-sm btn-primary gap-2 interactive disabled:opacity-75 disabled:cursor-not-allowed bg-emerald-600 hover:bg-emerald-700 border-emerald-600 hover:border-emerald-700 text-white"
                                    >
                                        {isDownloading ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <Download size={16} />
                                        )}
                                        {isDownloading ? 'Stahování...' : `Stáhnout (${selectedIds.length})`}
                                    </button>
                                )}
                                <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm interactive">
                                    <X size={20} className="text-base-content/40" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Course Name */}
                        <div className="mb-2">
                            {resolvedCourseId ? (
                                <a 
                                    href={`https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${resolvedCourseId};lang=cz`}
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
                                onClick={() => setActiveTab('files')}
                                className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${activeTab === 'files' ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`}
                            >
                                Soubory
                            </button>
                            <button 
                                onClick={() => setActiveTab('stats')}
                                className={`text-sm font-bold pb-2 border-b-2 transition-all px-1 ${activeTab === 'stats' ? 'border-primary text-primary' : 'border-transparent text-base-content/40 hover:text-base-content/60'}`}
                            >
                                Úspěšnost
                            </button>
                        </div>
                    </div>

                    {/* Content Area (Scrollable & Draggable) */}
                    <div 
                        ref={containerRef}
                        className="flex-1 overflow-y-auto relative select-none"
                        onMouseDown={handleMouseDown}
                        style={{ cursor: 'crosshair' }}
                    >
                        <div ref={contentRef} className="min-h-full pb-20 relative">
                             {/* Selection Box Overlay */}
                            {isDragging && selectionBoxStyle && (
                                <div 
                                    className="absolute border border-emerald-500 bg-emerald-500/10 pointer-events-none z-50"
                                    style={{
                                        left: selectionBoxStyle.left,
                                        top: selectionBoxStyle.top,
                                        width: selectionBoxStyle.width,
                                        height: selectionBoxStyle.height
                                    }}
                                />
                            )}

                            {/* First-use Drag Hint Animation - only on Files tab */}
                            {activeTab === 'files' && showDragHint && (
                                <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
                                    {/* Animated lasso selection */}
                                    <div 
                                        className="absolute border-2 border-emerald-500 bg-emerald-500/15 rounded-sm"
                                        style={{
                                            animation: 'dragHintLasso 2s ease-in-out infinite',
                                            top: '80px',
                                            left: '40px',
                                            width: '0px',
                                            height: '0px',
                                        }}
                                    />
                                    {/* Tooltip */}
                                    <div 
                                        className="absolute bg-neutral text-neutral-content text-sm px-3 py-2 rounded-lg shadow-lg flex items-center gap-2"
                                        style={{
                                            animation: 'dragHintFade 4s ease-in-out forwards',
                                            top: '200px',
                                            left: '50%',
                                            transform: 'translateX(-50%)',
                                        }}
                                    >
                                        <MousePointer2 size={16} className="text-primary" />
                                        Tažením vyberete více souborů
                                    </div>
                                </div>
                            )}

                            <style>{`
                                @keyframes dragHintLasso {
                                    0% { width: 0; height: 0; opacity: 0; }
                                    10% { opacity: 1; }
                                    50% { width: 200px; height: 120px; opacity: 1; }
                                    80% { width: 200px; height: 120px; opacity: 0.5; }
                                    100% { width: 200px; height: 120px; opacity: 0; }
                                }
                                @keyframes dragHintFade {
                                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                                    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                                    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                                }
                            `}</style>

                            {activeTab === 'files' ? (
                                loading || !subjectsLoaded || !files ? (
                                <div className="p-6 space-y-8">
                                    {[1, 2].map((i) => (
                                        <div key={i} className="space-y-3">
                                            {/* Folder Header Skeleton */}
                                            <div className="flex items-center gap-2 px-2">
                                                <div className="skeleton w-4 h-4 rounded-full bg-slate-200"></div>
                                                <div className="skeleton h-4 w-32 rounded bg-slate-200"></div>
                                            </div>
                                            {/* Files Grid Skeleton */}
                                            <div className="grid grid-cols-1 gap-1">
                                                {[1, 2, 3].map((j) => (
                                                    <div key={j} className="flex items-center gap-3 p-3 rounded-lg border border-transparent bg-base-100">
                                                        <div className="skeleton w-5 h-5 rounded bg-base-300"></div>
                                                        <div className="flex-1 space-y-2">
                                                            <div className="skeleton h-4 w-3/4 rounded bg-base-300"></div>
                                                            <div className="skeleton h-3 w-1/2 rounded bg-base-300"></div>
                                                        </div>
                                                        <div className="skeleton w-4 h-4 rounded bg-base-300"></div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-6 space-y-6">
                                    {groupedFiles.map(group => (
                                        <div key={group.name} className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-base-content/50 uppercase tracking-wider px-2">
                                                <Folder size={14} />
                                                {group.displayName}
                                            </div>
                                            <div className="grid grid-cols-1 gap-1">
                                                {group.files.map((file, i) => (
                                                    <div key={i} className="space-y-1">
                                                         {file.files.map((subFile, j) => {
                                                            const isSelected = selectedIds.includes(subFile.link);
                                                            return (
                                                                <div
                                                                    key={subFile.link}
                                                                    ref={el => { if (el) fileRefs.current.set(subFile.link, el); }}
                                                                    onClick={(e) => {
                                                                        if (ignoreClickRef.current) return;
                                                                        if (e.ctrlKey || e.metaKey) {
                                                                            toggleSelect(subFile.link, e);
                                                                        } else {
                                                                            openFile(subFile.link);
                                                                        }
                                                                    }}
                                                                    className={`
                                                                        flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group hover:shadow-sm
                                                                        ${isSelected 
                                                                            ? 'bg-primary/10 border-primary/20 shadow-sm' 
                                                                            : 'bg-base-100 border-transparent hover:bg-base-200/50 hover:border-base-300'
                                                                        }
                                                                    `}
                                                                >
                                                                    <div 
                                                                        className={`
                                                                            w-5 h-5 rounded border flex items-center justify-center transition-colors interactive
                                                                            ${isSelected ? 'bg-primary border-primary' : 'border-base-300 group-hover:border-primary/50'}
                                                                        `}
                                                                        onClick={(e) => toggleSelect(subFile.link, e)}
                                                                    >
                                                                        {isSelected && <Check size={12} className="text-primary-content" />}
                                                                    </div>
                                                                    
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className={`font-medium truncate ${isSelected ? 'text-primary' : 'text-base-content'}`}>
                                                                            {file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}
                                                                        </div>
                                                                        {file.file_comment && (
                                                                            <div className="text-xs text-base-content/50 truncate">{file.file_comment}</div>
                                                                        )}
                                                                    </div>
 
                                                                    <FileText size={16} className={`${isSelected ? 'text-primary/50' : 'text-base-content/20'}`} />
                                                                </div>
                                                            );
                                                         })}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                    {groupedFiles.length === 0 && (
                                        <div className="text-center py-12 text-slate-400 italic">
                                            Žádné soubory
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <SuccessRateTab courseCode={lesson?.courseCode || ''} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
