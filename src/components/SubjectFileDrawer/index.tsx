/**
 * SubjectFileDrawer Component (Refactored)
 * 
 * Modular drawer for displaying subject files with drag selection.
 * Main orchestration component delegating to subcomponents.
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { loggers } from '../../utils/logger';
import { useSubjects, useSchedule } from '../../hooks/data';
import { getFilesForSubject } from '../../utils/apiUtils';
import { cleanFolderName } from '../../utils/fileUrl';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { SuccessRateTab } from '../SuccessRateTab';
import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';

import { DrawerHeader } from './DrawerHeader';
import { FileList, FileListSkeleton } from './FileList';
import { DragHint, SelectionBox } from './DragHint';
import { useDragSelection } from './useDragSelection';
import type { FileGroup } from './types';
const DRAG_HINT_STORAGE_KEY = 'reis_drag_hint_shown';

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
    const [showDragHint, setShowDragHint] = useState(false);

    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Drag selection hook
    const {
        selectedIds,
        isDragging,
        selectionBoxStyle,
        ignoreClickRef,
        handleMouseDown,
        toggleSelect,
    } = useDragSelection({
        isOpen,
        containerRef,
        contentRef,
        fileRefs
    });

    // Load files
    useEffect(() => {
        if (!isOpen || !lesson || !subjectsLoaded) return;
        setLoading(true);
        const cachedFiles = getFilesForSubject(lesson.courseCode);
        setFiles(cachedFiles);
        setLoading(false);
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [isOpen, lesson, subjectsLoaded]);

    // Reset tab on close
    useEffect(() => {
        if (!isOpen) {
            setShowDragHint(false);
            setActiveTab('files');
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [isOpen]);

    // Show drag hint on first use
    useEffect(() => {
        if (!isOpen || loading || !files || files.length === 0) return;
        
        const hasSeenHint = localStorage.getItem(DRAG_HINT_STORAGE_KEY);
        if (hasSeenHint) return;
        
        localStorage.setItem(DRAG_HINT_STORAGE_KEY, 'true');
        
        const showTimer = setTimeout(() => setShowDragHint(true), 800);
        const hideTimer = setTimeout(() => setShowDragHint(false), 4800);
        
        return () => {
            clearTimeout(showTimer);
            clearTimeout(hideTimer);
        };
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [isOpen, loading, files]);

    // Resolve courseId from schedule if not present
    const resolvedCourseId = useMemo(() => {
        if (lesson?.courseId) return lesson.courseId;
        if (!lesson?.courseCode || !schedule?.length) return '';
        
        const matchingLesson = schedule.find(s => s.courseCode === lesson.courseCode && s.courseId);
        return matchingLesson?.courseId || '';
    }, [lesson?.courseId, lesson?.courseCode, schedule]);

    // Group and sort files
    const groupedFiles: FileGroup[] = useMemo(() => {
        if (!files) return [];
        const groups = new Map<string, ParsedFile[]>();
        
        files.forEach(f => {
            const subfolder = f.subfolder?.trim() || 'Ostatní';
            if (!groups.has(subfolder)) groups.set(subfolder, []);
            groups.get(subfolder)?.push(f);
        });

        const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
            if (a === 'Ostatní') return 1;
            if (b === 'Ostatní') return -1;
            return a.localeCompare(b, 'cs');
        });

        const naturalCompare = (s1: string, s2: string) =>
            s1.localeCompare(s2, 'cs', { numeric: true, sensitivity: 'base' });

        const sortFiles = (groupFiles: ParsedFile[]): ParsedFile[] => {
            return [...groupFiles].sort((a, b) => {
                const commentA = a.file_comment?.trim();
                const commentB = b.file_comment?.trim();
                
                if (commentA && commentB) return naturalCompare(commentA, commentB);
                if (commentA && !commentB) return -1;
                if (!commentA && commentB) return 1;
                return naturalCompare(a.file_name, b.file_name);
            });
        };

        return sortedKeys.map(key => ({
            name: key,
            displayName: key === 'Ostatní' ? 'Ostatní' : cleanFolderName(key, lesson?.courseCode),
            files: sortFiles(groups.get(key) || [])
        }));
    }, [files, lesson?.courseCode]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/15 transition-opacity animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Drawer Container */}
            <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                {/* Drawer */}
                <div className="w-[600px] bg-base-100 shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-base-300 font-inter h-full animate-in slide-in-from-right duration-300 pointer-events-auto">
                    
                    <DrawerHeader
                        lesson={lesson}
                        courseId={resolvedCourseId}
                        selectedCount={selectedIds.length}
                        isDownloading={isDownloading}
                        activeTab={activeTab}
                        onClose={onClose}
                        onDownload={() => downloadZip(selectedIds, `${lesson?.courseCode}_files.zip`)}
                        onTabChange={setActiveTab}
                    />

                    {/* Content Area */}
                    <div 
                        ref={containerRef}
                        className="flex-1 overflow-y-auto relative select-none"
                        onMouseDown={activeTab === 'files' ? handleMouseDown : undefined}
                        style={{ cursor: activeTab === 'files' ? 'crosshair' : 'default' }}
                    >
                        <div ref={contentRef} className="min-h-full pb-20 relative">
                            <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
                            
                            {activeTab === 'files' && <DragHint show={showDragHint} />}

                            {activeTab === 'files' ? (
                                loading || !subjectsLoaded || !files ? (
                                    <FileListSkeleton />
                                ) : (
                                    <FileList
                                        groups={groupedFiles}
                                        selectedIds={selectedIds}
                                        fileRefs={fileRefs}
                                        ignoreClickRef={ignoreClickRef}
                                        onToggleSelect={toggleSelect}
                                        onOpenFile={openFile}
                                    />
                                )
                            ) : (
                                <SuccessRateTab courseCode={lesson?.courseCode || ''} />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
