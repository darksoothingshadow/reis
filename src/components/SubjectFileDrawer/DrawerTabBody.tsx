import { FileText, Loader2 } from 'lucide-react';
import { FileList, FileListSkeleton } from './FileList';
import { SyllabusTab } from './SyllabusTab';
import { ClassmatesTab } from './ClassmatesTab';
import { ZaznamnikTab } from './ZaznamnikTab';
import { SuccessRateTab } from '../SuccessRateTab';
import { SelectionBox, DragHint } from './DragHint';
import { ISBacklink } from './ISBacklink';
import type { FileGroup, DrawerTab, PdfRowMeta } from './types';
import type { SyllabusRequirements, ParsedFile } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';
import type { BlockLesson } from '../../types/calendarTypes';
import type { SelectedSubject } from '../../types/app';
import type { Classmate } from '../../types/classmates';

interface DrawerTabBodyProps {
  tab: DrawerTab;
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
  /** Forwarded to FileList — off for the phone drawer. */
  selectable?: boolean;
  /**
   * Whether the tab bodies render their own trailing 'IS MENDELU' link.
   * Off for the phone sheet, which pins its own 'Otevrit v IS MENDELU'
   * footer — showing both put two identical-looking links to the same
   * place in every tab.
   */
  showIsBacklink?: boolean;
  /** Forwarded to ClassmatesTab — the phone routes taps to its own PersonSheet. */
  onSelectPerson?: (classmate: Classmate) => void;
  /** Forwarded to ClassmatesTab — off for the phone's narrow rows. */
  showStudyInfo?: boolean;
}

/**
 * Renders the body for whichever drawer tab is active — no surrounding
 * chrome (header, tab bar). Shared by the desktop file drawer and the
 * mobile bottom sheet.
 */
export function DrawerTabBody({
  tab,
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
  selectable,
  showIsBacklink = true,
  onSelectPerson,
  showStudyInfo,
}: DrawerTabBodyProps) {
  const { t, language } = useTranslation();

  if (tab === 'files') {
    const isEmpty = !files || files.length === 0;
    const showSkeleton = isFilesLoading && isEmpty;
    const showProgress = showSkeleton || (isSyncing && isEmpty);

    return (
      <>
        <SelectionBox isDragging={isDragging} style={selectionBoxStyle} />
        <DragHint show={showDragHint} />
        {showProgress && (
          <div className="flex items-center gap-2 text-xs text-base-content/70 font-medium px-6 py-4 bg-base-200/30 border-b border-base-300 animate-in fade-in slide-in-from-top-1">
            <Loader2 size={12} className="text-primary animate-spin" />
            <span>{t('course.sync.loadingFiles') || 'Loading files...'}</span>
          </div>
        )}

        {showSkeleton ? (
          <FileListSkeleton />
        ) : isEmpty && !showProgress ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <FileText className="w-12 h-12 text-base-content/20 mb-3" />
            {/* One message regardless of how the subject was reached. The
                search case used to claim files exist only for subjects in the
                schedule, which is simply not true — a searched subject can have
                files, and saying otherwise sent students to IS for nothing. */}
            <p className="text-sm text-base-content/60">{t('course.footer.noFilesAvailable')}</p>
            {folderUrl && showIsBacklink && (
              <ISBacklink
                href={
                  folderUrl.includes('?')
                    ? `${folderUrl};lang=${language === 'cz' ? 'cz' : 'en'}`
                    : `${folderUrl}?lang=${language === 'cz' ? 'cz' : 'en'}`
                }
                showBorder={false}
              />
            )}
          </div>
        ) : (
          <FileList
            key={lesson?.courseCode || ''}
            groups={groupedFiles}
            selectedIds={selectedIds}
            courseCode={lesson?.courseCode || ''}
            fileRefs={fileRefs}
            ignoreClickRef={ignoreClickRef}
            onToggleSelect={toggleSelect}
            onOpenFile={openFile}
            onViewPdf={onViewPdf}
            onDownloadSingle={onDownloadSingle}
            folderUrl={folderUrl}
            lastVisitedAt={lastVisitedAt}
            selectable={selectable}
            showIsBacklink={showIsBacklink}
          />
        )}
      </>
    );
  }

  if (tab === 'syllabus')
    return (
      <SyllabusTab
        showIsBacklink={showIsBacklink}
        courseCode={lesson?.courseCode || ''}
        courseId={resolvedCourseId}
        courseName={lesson?.courseName ?? ''}
        prefetchedResult={syllabusResult}
      />
    );
  if (tab === 'classmates')
    return (
      <ClassmatesTab
        courseCode={lesson?.courseCode || ''}
        showIsBacklink={showIsBacklink}
        onSelectPerson={onSelectPerson}
        showStudyInfo={showStudyInfo}
      />
    );
  if (tab === 'zaznamnik')
    return <ZaznamnikTab courseCode={lesson?.courseCode || ''} showIsBacklink={showIsBacklink} />;

  return (
    <SuccessRateTab
      showIsBacklink={showIsBacklink}
      courseCode={lesson?.courseCode || ''}
      facultyCode={(lesson as { facultyCode?: string } | null)?.facultyCode}
    />
  );
}
