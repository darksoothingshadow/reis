import { useState, useEffect, useMemo } from 'react';
import { ExamSectionCard } from './ExamSectionCard';
import { ConfirmationModal } from './ConfirmationModal';
import { EmptyExamsState } from './EmptyExamsState';
import type { ExamSubject, ExamSection } from '../../types/exams';
import { useExamActions } from './useExamActions';
import { useExamsData } from './useExamsData';
import ExamTimeline from '../Exams/Timeline/ExamTimeline';
import type { TimelineExam } from '../Exams/Timeline/ExamTimeline';
import { useAutoRegistration } from './useAutoRegistration';
import { Zap, ExternalLink } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useUserParams } from '../../hooks/useUserParams';
import { useAppStore } from '../../store/useAppStore';
import { ExamsFreshness } from './ExamsFreshness';

interface RegisteredExam extends TimelineExam {
  subject: ExamSubject;
  section: ExamSection;
  term: { id: string; date: string; time: string; room: string };
}

function PanelTopBar({ href }: { href: string }) {
  return (
    <div className="flex items-center justify-between border-b border-base-300 px-2">
      <ExamsFreshness />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-ghost btn-sm gap-2 text-base-content/70 hover:text-primary normal-case font-bold"
      >
        <span>IS MENDELU</span>
        <ExternalLink size={16} />
      </a>
    </div>
  );
}

export function ExamPanel() {
  const { t, language } = useTranslation();
  const { params } = useUserParams();
  const { exams, showSkeleton, sections } = useExamsData();
  const studium = params?.studium || '';
  const obdobi = params?.obdobi || '';
  const href =
    studium && obdobi
      ? `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${studium};obdobi=${obdobi};lang=${language}`
      : `https://is.mendelu.cz/auth/student/prihlasovani_zkousky.pl?lang=${language}`;
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [timelineSelectedId, setTimelineSelectedId] = useState<string | null>(null);
  const {
    processingSectionId,
    pendingAction,
    setPendingAction,
    handleRegisterRequest,
    handleUnregisterRequest,
    handleConfirmAction,
  } = useExamActions({ exams, setExpandedSectionId: setExpandedId });

  const handleTimelineSelect = (item: TimelineExam) => {
    const sectionId = item.section?.id;
    if (!sectionId) return;
    const next = timelineSelectedId === sectionId ? null : sectionId;
    setTimelineSelectedId(next);
    setExpandedId(next);
  };

  const handleToggleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    if (next === null) setTimelineSelectedId(null);
  };
  const { armedTerms, firingTerms, toggleArm } = useAutoRegistration();

  // Extract registered exams from data
  const realExams = useMemo(() => {
    const registered: RegisteredExam[] = [];

    exams.forEach((sub: ExamSubject) => {
      sub.sections.forEach((sec: ExamSection) => {
        if (sec.status === 'registered' && sec.registeredTerm) {
          const subjectName = language === 'en' && sub.nameEn ? sub.nameEn : sub.nameCs || sub.name;
          registered.push({
            subjectName,
            subject: sub,
            section: sec,
            term: {
              id: sec.registeredTerm.id || `${sub.code}-${sec.id}`,
              date: sec.registeredTerm.date,
              time: sec.registeredTerm.time,
              room:
                (language === 'en' && sec.registeredTerm.roomEn
                  ? sec.registeredTerm.roomEn
                  : sec.registeredTerm.roomCs || sec.registeredTerm.room) || '',
            },
          });
        }
      });
    });
    return registered;
  }, [exams, language]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"]') && expandedId)
        setExpandedId(null);
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [expandedId]);

  // When the timeline-selected section disappears from realExams (e.g. user
  // deregistered it, sync dropped it, language switch reshuffles ids), clear
  // the selection so the render falls through to the regular sections view
  // instead of returning null (which would blank the entire panel).
  useEffect(() => {
    if (timelineSelectedId && !realExams.some((e) => e.section.id === timelineSelectedId)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTimelineSelectedId(null);
    }
  }, [timelineSelectedId, realExams]);

  useEffect(() => {
    const trigger = useAppStore.getState().triggerExamsRefresh;
    trigger();
    const onVisible = () => {
      if (document.visibilityState === 'visible') trigger();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  const topTimeline =
    realExams.length > 0 ? (
      <div>
        <ExamTimeline
          exams={realExams}
          orientation="horizontal"
          onSelectItem={handleTimelineSelect}
          selectedSectionId={timelineSelectedId}
        />
      </div>
    ) : null;

  return (
    <>
      <div className="flex flex-col h-full bg-base-100 rounded-lg border border-base-300 overflow-hidden relative">
        {armedTerms.size > 0 && (
          <div className="bg-warning/10 border-b border-warning/20 px-4 py-2.5 flex flex-wrap items-center justify-center gap-2">
            <Zap size={16} className="text-warning animate-pulse shrink-0" />
            <span className="text-xs font-semibold text-warning-content/80 text-center">
              {t('exams.autoRegWarning')}
            </span>
          </div>
        )}

        {!showSkeleton && <PanelTopBar href={href} />}

        {showSkeleton ? (
          <div className="flex items-center justify-center h-32 opacity-50">
            <span className="loading loading-spinner mr-2" /> {t('exams.loading')}
          </div>
        ) : exams.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center">
            <EmptyExamsState />
          </div>
        ) : timelineSelectedId ? (
          (() => {
            const picked = realExams.find((e) => e.section.id === timelineSelectedId);
            return picked ? (
              <>
                {topTimeline}
                <div className="flex-1 overflow-y-auto p-4">
                  <ExamSectionCard
                    subject={picked.subject}
                    section={picked.section}
                    isExpanded={true}
                    isProcessing={processingSectionId === picked.section.id}
                    armedTerms={armedTerms}
                    firingTerms={firingTerms}
                    toggleArm={toggleArm}
                    onToggleExpand={handleToggleExpand}
                    onRegister={handleRegisterRequest}
                    onUnregister={handleUnregisterRequest}
                  />
                </div>
              </>
            ) : null;
          })()
        ) : sections.length > 0 ? (
          <>
            {topTimeline}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {sections.map(
                ({ subject, section }: { subject: ExamSubject; section: ExamSection }) => (
                  <ExamSectionCard
                    key={section.id}
                    subject={subject}
                    section={section}
                    isExpanded={expandedId === section.id}
                    isProcessing={processingSectionId === section.id}
                    armedTerms={armedTerms}
                    firingTerms={firingTerms}
                    toggleArm={toggleArm}
                    onToggleExpand={handleToggleExpand}
                    onRegister={handleRegisterRequest}
                    onUnregister={handleUnregisterRequest}
                  />
                )
              )}
            </div>
          </>
        ) : realExams.length > 0 ? (
          <>
            {topTimeline}
            <div className="flex-1 flex flex-col items-center justify-center gap-1 px-4 text-center">
              <span className="text-sm font-medium text-base-content/60">
                {t('exams.noOpenRegistrations')}
              </span>
            </div>
          </>
        ) : null}
      </div>
      <ConfirmationModal
        isOpen={!!pendingAction}
        actionType={pendingAction?.type ?? 'register'}
        sectionName={pendingAction?.section.name ?? ''}
        termInfo={
          pendingAction?.type === 'register'
            ? pendingAction.section.terms.find((t) => t.id === pendingAction.termId)
            : pendingAction?.section.registeredTerm
        }
        onConfirm={handleConfirmAction}
        onCancel={() => setPendingAction(null)}
      />
    </>
  );
}
