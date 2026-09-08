import { Timer } from 'lucide-react';
import type { DrawerHeaderProps } from './types';
import type { BlockLesson } from '../../types/calendarTypes';
import { HeaderActions } from './Header/HeaderActions';
import { CourseMeta } from './Header/CourseMeta';
import { EditableCourseTitle } from './Header/EditableCourseTitle';
import { HeaderTabs } from './Header/HeaderTabs';
import { FilesFreshness } from './Header/FilesFreshness';
import { ZaznamnikLine } from '../SubjectsPanel/ZaznamnikLine';
import { useTranslation } from '../../hooks/useTranslation';
import { useTimeline } from '../../hooks/useTimeline';

const NO_ID_DISABLED: string[] = ['files', 'classmates', 'zaznamnik'];
const EMPTY_TABS: string[] = [];
const ZERO_BADGE_TABS = ['zaznamnik'] as const;

function formatDate(ds: string, t: (k: string) => string) {
  if (!ds || ds.length !== 8) return '';
  const d = new Date(
    parseInt(ds.substring(0, 4)),
    parseInt(ds.substring(4, 6)) - 1,
    parseInt(ds.substring(6, 8))
  );
  const dayNames = [
    t('days.sunday'),
    t('days.monday'),
    t('days.tuesday'),
    t('days.wednesday'),
    t('days.thursday'),
    t('days.friday'),
    t('days.saturday'),
  ];
  return `${dayNames[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`;
}

function getBadge(
  l: { isExam?: boolean; courseName?: string; sectionName?: string; isSeminar?: string } | null,
  t: (k: string) => string
) {
  if (!l) return null;
  if (l.isExam) {
    const test =
      (l.courseName || '').toLowerCase().includes('test') ||
      (l.sectionName || '').toLowerCase().includes('test');
    return {
      label: test ? t('course.badge.test') : t('course.badge.exam'),
      cls: 'bg-error/12 text-[var(--tone-error)]',
    };
  }
  return l.isSeminar === 'true'
    ? {
        label: t('course.badge.seminar'),
        cls: 'bg-info/12 text-[var(--tone-info)]',
      }
    : {
        label: t('course.badge.lecture'),
        cls: 'bg-primary/12 text-[var(--tone-primary)]',
      };
}

export function DrawerHeader({
  lesson,
  courseId,
  courseInfo,
  subjectInfo,
  selectedCount,
  isDownloading,
  downloadProgress,
  activeTab,
  tabCounts,
  onClose,
  onDownload,
  onTabChange,
}: DrawerHeaderProps) {
  const { t, language } = useTranslation();
  const badge = getBadge(lesson, t),
    isSearch = lesson?.isFromSearch;
  const courseCode = subjectInfo?.subjectCode || (lesson as BlockLesson)?.courseCode;
  const timeline = useTimeline(courseCode || '');

  return (
    <div className="@container px-4 sm:px-6 py-4 border-b border-base-300 bg-base-100 z-20">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {!isSearch ? (
            <>
              {badge && (
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${badge.cls}`}>
                  {badge.label}
                </span>
              )}
              {'date' in (lesson ?? {}) && (lesson as BlockLesson)?.date && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-base-300 text-base-content/70">
                  {formatDate((lesson as BlockLesson).date, t)}
                </span>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2">
              {courseInfo?.status && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-base-300 text-base-content/70 capitalize">
                  {courseInfo.status.toLowerCase().includes('povinný')
                    ? t('course.status.povinný')
                    : courseInfo.status.toLowerCase().includes('volitelný')
                      ? t('course.status.volitelný')
                      : courseInfo.status.toLowerCase().includes('povinně volitelný')
                        ? t('course.status.povinně volitelný')
                        : courseInfo.status}
                </span>
              )}
              {courseInfo?.credits && (
                <span className="px-2 py-0.5 rounded text-xs font-bold bg-primary/12 text-[var(--tone-primary)] capitalize">
                  {courseInfo.credits
                    .toLowerCase()
                    .replace('kreditů', language === 'cz' ? 'kreditů' : 'credits')
                    .replace('kredity', language === 'cz' ? 'kredity' : 'credits')
                    .replace('kredit', language === 'cz' ? 'kredit' : 'credit')}
                </span>
              )}
            </div>
          )}
          {timeline && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-primary/12 text-[var(--tone-primary)] animate-in fade-in zoom-in duration-300">
              <Timer size={12} />
              <span>{timeline.formatted}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activeTab === 'files' && courseCode && <FilesFreshness courseCode={courseCode} />}
          <HeaderActions
            selectedCount={selectedCount}
            isDownloading={isDownloading}
            downloadProgress={downloadProgress}
            onDownload={onDownload}
            onClose={onClose}
          />
        </div>
      </div>
      <div className="mb-2">
        {(() => {
          // Selection logic consistent with Sidebar.tsx:
          // 1. Store Name (SubjectInfo)
          // 2. Syllabus Name (CourseMetadata)
          // 3. Store DisplayName (SubjectInfo fallback)
          // 4. Lesson Name (BlockLesson)
          const storeName = language === 'cz' ? subjectInfo?.nameCs : subjectInfo?.nameEn;

          const syllabusName =
            language === 'cz'
              ? courseInfo?.courseNameCs || courseInfo?.courseName
              : courseInfo?.courseNameEn || courseInfo?.courseName;

          const blockLessonName =
            language === 'cz'
              ? (lesson as BlockLesson)?.courseNameCs
              : (lesson as BlockLesson)?.courseNameEn;

          const displayName = storeName || syllabusName || blockLessonName || lesson?.courseName;

          return (
            <EditableCourseTitle
              courseCode={courseCode}
              courseId={courseId}
              defaultName={displayName || ''}
              language={language}
            />
          );
        })()}
      </div>
      <CourseMeta
        lesson={lesson && 'date' in lesson ? (lesson as BlockLesson) : null}
        courseInfo={courseInfo}
        isSearchContext={!!isSearch}
      />
      {courseCode && (
        <ZaznamnikLine
          courseCode={courseCode}
          subjectId={subjectInfo?.subjectId}
          className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-2 mb-1"
        />
      )}
      <HeaderTabs
        activeTab={activeTab}
        onTabChange={onTabChange}
        disabledTabs={!subjectInfo?.subjectId ? NO_ID_DISABLED : EMPTY_TABS}
        counts={tabCounts}
        zeroBadgeTabs={[...ZERO_BADGE_TABS]}
      />
    </div>
  );
}
