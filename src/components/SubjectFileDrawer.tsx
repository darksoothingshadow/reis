import { X, Loader2, Download, Check, FileText, Folder } from 'lucide-react';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSubjects } from '../hooks/data';
import { getFilesForSubject } from '../utils/apiUtils';
import { cleanFolderName } from '../utils/fileUrl';
import { useFileActions } from '../hooks/ui/useFileActions';
import type { BlockLesson } from '../types/calendarTypes';
import type { ParsedFile } from '../types/documents';

interface SubjectFileDrawerProps {
    lesson: BlockLesson | null;
    isOpen: boolean;
    onClose: () => void;
}

export function SubjectFileDrawer({ lesson, isOpen, onClose }: SubjectFileDrawerProps) {
    const { isLoaded: subjectsLoaded } = useSubjects();
    const { isDownloading, openFile, downloadZip } = useFileActions();

    console.log('[SubjectFileDrawer] Rendering. Open:', isOpen, 'Lesson:', lesson?.courseCode);

    // State
    const [files, setFiles] = useState<ParsedFile[] | null>(null);
    const [loading, setLoading] = useState(false);
    
    // Selection State
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [selectionStart, setSelectionStart] = useState<{ x: number, y: number } | null>(null);
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

    // Reset selection on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            setSelectionStart(null);
            setSelectionEnd(null);
            isDraggingRef.current = false;
        }
    }, [isOpen]);

    // Group files logic
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

        return sortedKeys.map(key => ({
            name: key,
            displayName: key === 'Ostatní' ? 'Ostatní' : cleanFolderName(key, lesson?.courseCode),
            files: groups.get(key) || []
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
                <div className="w-[600px] bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-gray-100 font-inter h-full animate-in slide-in-from-right duration-300 pointer-events-auto">
                    
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-white z-20">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">{lesson?.courseCode}</h2>
                            <p className="text-sm text-slate-500 truncate max-w-[400px]">{lesson?.courseName}</p>
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
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>
                    </div>

                    {/* Content Area (Scrollable & Drappable) */}
                    <div 
                        ref={containerRef}
                        className="flex-1 overflow-y-auto relative select-none"
                        onMouseDown={handleMouseDown}
                        style={{ cursor: 'default' }}
                    >
                        <div ref={contentRef} className="min-h-full pb-20">
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

                            {loading ? (
                                <div className="flex items-center justify-center p-12 text-slate-400">
                                    <Loader2 size={24} className="animate-spin mb-2" />
                                </div>
                            ) : (
                                <div className="p-6 space-y-6">
                                    {groupedFiles.map(group => (
                                        <div key={group.name} className="space-y-3">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-slate-500 uppercase tracking-wider px-2">
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
                                                                            ? 'bg-emerald-50 border-emerald-200 shadow-sm' 
                                                                            : 'bg-white border-transparent hover:bg-slate-50 hover:border-slate-200'
                                                                        }
                                                                    `}
                                                                >
                                                                    <div 
                                                                        className={`
                                                                            w-5 h-5 rounded border flex items-center justify-center transition-colors interactive
                                                                            ${isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 group-hover:border-emerald-400'}
                                                                        `}
                                                                        onClick={(e) => toggleSelect(subFile.link, e)}
                                                                    >
                                                                        {isSelected && <Check size={12} className="text-white" />}
                                                                    </div>
                                                                    
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className={`font-medium truncate ${isSelected ? 'text-emerald-700' : 'text-slate-700'}`}>
                                                                            {file.files.length > 1 ? `${file.file_name} (${j + 1})` : file.file_name}
                                                                        </div>
                                                                        {file.file_comment && (
                                                                            <div className="text-xs text-slate-400 truncate">{file.file_comment}</div>
                                                                        )}
                                                                    </div>

                                                                    <FileText size={16} className={`${isSelected ? 'text-emerald-400' : 'text-slate-300'}`} />
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
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
