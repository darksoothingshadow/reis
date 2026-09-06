import { lazy, Suspense, useRef, useState, useMemo } from 'react';
import type { SyntheticEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { SubjectDrawerTabs } from './SubjectDrawerTabs';
import { DrawerTabBody } from '../../SubjectFileDrawer/DrawerTabBody';
import { groupAndSortFiles } from '../../SubjectFileDrawer/utils/groupFiles';
import type { DrawerTab } from '../../SubjectFileDrawer/types';
import type { SelectedSubject } from '../../../types/app';
import type { MobileSheet } from '../../../store/types';
import { useFiles } from '../../../hooks/data/useFiles';
import { useClassmates } from '../../../hooks/data/useClassmates';
import { useZaznamnik } from '../../../hooks/data/useZaznamnik';
import { useSyllabus } from '../../../hooks/data/useSyllabus';
import { useSubjects } from '../../../hooks/data/useSubjects';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { useSyncStatus } from '../../../hooks/data/useSyncStatus';
import { usePdfPreview } from '../../../hooks/ui/usePdfPreview';
import { listSubjectPdfs } from '../../SubjectFileDrawer/utils/listSubjectPdfs';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';

// pdf.js and its worker are the heaviest thing the app can load; a student who
// never opens a PDF should never pay for it.
const PdfViewer = lazy(() =>
  import('../../SubjectFileDrawer/PdfViewer').then((m) => ({ default: m.PdfViewer }))
);

type SubjectDrawerSheetData = Extract<MobileSheet, { kind: 'subjectDrawer' }>;

const NO_ID_DISABLED: DrawerTab[] = ['files', 'classmates', 'zaznamnik'];

export interface SubjectDrawerSheetProps {
  sheet: SubjectDrawerSheetData;
  onClose: () => void;
}

/**
 * Full-size sheet for a single subject: header, five-tab icon bar, the
 * shared `DrawerTabBody` beneath, and a persistent "open in IS" footer.
 *
 * Selection/drag props passed to `DrawerTabBody` are mouse-only concerns
 * (rubber-band rectangle select) that don't translate to touch, so this sheet
 * hardcodes `isDragging`/`selectionBoxStyle`/`showDragHint` to their off
 * states — there is no rectangle to draw and no hint to teach on a phone —
 * and passes `selectable={false}` to drop the per-row checkboxes: with no
 * ctrl-click, no drag-select and no bulk-download bar on a phone, the only
 * thing a checkbox could do is select one row at a time. Files open or
 * download from the row itself. `selectedIds`/`toggleSelect` are still
 * threaded through because `DrawerTabBody` requires them.
 */
export function SubjectDrawerSheet({ sheet, onClose }: SubjectDrawerSheetProps) {
  const { courseCode, courseName, courseId } = sheet;
  const { t, language } = useTranslation();
  const { getSubject } = useSubjects();
  // Mirrors desktop's useSubjectFileDrawerState: files/classmates/zaznamnik
  // need a subjectId (an enrolled subject) to fetch anything, so a subject
  // not yet resolved to one opens on Success rate instead of a dead tab.
  const [activeTab, setActiveTab] = useState<DrawerTab>(() =>
    getSubject(courseCode)?.subjectId ? 'files' : 'stats'
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const ignoreClickRef = useRef(false);

  const subjectInfo = getSubject(courseCode);
  const { schedule } = useSchedule();
  const { isSyncing } = useSyncStatus();
  // Tapping a PDF opens it in the reader rather than exporting it: on iOS the
  // download path is the share sheet, so "just let me read page 3" meant saving
  // the file out of the app first. The row's own download button is untouched.
  const resolvedCourseId =
    courseId || schedule.find((s) => s.courseCode === courseCode && s.courseId)?.courseId || '';

  const { files, isLoading: isFilesLoading } = useFiles(courseCode);
  // The course keys the iPad reader's ink and PDF cache, and its PDFs fill the
  // reader's sidebar so a student can switch files without coming back here.
  const readerSubject = useMemo(
    () => ({ title: courseName || courseCode, files: listSubjectPdfs(files) }),
    [courseName, courseCode, files]
  );
  const { previewUrl, viewPdf, closePreview, openFile, downloadSingle } = usePdfPreview(
    courseCode,
    readerSubject
  );
  const { classmates } = useClassmates(courseCode);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const { data: zaznamnikData } = useZaznamnik(courseCode);
  const syllabusResult = useSyllabus(courseCode, resolvedCourseId, courseName);

  const groupedFiles = groupAndSortFiles(files, courseCode, t);

  const filesCount = files?.reduce((acc, f) => acc + f.files.length, 0) ?? 0;
  const zaznamnikCount = zaznamnikData
    ? (zaznamnikData.ph.sections?.reduce(
        (n, s) => n + s.arches.filter((a) => !a.empty).length,
        0
      ) ?? 0) + (zaznamnikData.vt.tests?.length ?? 0)
    : undefined;
  const counts: Partial<Record<DrawerTab, number | undefined>> = {
    files: filesCount,
    classmates: classmates?.length,
    zaznamnik: zaznamnikCount,
  };

  const disabledTabs = subjectInfo?.subjectId ? [] : NO_ID_DISABLED;
  const teacherLine = syllabusResult.syllabus?.courseInfo?.teachers
    ?.map((teacher) => teacher.name)
    .join(', ');

  const openInIsHref = subjectInfo?.folderUrl
    ? `${subjectInfo.folderUrl}${subjectInfo.folderUrl.includes('?') ? ';' : '?'}lang=${language}`
    : resolvedCourseId
      ? `https://is.mendelu.cz/auth/katalog/syllabus.pl?predmet=${resolvedCourseId};lang=${language}`
      : null;

  const toggleSelect = (id: string, e: SyntheticEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const lesson: SelectedSubject = {
    courseCode,
    courseName: courseName || courseCode,
    courseId: resolvedCourseId,
    id: courseCode,
  };

  return (
    <Sheet size="full" variant="screen" onClose={onClose}>
      <SheetHeader
        eyebrow={courseCode}
        title={courseName || courseCode}
        subtitle={teacherLine}
        onBack={onClose}
      />
      <SubjectDrawerTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        disabledTabs={disabledTabs}
        counts={counts}
      />
      <div className="relative flex-1 overflow-y-auto">
        <DrawerTabBody
          tab={activeTab}
          lesson={lesson}
          files={files}
          isFilesLoading={isFilesLoading}
          isSyncing={isSyncing}
          isDragging={false}
          selectionBoxStyle={null}
          showDragHint={false}
          groupedFiles={groupedFiles}
          selectedIds={selectedIds}
          fileRefs={fileRefs}
          ignoreClickRef={ignoreClickRef}
          toggleSelect={toggleSelect}
          openFile={openFile}
          onViewPdf={viewPdf}
          onDownloadSingle={downloadSingle}
          resolvedCourseId={resolvedCourseId}
          syllabusResult={syllabusResult}
          folderUrl={subjectInfo?.folderUrl}
          selectable={false}
          // The pinned 'Otevrit v IS MENDELU' footer below is this sheet's single
          // IS link. Left on, every tab also rendered its own 'IS MENDELU' at the
          // end of its content — two identical-looking links to the same place.
          showIsBacklink={false}
          // A classmate tap reaches the same PersonSheet the Lidé search
          // opens. Without this it landed in ClassmatePersonDrawer — a second
          // person view with no office, no phone and no map button, so the
          // same student looked different depending on where you tapped them.
          onSelectPerson={(classmate) =>
            pushSheet({
              kind: 'person',
              personId: String(classmate.personId),
              personName: classmate.name,
            })
          }
          // The programme line only ever rendered clipped mid-word on a phone.
          showStudyInfo={false}
        />
      </div>
      {previewUrl && (
        // Over the whole screen, not inside the tab body: a phone/tablet has no
        // room for the desktop's side-by-side drawer, and the reader needs every
        // pixel. Back closes the reader first, the drawer second.
        <div
          className="absolute inset-0 z-20 flex flex-col bg-base-100 pt-[var(--safe-top,0px)]"
          data-testid="mobile-pdf-preview-overlay"
        >
          {/* min-h-0 so the viewer's own scroll container can shrink inside
              this flex column rather than overflowing past the screen. */}
          <div className="min-h-0 flex-1">
            <Suspense fallback={null}>
              <PdfViewer key={previewUrl} blobUrl={previewUrl} onClose={closePreview} />
            </Suspense>
          </div>
        </div>
      )}
      {openInIsHref && (
        <a
          href={openInIsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-base-300 py-3 text-xs font-semibold text-base-content/60"
        >
          {t('mobile.sheet.openInIsMendelu')}
          <ExternalLink size={13} />
        </a>
      )}
    </Sheet>
  );
}
