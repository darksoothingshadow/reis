import { ChevronDown, CheckCircle2, BookOpen, Clock, Layers } from 'lucide-react';
import type { SemesterBlock, Zamerani, SubjectStatus } from '@/types/studyPlan';
import { useTranslation } from '@/hooks/useTranslation';
import type { ZameraniProgress } from './SubjectsPanelHeader';
import { SubjectRow } from './SubjectRow';
import {
  getSemesterState,
  isRealCredits,
  isZameraniCode,
  normalizeZameraniName,
  type SemesterState,
  cleanGroupName,
  shortenStatusText,
} from './utils';

interface SemesterSectionProps {
  block: SemesterBlock;
  open: boolean;
  dimmed?: boolean;
  failRates?: Record<string, number | null>;
  zameraniLookup?: Map<string, Zamerani>;
  zameraniProgress?: Map<string, ZameraniProgress>;
  subjectSemesters?: Map<string, string[]>;
  subjectToZameranis?: Map<string, string[]>;
  pickedZameranis?: Set<string>;
  onToggle: () => void;
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
}

// A subject is "always visible" if it's not affiliated with any zaměření
// (mandatory / general elective). Affiliated subjects show only when at least
// one of their zaměření is picked. Hides the noise of unchosen zaměření paths.
function isSubjectVisible(
  s: SubjectStatus,
  subjectToZameranis?: Map<string, string[]>,
  picked?: Set<string>
): boolean {
  if (isZameraniCode(s.code)) return false;
  const memberOf = subjectToZameranis?.get(s.code);
  if (!memberOf || memberOf.length === 0) return true;
  if (!picked || picked.size === 0) return false;
  return memberOf.some((z) => picked.has(z));
}

const stateConfig: Record<
  SemesterState,
  {
    icon: typeof CheckCircle2;
    border: string;
    accent: string;
    indicator: string;
    badgeCls: string;
  }
> = {
  past: {
    icon: CheckCircle2,
    border: 'border-success/20',
    accent: 'text-success',
    indicator: 'bg-success',
    badgeCls:
      'bg-success/35 text-base-content border border-success/50 font-medium px-2 py-0.5 rounded text-[11px]',
  },
  current: {
    icon: BookOpen,
    border: 'border-primary/30',
    accent: 'text-primary',
    indicator: 'bg-primary',
    badgeCls:
      'bg-primary/35 text-base-content border border-primary/50 font-medium px-2 py-0.5 rounded text-[11px]',
  },
  future: {
    icon: Clock,
    border: 'border-base-300',
    accent: 'text-base-content/70',
    indicator: 'bg-base-content/20',
    badgeCls: 'bg-base-content/5 text-base-content/70 font-medium px-2 py-0.5 rounded text-[11px]',
  },
};

export function SemesterSection({
  block,
  open,
  dimmed,
  failRates,
  zameraniLookup,
  zameraniProgress,
  subjectSemesters,
  subjectToZameranis,
  pickedZameranis,
  onToggle,
  onOpenSubject,
  onSearchSubject,
}: SemesterSectionProps) {
  const { t } = useTranslation();
  const state = getSemesterState(block);
  const cfg = stateConfig[state];

  const titleMatch = block.title.match(/^(\d+\.\s*semestr)/i);
  const cleanTitle = titleMatch
    ? titleMatch[1]
    : block.title.replace(/\s*\(dosud neaktivní\)/gi, '');

  const allSubjects = block.groups
    .flatMap((g) => g.subjects)
    .filter((s) => isSubjectVisible(s, subjectToZameranis, pickedZameranis));
  const fulfilledCount = allSubjects.filter((s) => s.isFulfilled).length;
  const totalCount = allSubjects.length;
  const totalCredits = allSubjects
    .filter((s) => isRealCredits(s.credits))
    .reduce((a, s) => a + s.credits, 0);
  const isPast = state === 'past';

  const visibleByGroup = block.groups.map((g) =>
    [...g.subjects]
      .filter((s) => isSubjectVisible(s, subjectToZameranis, pickedZameranis))
      .sort((a, b) => {
        if (a.isFulfilled !== b.isFulfilled) return a.isFulfilled ? 1 : -1;
        const fa = failRates?.[a.code] ?? -1;
        const fb = failRates?.[b.code] ?? -1;
        return fb - fa;
      })
  );

  // A group needs the "pick a zaměření" prompt iff it has zaměření-affiliated
  // subjects, none of those zaměření are currently picked, and the visible list
  // is therefore empty. Pure mandatory groups stay hidden when empty.
  const groupNeedsPrompt = (group: SemesterBlock['groups'][number]): boolean => {
    if (!subjectToZameranis || !pickedZameranis) return false;
    return group.subjects.some((s) => (subjectToZameranis.get(s.code)?.length ?? 0) > 0);
  };

  return (
    <div
      className={`rounded-lg border overflow-hidden transition-all ${open ? 'border-base-content/20 bg-base-100 shadow-sm' : `${cfg.border} ${state === 'current' ? 'bg-primary/12 ring-1 ring-primary/15' : ''}`} ${dimmed ? 'opacity-40' : ''} ${block.isWholePlanPool ? 'border-dashed' : ''}`}
    >
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${open ? 'bg-base-200' : 'hover:bg-base-200'}`}
      >
        <div className={`w-1 h-8 rounded-full ${cfg.indicator} shrink-0`} />
        <span className="text-sm font-semibold flex-1 text-left">{cleanTitle}</span>
        {totalCredits > 0 && (state !== 'future' || open) && (
          <span className="text-[11px] text-base-content/70 shrink-0">
            {totalCredits}
            <span className="hidden md:inline"> kr.</span>
          </span>
        )}
        <span className={cfg.badgeCls}>
          {fulfilledCount}/{totalCount}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-base-content/70 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-2 pb-2 animate-in fade-in slide-in-from-top-1 duration-150">
          {block.groups.map((group, gi) => {
            const visible = visibleByGroup[gi];
            const showPickPrompt = visible.length === 0 && groupNeedsPrompt(group);
            if (visible.length === 0 && !showPickPrompt) return null;
            const statusText = (group.statusDescription || '').trim();
            const statusIsFulfilled =
              /^SPLN[ĚE]N/i.test(statusText) || /^FULFILLED/i.test(statusText);
            const statusCls = statusIsFulfilled
              ? 'text-success/70'
              : statusText
                ? 'text-error/70'
                : 'text-base-content/70';
            // Live progress derived from subjects — independent of the server's statusDescription.
            const fulfilledInGroup = group.subjects.filter((s) => s.isFulfilled).length;
            const liveProgress =
              group.minCount !== undefined
                ? `${Math.min(fulfilledInGroup, group.minCount)}/${group.minCount}`
                : null;
            const displayGroupName = cleanGroupName(group.name);

            return (
              <div
                key={gi}
                className={`${gi > 0 ? 'mt-3' : ''} bg-base-200/30 border border-base-300/50 rounded-xl shadow-sm overflow-hidden`}
              >
                {(block.groups.length > 1 || statusText) && (
                  <div className="px-3 py-1.5 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 border-b border-base-300/30">
                    <span
                      className="text-[11px] text-base-content/70 font-medium uppercase tracking-wider truncate max-w-[65%] md:max-w-none"
                      title={group.name}
                    >
                      {displayGroupName}
                    </span>
                    <span className="flex items-center gap-2 shrink-0 ml-auto">
                      {liveProgress && (
                        <span className="text-[10px] font-mono text-base-content/70">
                          {liveProgress}
                        </span>
                      )}
                      {statusText && (
                        <span className={`text-[11px] font-medium ${statusCls}`}>
                          <span className="md:hidden">{shortenStatusText(statusText)}</span>
                          <span className="hidden md:inline">{statusText}</span>
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {showPickPrompt ? (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-base-300 text-[11px] text-base-content/70">
                    <Layers className="w-3.5 h-3.5 text-primary/60 shrink-0" />
                    <span>{t('subjects.zameraniPickPrompt')}</span>
                  </div>
                ) : (
                  <div className="p-2 flex flex-col gap-0.5">
                    {visible.map((s) => (
                      <SubjectRow
                        key={s.code}
                        subject={s}
                        compact={isPast}
                        hideTypeWhenGraded
                        failRate={failRates?.[s.code]}
                        failRates={failRates}
                        zamerani={zameraniLookup?.get(normalizeZameraniName(s.name)) ?? null}
                        zameraniProgress={
                          zameraniProgress?.get(normalizeZameraniName(s.name)) ?? null
                        }
                        subjectSemesters={subjectSemesters}
                        subjectToZameranis={subjectToZameranis}
                        onOpenSubject={onOpenSubject}
                        onSearchSubject={onSearchSubject}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
