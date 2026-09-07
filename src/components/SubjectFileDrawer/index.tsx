import { useState, useEffect, useMemo, useCallback, useRef, Suspense, lazy } from 'react';
import { useFileActions } from '../../hooks/ui/useFileActions';
import { logError } from '../../utils/reportError';
import { DrawerHeader } from './DrawerHeader';
import { IndexedDBService } from '../../services/storage/IndexedDBService';
import { useSubjectFileDrawerState } from './useSubjectFileDrawerState';
import { SubjectFileDrawerContent } from './SubjectFileDrawerContent';
import { AdaptiveDrawer } from '../ui/AdaptiveDrawer';
import type { BlockLesson } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';
import type { SelectedSubject } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '../ui/resizable';
import { ErrorBoundary } from '../ui/ErrorBoundary';
import { DocumentNoteEditor } from './DocumentNoteEditor';
import { groupAndSortFiles } from './utils/groupFiles';

const PdfViewer = lazy(() => import('./PdfViewer').then((m) => ({ default: m.PdfViewer })));

export function SubjectFileDrawer({
  lesson,
  isOpen,
  onClose,
}: {
  lesson: BlockLesson | SelectedSubject | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const state = useSubjectFileDrawerState(lesson, isOpen);
  const { isDownloading, downloadProgress, openFile, openPdfInline, downloadSingle, downloadZip } =
    useFileActions();
  const [showDragHint, setShowDragHint] = useState(false);
  const [activePdfUrl, setActivePdfUrl] = useState<string | null>(null);
  const [activePdfFile, setActivePdfFile] = useState<{ link: string; name: string } | null>(null);
  const [activeNoteFile, setActiveNoteFile] = useState<{ link: string; name: string } | null>(null);
  const [lastVisitedAt, setLastVisitedAt] = useState<number | null | undefined>(undefined);
  const [isPdfLoading, setIsPdfLoading] = useState(false);
  const { t } = useTranslation();
  const classmatesCount = useAppStore((s) =>
    lesson?.courseCode ? s.classmates[lesson.courseCode]?.length : undefined
  );
  const zaznamnikData = useAppStore((s) =>
    lesson?.courseCode ? s.zaznamnik?.[lesson.courseCode] : undefined
  );
  const isPhone = useAppStore((s) => s.isTouch && s.isNarrow);

  const hasFiles = !!state.files?.length;

  const phSections = zaznamnikData?.ph.sections;
  const vtTests = zaznamnikData?.vt.tests;
  const maxZaznamnikCols = useMemo(() => {
    if (!phSections) return 0;
    return phSections.reduce(
      (max, s) => Math.max(max, ...s.arches.map((a) => a.columns.length)),
      0
    );
  }, [phSections]);

  const tabCounts = useMemo(() => {
    const phCount =
      phSections?.reduce((n, s) => n + s.arches.filter((a) => !a.empty).length, 0) ?? 0;
    const vtCount = vtTests?.length ?? 0;
    return {
      files: state.files?.reduce((acc, f) => acc + f.files.length, 0) || 0,
      classmates: classmatesCount || 0,
      zaznamnik: zaznamnikData !== undefined ? phCount + vtCount : undefined,
    };
  }, [state.files, classmatesCount, zaznamnikData, phSections, vtTests]);

  const flushDocumentNotes = useAppStore((s) => s.flushDocumentNotes);

  // Pending drag-hint timers, held in a ref so the drag-start effect below can
  // cancel them (otherwise a timer queued before the drag could re-show the hint).
  const dragHintTimers = useRef<{
    t1: ReturnType<typeof setTimeout> | null;
    t2: ReturnType<typeof setTimeout> | null;
  }>({ t1: null, t2: null });

  const clearDragHintTimers = useCallback(() => {
    if (dragHintTimers.current.t1) clearTimeout(dragHintTimers.current.t1);
    if (dragHintTimers.current.t2) clearTimeout(dragHintTimers.current.t2);
    dragHintTimers.current = { t1: null, t2: null };
  }, []);

  // Handle drag hint display — use boolean dep so array re-references don't reset the timer
  useEffect(() => {
    let isCurrent = true;

    if (isOpen && hasFiles) {
      IndexedDBService.get('meta', 'drag_hint_shown')
        .then((seen) => {
          if (!isCurrent) return;
          if (!seen) {
            IndexedDBService.set('meta', 'drag_hint_shown', true).catch((err) =>
              logError('SubjectFileDrawer.dragHint.setSeen', err)
            );
            dragHintTimers.current.t1 = setTimeout(() => {
              if (isCurrent) setShowDragHint(true);
            }, 800);
            dragHintTimers.current.t2 = setTimeout(() => {
              if (isCurrent) setShowDragHint(false);
            }, 8800);
          }
        })
        .catch((err) => logError('SubjectFileDrawer.dragHint.getSeen', err));
    }

    return () => {
      isCurrent = false;
      clearDragHintTimers();
    };
  }, [isOpen, hasFiles, clearDragHintTimers]);

  // Dismiss the drag hint the moment the user starts a drag selection — and
  // cancel any pending show timer so it can't re-appear once the drag ends.
  useEffect(() => {
    if (state.isDragging) {
      clearDragHintTimers();
      // Intentional sync with external drag state from useSubjectFileDrawerState.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowDragHint(false);
    }
  }, [state.isDragging, clearDragHintTimers]);

  // Hydrate last visited timestamp and update it
  useEffect(() => {
    const courseCode = lesson?.courseCode;
    if (!isOpen || !courseCode) return;
    let isCurrent = true;
    // Reset stale timestamp when switching subjects, before the async load below.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastVisitedAt(undefined);
    const key = `file_last_visit_${courseCode}`;
    IndexedDBService.get('meta', key).then((prev) => {
      if (!isCurrent) return;
      setLastVisitedAt(prev ?? null);
      IndexedDBService.set('meta', key, Date.now());
    });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, lesson?.courseCode]);

  // Consolidated cleanup when drawer closes to prevent state leakage
  useEffect(() => {
    if (!isOpen) {
      // Reset transient drawer state in response to the isOpen prop closing.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePdfFile(null);
      setActiveNoteFile(null);
      flushDocumentNotes();
      setActivePdfUrl(null);
    }
  }, [isOpen, flushDocumentNotes]);

  // Cleanup active object URL on unmount or URL change
  useEffect(() => {
    return () => {
      if (activePdfUrl) {
        URL.revokeObjectURL(activePdfUrl);
      }
    };
  }, [activePdfUrl]);

  const handleViewPdf = useCallback(
    async (link: string) => {
      if (isPdfLoading) return;
      setIsPdfLoading(true);
      const blobUrl = await openPdfInline(link);
      if (blobUrl) {
        setActivePdfUrl(blobUrl);
        const attachment = state.files?.flatMap((f) => f.files).find((sub) => sub.link === link);
        const activeFile = attachment
          ? { link: attachment.link, name: attachment.name }
          : { link, name: 'PDF Document' };
        setActivePdfFile(activeFile);
      } else {
        openFile(link);
      }
      setIsPdfLoading(false);
    },
    [openPdfInline, openFile, isPdfLoading, state.files]
  );

  const handleClosePdf = useCallback(() => {
    setActivePdfUrl(null);
    setActivePdfFile(null);
    setActiveNoteFile(null);
  }, []);

  const handleToggleNotes = useCallback(() => {
    if (activeNoteFile) {
      setActiveNoteFile(null);
    } else if (activePdfFile) {
      setActiveNoteFile(activePdfFile);
    }
  }, [activeNoteFile, activePdfFile]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const groupedFiles = useMemo(() => {
    return groupAndSortFiles(state.files, lesson?.courseCode, t);
  }, [state.files, lesson?.courseCode, t]);

  const {
    activeTab,
    setActiveTab,
    files,
    isFilesLoading,
    isSyncing,
    resolvedCourseId,
    syllabusResult,
    containerRef,
    contentRef,
    fileRefs,
    selectedIds,
    isDragging,
    ignoreClickRef,
    handleMouseDown,
    toggleSelect,
    selectionBoxStyle,
  } = state;

  const hasPdf = activePdfUrl !== null;
  const hasNote = activeNoteFile !== null;
  const needsWideDrawer = activeTab === 'zaznamnik' && maxZaznamnikCols >= 5;
  const drawerWidth = hasPdf ? 'sm:w-[90vw]' : needsWideDrawer ? 'sm:w-[800px]' : 'sm:w-[600px]';

  const fileListContent = (
    <>
      <DrawerHeader
        lesson={lesson}
        courseId={resolvedCourseId || syllabusResult.syllabus?.courseId || ''}
        courseInfo={syllabusResult.syllabus?.courseInfo}
        subjectInfo={state.subjectInfo}
        selectedCount={selectedIds.length}
        isDownloading={isDownloading}
        downloadProgress={downloadProgress}
        activeTab={activeTab}
        tabCounts={tabCounts}
        onTabChange={setActiveTab}
        onClose={handleClose}
        onDownload={() =>
          selectedIds.length === 1
            ? downloadSingle(selectedIds[0])
            : downloadZip(selectedIds, `${lesson?.courseCode}_files.zip`)
        }
      />
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto relative select-none"
        onMouseDown={activeTab === 'files' ? handleMouseDown : undefined}
        style={{ cursor: activeTab === 'files' ? 'crosshair' : 'default' }}
      >
        <div ref={contentRef} className="min-h-full pb-20 relative">
          <SubjectFileDrawerContent
            activeTab={activeTab}
            lesson={lesson}
            files={files}
            isFilesLoading={isFilesLoading}
            isSyncing={isSyncing}
            isDragging={isDragging}
            selectionBoxStyle={selectionBoxStyle}
            showDragHint={showDragHint && !isDragging}
            groupedFiles={groupedFiles}
            selectedIds={selectedIds}
            fileRefs={fileRefs}
            ignoreClickRef={ignoreClickRef}
            toggleSelect={toggleSelect}
            openFile={openFile}
            onViewPdf={handleViewPdf}
            onDownloadSingle={downloadSingle}
            resolvedCourseId={resolvedCourseId}
            syllabusResult={syllabusResult}
            folderUrl={state.subjectInfo?.folderUrl}
            lastVisitedAt={lastVisitedAt}
          />
        </div>
      </div>
    </>
  );

  const pdfFallback = (
    <div className="flex justify-center items-center h-full bg-base-300/30">
      <span className="loading loading-spinner loading-lg text-primary" />
    </div>
  );
  const pdfErrorFallback = (
    <div className="flex flex-col gap-3 justify-center items-center h-full bg-base-300/30 p-6 text-center">
      <p className="text-sm text-base-content/70">{t('course.pdf.loadFailed')}</p>
      <button className="btn btn-sm btn-primary" onClick={handleClosePdf}>
        {t('course.pdf.back')}
      </button>
    </div>
  );

  const pdfView = activePdfUrl ? (
    <ErrorBoundary resetKey={activePdfUrl} fallback={pdfErrorFallback}>
      <Suspense fallback={pdfFallback}>
        <PdfViewer
          key={activePdfUrl}
          blobUrl={activePdfUrl}
          onClose={handleClosePdf}
          onToggleNotes={handleToggleNotes}
          hasNotesOpen={hasNote}
        />
      </Suspense>
    </ErrorBoundary>
  ) : null;

  const noteEditorView = activeNoteFile ? (
    <DocumentNoteEditor
      courseCode={lesson?.courseCode || ''}
      fileLink={activeNoteFile.link}
      fileName={activeNoteFile.name}
      onClose={() => setActiveNoteFile(null)}
      showHeader
    />
  ) : null;

  const renderContent = () => {
    if (isPhone) {
      return noteEditorView || pdfView || fileListContent;
    }
    if (pdfView && noteEditorView) {
      return (
        <ResizablePanelGroup orientation="horizontal" className="h-full rounded-2xl">
          <ResizablePanel defaultSize={50} minSize={25}>
            {pdfView}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25}>
            {noteEditorView}
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }
    const rightSide = pdfView || noteEditorView;
    if (rightSide) {
      return (
        <ResizablePanelGroup orientation="horizontal" className="h-full rounded-2xl">
          <ResizablePanel defaultSize={35} minSize={20} className="flex flex-col">
            {fileListContent}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={65} minSize={30}>
            {rightSide}
          </ResizablePanel>
        </ResizablePanelGroup>
      );
    }
    return fileListContent;
  };

  return (
    <AdaptiveDrawer
      open={isOpen}
      onClose={handleClose}
      width={drawerWidth}
      title={lesson?.courseName || lesson?.courseCode || t('course.title')}
    >
      {isPdfLoading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-base-100/85 rounded-2xl">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}
      {renderContent()}
    </AdaptiveDrawer>
  );
}
