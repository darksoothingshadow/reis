/**
 * EventPopover - Subject files popover component.
 * 
 * Shows files for a subject when clicking on a calendar event.
 * Modularized: uses extracted components and hooks.
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useSubjects } from '../../hooks/data';
import { GetIdFromLink } from '../../utils/calendarUtils';
import { getFilesFromId } from '../../utils/apiUtils';
import { cleanFolderName } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { PopoverHeader } from './PopoverHeader';
import { PopoverTabs } from './PopoverTabs';
import { FileItem } from './FileItem';
import { DownloadButton } from './DownloadButton';
import type { FileObject, StoredSubject, BlockLesson } from '../../types/calendarTypes';

const log = createLogger('EventPopover');

interface EventPopoverProps {
    lesson: BlockLesson | null;
    isOpen: boolean;
    onClose: () => void;
    anchorRef: React.RefObject<HTMLElement | null>;
}

export function EventPopover({ lesson, isOpen, onClose, anchorRef }: EventPopoverProps) {
    const popupRef = useRef<HTMLDivElement>(null);
    const { getSubject, isLoaded: subjectsLoaded } = useSubjects();

    const [position, setPosition] = useState({ top: 0, left: 0 });
    const [files, setFiles] = useState<FileObject[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('all');
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    const { isDownloading, openFile, downloadZip } = useFileActions();

    // Get subject data
    const subject: StoredSubject | null = useMemo(() => {
        if (!lesson) return null;
        const s = getSubject(lesson.courseCode);
        if (!s) return null;
        return { fullName: s.fullName, folderUrl: s.folderUrl };
    }, [getSubject, lesson]);

    // Calculate position - viewport-relative since wrapper is fixed
    useEffect(() => {
        if (isOpen && anchorRef.current && lesson) {
            log.debug(`Calculating position for lesson: ${lesson.courseCode}`);
            const anchorRect = anchorRef.current.getBoundingClientRect();

            const popupWidth = 450;
            const popupHeight = 400;
            const padding = 16;
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;

            let left = anchorRect.right + 8;
            let top = anchorRect.top;

            if (left + popupWidth > viewportWidth - padding) {
                const leftCandidate = anchorRect.left - popupWidth - 8;
                if (leftCandidate > padding) {
                    left = leftCandidate;
                } else {
                    left = Math.max(padding, anchorRect.left);
                    if (left + popupWidth > viewportWidth - padding) {
                        left = viewportWidth - popupWidth - padding;
                    }
                    top = anchorRect.bottom + 4;
                }
            }

            if (top + popupHeight > viewportHeight - padding) {
                const diff = (top + popupHeight) - (viewportHeight - padding);
                top = Math.max(padding, top - diff);
            }

            setPosition({ top, left });
        }
    }, [isOpen, anchorRef, lesson]);

    // Load files when opened
    useEffect(() => {
        if (!isOpen || !subject || !subjectsLoaded) return;

        const startTime = performance.now();
        setLoading(true);

        (async () => {
            try {
                const folderId = GetIdFromLink(subject.folderUrl);
                const freshFiles = await getFilesFromId(folderId);
                const loadTime = (performance.now() - startTime).toFixed(0);
                log.debug(`Loaded ${freshFiles?.length ?? 0} files in ${loadTime}ms`);
                setFiles(freshFiles);
            } catch (e) {
                log.error('Error fetching files', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [isOpen, subject, subjectsLoaded]);

    // Reset selection on close
    useEffect(() => {
        if (!isOpen) {
            setSelectedIds([]);
            setActiveTab('all');
        }
    }, [isOpen]);

    // Backdrop click handler
    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    // Escape key handler
    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    // Map subfolders to clean names
    const folderMap = useMemo(() => {
        if (!files || files.length === 0) return new Map();
        const map = new Map<string, string>();
        files.forEach(f => {
            if (f.subfolder && f.subfolder.trim()) {
                const displayName = cleanFolderName(f.subfolder, lesson?.courseCode);
                map.set(f.subfolder, displayName);
            }
        });
        return map;
    }, [files, lesson?.courseCode]);

    // Get unique tabs
    const tabs = useMemo(() => {
        return Array.from(folderMap.keys()).sort();
    }, [folderMap]);

    // Natural sort comparator - handles "Cvičení 1" vs "Cvičení 10" correctly
    const naturalCompare = useCallback((a: string, b: string): number => {
        // Split into text and number chunks
        const regex = /(\d+)/g;
        const aParts = a.split(regex);
        const bParts = b.split(regex);

        for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aPart = aParts[i] || '';
            const bPart = bParts[i] || '';

            // Both are numbers - compare numerically
            const aNum = parseInt(aPart, 10);
            const bNum = parseInt(bPart, 10);
            if (!isNaN(aNum) && !isNaN(bNum)) {
                if (aNum !== bNum) return aNum - bNum;
            } else {
                // Compare as strings (Czech locale)
                const cmp = aPart.localeCompare(bPart, 'cs');
                if (cmp !== 0) return cmp;
            }
        }
        return 0;
    }, []);

    // Filter and sort files - by comment first (if present), then by name
    const visibleFiles = useMemo(() => {
        if (!files) return [];
        let filtered = files;
        if (activeTab !== 'all') {
            filtered = files.filter(f => f.subfolder === activeTab);
        }
        // Sort: files with comments first (sorted by comment), then files without (sorted by name)
        return [...filtered].sort((a, b) => {
            const aComment = a.file_comment?.trim() || '';
            const bComment = b.file_comment?.trim() || '';

            // If both have comments, sort by comment (natural sort for numbers)
            if (aComment && bComment) {
                return naturalCompare(aComment, bComment);
            }
            // Files with comments come first
            if (aComment && !bComment) return -1;
            if (!aComment && bComment) return 1;
            // Both without comments - sort by name (natural sort)
            return naturalCompare(a.file_name, b.file_name);
        });
    }, [files, activeTab, naturalCompare]);

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    // Handle ZIP download
    const handleDownloadZip = () => {
        if (lesson && selectedIds.length >= 2) {
            downloadZip(selectedIds, `${lesson.courseCode}_files.zip`);
            setSelectedIds([]);
        }
    };

    if (!isOpen || !lesson) return null;

    return (
        <div className="fixed inset-0 z-[100]" onClick={handleBackdropClick}>
            <div
                ref={popupRef}
                className="absolute bg-white rounded-lg shadow-2xl border border-slate-200 ring-1 ring-slate-900/10 w-[450px] max-h-[450px] flex flex-col"
                style={{ top: position.top, left: position.left }}
                onClick={e => e.stopPropagation()}
            >
                <PopoverHeader
                    courseCode={lesson.courseCode}
                    room={lesson.room}
                    teacherName={lesson.teachers[0]?.shortName}
                    onClose={onClose}
                />

                <PopoverTabs
                    tabs={tabs}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    getTabLabel={key => folderMap.get(key) || key}
                />

                {/* File List */}
                <div className="flex-1 overflow-y-auto p-2 min-h-[150px] scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
                    {loading ? (
                        <div className="flex items-center justify-center h-24">
                            <Loader2 size={20} className="animate-spin text-slate-400" />
                        </div>
                    ) : !files || visibleFiles.length === 0 ? (
                        <div className="flex items-center justify-center h-24 text-xs text-slate-400 italic">
                            Žádné soubory v této složce
                        </div>
                    ) : (
                        <div className="space-y-0.5">
                            {visibleFiles.map((file, i) =>
                                file.files.map((subFile, j) => (
                                    <FileItem
                                        key={`${i}-${j}`}
                                        fileName={
                                            file.files.length === 1
                                                ? file.file_name
                                                : `${file.file_name}: část ${j + 1}`
                                        }
                                        comment={file.file_comment}
                                        isSelected={selectedIds.includes(subFile.link)}
                                        onToggleSelect={() => toggleSelect(subFile.link)}
                                        onOpen={() => openFile(subFile.link)}
                                    />
                                ))
                            )}
                        </div>
                    )}
                </div>

                <DownloadButton
                    selectedCount={selectedIds.length}
                    isDownloading={isDownloading}
                    onDownload={handleDownloadZip}
                />
            </div>
        </div>
    );
}
