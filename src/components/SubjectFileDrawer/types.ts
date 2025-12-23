/**
 * SubjectFileDrawer Types
 * 
 * Shared types for SubjectFileDrawer subcomponents.
 */

import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile } from '../../types/documents';

export interface DrawerHeaderProps {
    lesson: BlockLesson | null;
    courseId: string;
    selectedCount: number;
    isDownloading: boolean;
    activeTab: 'files' | 'stats';
    onClose: () => void;
    onDownload: () => void;
    onTabChange: (tab: 'files' | 'stats') => void;
}

export interface FileGroup {
    name: string;
    displayName: string;
    files: ParsedFile[];
}

export interface FileListProps {
    groups: FileGroup[];
    selectedIds: string[];
    fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
    ignoreClickRef: React.MutableRefObject<boolean>;
    onToggleSelect: (id: string, e: React.MouseEvent) => void;
    onOpenFile: (link: string) => void;
}

export interface DragSelectionState {
    isDragging: boolean;
    selectionStart: { x: number; y: number } | null;
    selectionEnd: { x: number; y: number } | null;
    selectedIds: string[];
}
