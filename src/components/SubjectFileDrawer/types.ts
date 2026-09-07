/**
 * SubjectFileDrawer Types
 *
 * Shared types for SubjectFileDrawer subcomponents.
 */

import type { BlockLesson } from '../../types/calendarTypes';
import type { ParsedFile, CourseMetadata, SubjectInfo } from '../../types/documents';
import type { SelectedSubject } from '../../types/app';

export type DrawerTab = 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';

export interface DrawerHeaderProps {
  lesson: BlockLesson | SelectedSubject | null;
  courseId: string;
  courseInfo?: CourseMetadata; // New: metadata for search/sidebar view
  subjectInfo?: SubjectInfo | null;
  selectedCount: number;
  isDownloading: boolean;
  downloadProgress?: { completed: number; total: number } | null;
  activeTab: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';
  tabCounts?: Record<string, number | undefined>;
  onClose: () => void;
  onDownload: () => void;
  onTabChange: (tab: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik') => void;
}

export interface FileGroup {
  name: string;
  displayName: string;
  files: ParsedFile[];
}

/** What a PDF row knows that the iPad reader needs: the display name and IS's document date. */
export interface PdfRowMeta {
  name: string;
  date: string;
}

export interface FileListProps {
  groups: FileGroup[];
  selectedIds: string[];
  courseCode: string;
  fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  ignoreClickRef: React.MutableRefObject<boolean>;
  onToggleSelect: (id: string, e: React.SyntheticEvent) => void;
  onOpenFile: (link: string) => void;
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
  onDownloadSingle?: (link: string) => void;
  folderUrl?: string;
  lastVisitedAt?: number | null;
  /** Per-row selection checkboxes. Defaults to on for desktop, where
   *  selection feeds ctrl-click and rubber-band multi-select for a bulk
   *  download. The phone drawer has neither, so it turns them off — a
   *  checkbox that only ever selects one row at a time is noise. */
  selectable?: boolean;
  /** Off for the phone sheet, which pins its own IS MENDELU footer. */
  showIsBacklink?: boolean;
}

export interface DragSelectionState {
  isDragging: boolean;
  selectionStart: { x: number; y: number } | null;
  selectionEnd: { x: number; y: number } | null;
  selectedIds: string[];
}
