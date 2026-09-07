import { useMemo, useState } from 'react';
import { ChevronRight, Info } from 'lucide-react';
import { useStudyPlan } from '@/hooks/useStudyPlan';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';
import { SubjectsPanelHeader } from './SubjectsPanelHeader';
import { SubjectsPanelSkeleton } from './SubjectsPanelSkeleton';
import { EnrolledNowSection } from './EnrolledNowSection';
import { StudyAveragesSection } from './StudyAveragesSection';
import { useSubjectsData } from './useSubjectsData';
import { buildFallbackPlan } from './buildFallbackPlan';

interface SubjectsPanelProps {
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
  onOpenStudyPlan: () => void;
}

export function SubjectsPanel({
  onOpenSubject,
  onSearchSubject,
  onOpenStudyPlan,
}: SubjectsPanelProps) {
  const { t } = useTranslation();
  const plan = useStudyPlan();
  const studyPlanLoaded = useAppStore((s) => s.studyPlanLoaded);
  const studyStats = useAppStore((s) => s.studyStats);
  const studyComparison = useAppStore((s) => s.studyComparison);
  const subjects = useAppStore((s) => s.subjects);
  const language = useAppStore((s) => s.language);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);

  // Erasmus/exchange students have no KontrolaPlanu, so the plan never
  // materializes — fall back to the subjects store (student/list.pl).
  const planUsable = !!plan && plan.blocks.some((b) => b.groups.some((g) => g.subjects.length > 0));
  // The fallback must wait until the plan has actually settled (loaded, handshake
  // resolved, not mid-sync) — otherwise regular students see the exchange caption
  // flash during cold load, since the subjects store (Tier 1) populates before the
  // study plan (Tier 2 microtask). Latch: background resyncs flip isSyncing every
  // few minutes; once settled once, later isSyncing:true phases must not collapse
  // the fallback back to a skeleton mid-session for Erasmus students.
  const planSettled = studyPlanLoaded && (handshakeDone || handshakeTimedOut) && !isSyncing;
  const [settledOnce, setSettledOnce] = useState(false);
  if (planSettled && !settledOnce) setSettledOnce(true);
  const gateOpen = planSettled || settledOnce;
  const fallbackPlan = useMemo(() => {
    if (!gateOpen || planUsable || !subjects || Object.keys(subjects.data).length === 0)
      return null;
    return buildFallbackPlan(subjects, language === 'en' ? 'en' : 'cs');
  }, [gateOpen, planUsable, subjects, language]);

  const effectivePlan = planUsable ? plan : fallbackPlan;
  const { subjectSemesters, subjectToZameranis, zameraniProgress, failRates, enrolledCredits } =
    useSubjectsData(effectivePlan);

  if (!effectivePlan) {
    if (!studyPlanLoaded || (!handshakeDone && !handshakeTimedOut) || isSyncing)
      return <SubjectsPanelSkeleton />;
    return (
      <div className="flex items-center justify-center h-full text-base-content/70">
        {t('subjects.noData')}
      </div>
    );
  }

  if (!planUsable) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="px-4 pt-4 pb-0 shrink-0">
          <div className="flex items-start gap-2 text-xs text-base-content/70 pb-3">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{t('subjects.noPlanExchange')}</span>
          </div>
          <EnrolledNowSection
            plan={effectivePlan}
            failRates={failRates}
            onOpenSubject={onOpenSubject}
            onSearchSubject={onSearchSubject}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <SubjectsPanelHeader
        creditsAcquired={effectivePlan.creditsAcquired}
        creditsRequired={effectivePlan.creditsRequired}
        studyStats={studyStats}
        plan={effectivePlan}
        zameraniProgress={zameraniProgress}
        enrolledCredits={enrolledCredits}
      />

      <div className="px-4 pt-3 pb-0 shrink-0">
        <EnrolledNowSection
          plan={effectivePlan}
          failRates={failRates}
          subjectSemesters={subjectSemesters}
          subjectToZameranis={subjectToZameranis}
          onOpenSubject={onOpenSubject}
          onSearchSubject={onSearchSubject}
        />
        <div className="mt-3">
          <StudyAveragesSection studyStats={studyStats} comparison={studyComparison} />
        </div>
      </div>

      <div className="px-4 pt-3 pb-4 shrink-0">
        <button
          onClick={onOpenStudyPlan}
          className="max-w-xl mx-auto w-full flex items-center justify-between gap-2 px-4 py-2 rounded-xl border border-base-300 bg-base-200 hover:bg-base-300 transition-colors text-sm text-base-content/70 font-medium"
        >
          <span>{t('subjects.studyPlan')}</span>
          <ChevronRight className="w-4 h-4 text-base-content/70" />
        </button>
      </div>
    </div>
  );
}
