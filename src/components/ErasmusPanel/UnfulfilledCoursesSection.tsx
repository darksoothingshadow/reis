import { useEffect, useMemo, useState } from 'react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { computeFailRate } from '@/components/SubjectsPanel/computeFailRate';
import { ErasmusSemesterSection } from './ErasmusSemesterSection';
import { isTransferableCourse } from './isTransferableCourse';
import { isCompulsoryGroup, isCoreElectiveGroup, isElectiveGroup } from '@/utils/studyPlanUtils';
import { Calendar } from 'lucide-react';
import type { SemesterBlock } from '@/types/studyPlan';

interface Props {
  selectedCodes: string[];
  onToggle: (code: string) => void;
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

export function UnfulfilledCoursesSection({
  selectedCodes,
  onToggle,
  onOpenSubject,
  onSearchSubject,
}: Props) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const loaded = useAppStore((s) => s.studyPlanLoaded);
  const successRates = useAppStore((s) => s.successRates);

  const [targetSemesterOverride, setTargetSemester] = useState<number | null>(null);

  const availableSemesters = useMemo(() => {
    if (!plan || !plan.blocks) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block }) => {
        if (block.isWholePlanPool || !block.groups) return false;
        return block.groups
          .filter(
            (g) =>
              isCompulsoryGroup(g.name, block.title) ||
              isCoreElectiveGroup(g.name) ||
              isElectiveGroup(g.name, block.title)
          )
          .flatMap((g) => g.subjects || [])
          .some((s) => !s.isFulfilled && !s.isEnrolled && isTransferableCourse(s));
      });
  }, [plan]);

  const targetSemester = targetSemesterOverride ?? availableSemesters[0]?.index ?? null;

  const futureSemesters = useMemo((): { block: SemesterBlock; index: number }[] => {
    if (!plan || !plan.blocks || targetSemester === null) return [];
    return plan.blocks
      .map((block, index) => ({ block, index }))
      .filter(({ block, index }) => {
        if (!block.isWholePlanPool && index < targetSemester) return false;
        const actionable = (block.groups || [])
          .filter(
            (g) =>
              isCompulsoryGroup(g.name, block.title) ||
              isCoreElectiveGroup(g.name) ||
              isElectiveGroup(g.name, block.title)
          )
          .flatMap((g) => g.subjects || [])
          .filter((s) => isTransferableCourse(s) && !s.isFulfilled && !s.isEnrolled);
        return actionable.length > 0;
      });
  }, [plan, targetSemester]);

  const toggleCourse = (code: string) => {
    const isAdding = !selectedCodes.includes(code);
    onToggle(code);
    if (isAdding) {
      const allSubjects = futureSemesters.flatMap(({ block }) =>
        (block.groups || []).flatMap((g) => g.subjects || [])
      );
      const subject = allSubjects.find((s) => s.code === code);
      if (subject?.id) useAppStore.getState().fetchSyllabus(subject.code, subject.id);
    }
  };

  const failRates = useMemo(() => {
    const map: Record<string, number | null> = {};
    for (const { block } of futureSemesters) {
      if (!block.groups) continue;
      const title = (block.title || '').toLowerCase();
      const isSummer = title.includes('letní') || title.includes('summer') || title.includes('ls');
      const isWinter = title.includes('zimní') || title.includes('winter') || title.includes('zs');
      const semesterType = isSummer ? 'LS' : isWinter ? 'ZS' : null;

      for (const group of block.groups) {
        if (
          isCompulsoryGroup(group.name, block.title) ||
          isCoreElectiveGroup(group.name) ||
          isElectiveGroup(group.name, block.title)
        ) {
          if (!group.subjects) continue;
          for (const s of group.subjects) {
            if (isTransferableCourse(s)) {
              map[s.code] = computeFailRate(successRates[s.code], semesterType);
            }
          }
        }
      }
    }
    return map;
  }, [futureSemesters, successRates]);

  useEffect(() => {
    if (futureSemesters.length === 0) return;
    const codes = futureSemesters.flatMap(({ block }) =>
      (block.groups || [])
        .filter(
          (g) =>
            isCompulsoryGroup(g.name, block.title) ||
            isCoreElectiveGroup(g.name) ||
            isElectiveGroup(g.name, block.title)
        )
        .flatMap((g) =>
          (g.subjects || []).filter((s) => isTransferableCourse(s)).map((s) => s.code)
        )
    );
    if (codes.length > 0) useAppStore.getState().fetchSuccessRateBatch(codes);
  }, [futureSemesters]);

  if (!loaded) {
    return (
      <div className="border border-base-300 rounded-lg px-3 py-2.5 mb-3">
        <span className="loading loading-spinner loading-xs" />
      </div>
    );
  }

  if (!plan || futureSemesters.length === 0) return null;

  const selectedSet = new Set(selectedCodes);

  return (
    <div className="flex flex-col gap-6">
      {/* Trip Window Selector */}
      {availableSemesters.length > 0 && (
        <div className="flex flex-col gap-2 px-1 mb-2">
          <div className="flex items-center gap-1.5 text-base-content/70">
            <Calendar size={14} />
            <span className="text-xs font-medium">{t('erasmus.tripWindow')}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {availableSemesters.map(({ index }) => (
              <button
                key={index}
                onClick={() => setTargetSemester(index)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors border ${
                  targetSemester === index
                    ? 'bg-primary border-primary text-primary-content'
                    : 'bg-transparent border-base-300 text-base-content/60 hover:bg-base-200'
                }`}
              >
                {t('erasmus.semesterLabel', { n: index + 1 })}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {futureSemesters.map(({ block, index }) => {
          const isPriority = index === targetSemester;
          return (
            <div key={index} className="flex flex-col gap-2">
              {isPriority && (
                <div className="badge badge-primary badge-outline text-[9px] font-bold uppercase tracking-widest ml-1">
                  {t('erasmus.replacementPriority')}
                </div>
              )}
              <ErasmusSemesterSection
                block={block}
                failRates={failRates}
                selectedCodes={selectedSet}
                onToggleCourse={toggleCourse}
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
