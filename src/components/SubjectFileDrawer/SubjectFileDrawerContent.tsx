import { DrawerTabBody } from './DrawerTabBody';
import type { FileGroup, DrawerTab, PdfRowMeta } from './types';
import type { SyllabusRequirements, ParsedFile } from '../../types/documents';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';

interface SubjectFileDrawerContentProps {
  activeTab: DrawerTab;
  lesson: BlockLesson | SelectedSubject | null;
  files: ParsedFile[] | null;
  isFilesLoading: boolean;
  isSyncing: boolean;
  isDragging: boolean;

  selectionBoxStyle: { left: number; top: number; width: number; height: number } | null;
  showDragHint: boolean;
  groupedFiles: FileGroup[];
  selectedIds: string[];
  fileRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  ignoreClickRef: React.MutableRefObject<boolean>;
  toggleSelect: (id: string, e: React.SyntheticEvent) => void;
  openFile: (link: string) => void;
  onViewPdf?: (link: string, meta: PdfRowMeta) => void;
  onDownloadSingle?: (link: string) => void;
  resolvedCourseId: string;
  syllabusResult: { syllabus: SyllabusRequirements | null; isLoading: boolean };
  folderUrl?: string;
  lastVisitedAt?: number | null;
}

export function SubjectFileDrawerContent({
  activeTab,
  lesson,
  files,
  isFilesLoading,
  isSyncing,
  isDragging,
  selectionBoxStyle,
  showDragHint,
  groupedFiles,
  selectedIds,
  fileRefs,
  ignoreClickRef,
  toggleSelect,
  openFile,
  onViewPdf,
  onDownloadSingle,
  resolvedCourseId,
  syllabusResult,
  folderUrl,
  lastVisitedAt,
}: SubjectFileDrawerContentProps) {
  return (
    <DrawerTabBody
      tab={activeTab}
      lesson={lesson}
      files={files}
      isFilesLoading={isFilesLoading}
      isSyncing={isSyncing}
      isDragging={isDragging}
      selectionBoxStyle={selectionBoxStyle}
      showDragHint={showDragHint}
      groupedFiles={groupedFiles}
      selectedIds={selectedIds}
      fileRefs={fileRefs}
      ignoreClickRef={ignoreClickRef}
      toggleSelect={toggleSelect}
      openFile={openFile}
      onViewPdf={onViewPdf}
      onDownloadSingle={onDownloadSingle}
      resolvedCourseId={resolvedCourseId}
      syllabusResult={syllabusResult}
      folderUrl={folderUrl}
      lastVisitedAt={lastVisitedAt}
    />
  );
}
