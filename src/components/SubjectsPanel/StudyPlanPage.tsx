import { useMemo, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { SearchBar } from '../SearchBar/index';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SemesterSection } from './SemesterSection';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { HardestUpcomingCard } from './HardestUpcomingCard';
import { ZameraniComparisonCard } from './ZameraniComparisonCard';
import { topHardestUpcoming, zameraniInsights } from './insights';
import { useOpenSemesters } from './useOpenSemesters';
import { useZameraniPicks } from './useZameraniPicks';
import { useSubjectsData } from './useSubjectsData';
import { getSemesterState, isZameraniCode } from './utils';

interface StudyPlanPageProps {
  onBack: () => void;
  /**
   * The phone hides it: search is a header action on every tab there, so the
   * page's own SearchBar is a second, narrower search for the same job — and on
   * an iPad it raises a keyboard over the plan the student opened it to read.
   * The desktop, whose only subject search this IS, keeps it. Defaults to shown
   * so no existing caller changes behaviour.
   */
  showSearch?: boolean;
  /**
   * Where "look this subject up" goes when there is no SearchBar to prefill.
   * Without it a fail-rate badge on a subject with no id would be a dead tap.
   */
  onSearchSubject?: (name: string) => void;
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
}

export function StudyPlanPage({
  onBack,
  onOpenSubject,
  showSearch = true,
  onSearchSubject: onSearchSubjectProp,
}: StudyPlanPageProps) {
  const { t } = useTranslation();
  const searchPrefillRef = useRef<((query: string) => void) | null>(null);
  const prefillSearch = useCallback((name: string) => {
    searchPrefillRef.current?.(name);
  }, []);
  const onSearchSubject = onSearchSubjectProp ?? prefillSearch;
  const plan = useStudyPlan();
  const successRates = useAppStore((s) => s.successRates);
  const { zameraniLookup, subjectSemesters, subjectToZameranis, zameraniProgress, failRates } =
    useSubjectsData(plan);
  const { openSemesters, currentSemesterRef, handleToggle } = useOpenSemesters(plan);
  const picks = useZameraniPicks();

  const hardest = useMemo(
    () => (plan ? topHardestUpcoming(plan, successRates, subjectSemesters, 5) : []),
    [plan, successRates, subjectSemesters]
  );
  const zameraniStats = useMemo(
    () => (plan ? zameraniInsights(plan, successRates) : []),
    [plan, successRates]
  );

  const header = (
    <div className="px-4 py-2.5 border-b border-base-300 shrink-0 flex flex-col gap-2 md:flex-row md:items-center">
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onBack}
          className="btn btn-ghost btn-sm btn-circle text-base-content/75"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h2 className="text-base font-semibold truncate" title={plan?.title}>
          {t('subjects.studyPlan')}
        </h2>
      </div>
      {showSearch && (
        <div className="w-full md:ml-auto md:w-[30rem] shrink-0">
          <SearchBar
            minimal
            subjectsOnly
            onOpenSubject={(code, name, id, faculty) =>
              onOpenSubject(code, name ?? code, id ?? '', faculty)
            }
            prefillRef={searchPrefillRef}
          />
        </div>
      )}
    </div>
  );

  if (!plan) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {header}
        <SubjectsPanelSkeleton />
      </div>
    );
  }

  const firstCurrentIdx = plan.blocks.findIndex((block) => getSemesterState(block) === 'current');

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {header}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 flex flex-col gap-2">
        {(hardest.length > 0 || zameraniStats.length >= 2) && (
          <div
            className={`grid gap-3 items-start ${
              hardest.length > 0 && zameraniStats.length >= 2
                ? 'grid-cols-1 md:grid-cols-2'
                : 'grid-cols-1'
            }`}
          >
            <HardestUpcomingCard
              entries={hardest}
              onOpenSubject={onOpenSubject}
              onSearchSubject={onSearchSubject}
            />
            <ZameraniComparisonCard
              insights={zameraniStats}
              picks={picks.effectivePicks}
              onTogglePick={picks.togglePick}
              minRequired={plan.zameraniMinimum}
              subjectSemesters={subjectSemesters}
              onOpenSubject={onOpenSubject}
              onSearchSubject={onSearchSubject}
            />
          </div>
        )}
        {plan.blocks.map((block, bi) => {
          const hasSubjects = block.groups
            .flatMap((g) => g.subjects)
            .some((s) => !isZameraniCode(s.code));
          return (
            <div key={bi} ref={bi === firstCurrentIdx ? currentSemesterRef : undefined}>
              <SemesterSection
                block={block}
                open={openSemesters.has(bi)}
                dimmed={hasSubjects && openSemesters.size > 0 && !openSemesters.has(bi)}
                failRates={failRates}
                zameraniLookup={zameraniLookup}
                zameraniProgress={zameraniProgress}
                subjectSemesters={subjectSemesters}
                subjectToZameranis={subjectToZameranis}
                pickedZameranis={picks.effectivePicks}
                onToggle={() => handleToggle(bi)}
                onOpenSubject={onOpenSubject}
                onSearchSubject={onSearchSubject}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
