import { Search, CheckCircle2, AlertTriangle, Timer, Layers, XCircle } from 'lucide-react';
import type { SubjectStatus, Zamerani } from '@/types/studyPlan';
import type { ZameraniProgress } from './SubjectsPanelHeader';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import { useTimeline } from '@/hooks/useTimeline';
import { useSpeculativeHover } from '@/hooks/data/useSpeculativeHover';
import { useCourseGrade } from '@/hooks/data/useCourseGrade';
import { gradeBadge } from '@/utils/gradeLookup';
import { useAppStore } from '@/store/useAppStore';
import { isZameraniCode } from './utils';
import { resolvePredmetId } from './resolvePredmetId';
import { failRateTone, failRateToneHover } from './failRateTone';

interface SubjectRowProps {
  subject: SubjectStatus;
  compact?: boolean;
  failRate?: number | null;
  failRates?: Record<string, number | null>;
  onOpenSubject: (
    courseCode: string,
    courseName: string,
    courseId: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  onSearchSubject: (name: string) => void;
  hideStatus?: boolean;
  /** In the study plan, hide the completion type (zk/záp/zak) on subjects that already have a successful grade. */
  hideTypeWhenGraded?: boolean;
  zamerani?: Zamerani | null;
  zameraniProgress?: ZameraniProgress | null;
  subjectSemesters?: Map<string, string[]>;
  subjectToZameranis?: Map<string, string[]>;
}

function zameraniAcronym(norm: string): string {
  return norm
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

// IS Mendelu uses 999 as a sentinel "credits unknown / pass-through" value.
const isSentinelCredits = (credits: number) => credits >= 999;

export function SubjectRow({
  subject,
  compact,
  failRate,
  failRates,
  hideStatus,
  hideTypeWhenGraded,
  onOpenSubject,
  onSearchSubject,
  zamerani,
  zameraniProgress,
  subjectSemesters,
  subjectToZameranis,
}: SubjectRowProps) {
  const { t } = useTranslation();
  // Not-enrolled subjects have no IS id from the plan, but the success-rate data we
  // already fetch carries the subject's `predmet` id — use it (when valid) so the row
  // opens the SubjectDrawer directly instead of falling back to search.
  const successRate = useAppStore((s) => s.successRates[subject.code]);
  const resolvedId = subject.id || resolvePredmetId(successRate) || '';
  const hasId = resolvedId !== '';
  const displayName = useCourseName(subject.code, subject.name);
  const timeline = useTimeline(subject.code);
  const isZamerani = isZameraniCode(subject.code);
  const showCredits = !isSentinelCredits(subject.credits) && !isZamerani;
  const typeLabel = subject.type?.trim();
  const zameraniMembership = subjectToZameranis?.get(subject.code);
  const zameraniTag = zameraniMembership?.length ? zameraniAcronym(zameraniMembership[0]) : null;

  const hover = useSpeculativeHover(subject.code, !isZamerani && hasId);
  const grade = useCourseGrade(resolvedId, subject.code);
  const badge = gradeBadge(grade);
  // A failing grade on a still-enrolled subject is unresolved, not a dead end — surface
  // which attempt this was (fact from IS, not a computed "attempts remaining" guess).
  const isUnresolvedFail =
    badge?.kind === 'letter' && !badge.passed && subject.isEnrolled && !subject.isFulfilled;
  const attemptNumber = isUnresolvedFail ? (grade?.attempt ?? null) : null;
  const badgeEl = badge ? (
    <span className="flex items-baseline gap-1 shrink-0">
      <span
        className={`text-sm font-mono font-medium ${badge.kind === 'letter' && !badge.passed ? 'text-error' : 'text-success/60'}`}
        title={grade?.gradeText}
      >
        {badge.kind === 'letter'
          ? badge.text
          : badge.kind === 'credited'
            ? t('subjects.grade.credited')
            : t('subjects.grade.completed')}
      </span>
      {attemptNumber != null && (
        <span className="text-[10px] text-error/60 font-normal">
          {t('subjects.grade.attempt', { n: attemptNumber })}
        </span>
      )}
    </span>
  ) : null;
  // A subject counts as "successfully graded" for a passing letter (A–E) or a záp/zak completion.
  const hasSuccessGrade = !!badge && (badge.kind !== 'letter' || badge.passed);
  const typeEl =
    typeLabel && !(hideTypeWhenGraded && hasSuccessGrade) ? (
      <span className="hidden md:inline text-[10px] font-mono uppercase text-base-content/70 shrink-0">
        {typeLabel}
      </span>
    ) : null;

  const handleClick = () => {
    if (isZamerani) return; // pseudo-row, not openable
    if (hasId) {
      onOpenSubject(
        subject.code,
        subject.name,
        resolvedId,
        undefined,
        undefined,
        subject.isFulfilled
      );
    } else {
      onSearchSubject(displayName);
    }
  };

  if (compact) {
    const isUnfulfilled = !subject.isFulfilled;
    return (
      <div className="flex flex-col">
        <button
          onClick={handleClick}
          onMouseEnter={hover.onMouseEnter}
          onMouseLeave={hover.onMouseLeave}
          className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-base-300 transition-colors text-left ${isUnfulfilled ? 'text-error' : 'text-base-content/70'}`}
        >
          <span className="flex-1 text-sm font-medium truncate">{displayName}</span>
          {timeline && (
            <span className="text-[9px] font-bold text-[var(--tone-primary)] shrink-0">
              {timeline.formatted}
            </span>
          )}
          {badgeEl}
          {typeEl}
          {showCredits && (
            <span className="hidden md:inline text-xs text-base-content/70 shrink-0">
              {subject.credits} kr.
            </span>
          )}
          <span className="flex items-center gap-1 shrink-0">
            {subject.isFulfilled ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-success/50" />
                {subject.fulfillmentDate && (
                  <span className="text-[11px] text-base-content/70 font-mono font-medium">
                    {subject.fulfillmentDate}
                  </span>
                )}
              </>
            ) : (
              <XCircle className="w-3 h-3 text-error/50" />
            )}
          </span>
        </button>
      </div>
    );
  }

  if (isZamerani) {
    const progressLabel = zameraniProgress
      ? `${zameraniProgress.fulfilled}/${zameraniProgress.total}` +
        (zameraniProgress.enrolled > 0 ? ` (+${zameraniProgress.enrolled})` : '')
      : null;
    return (
      <div className="w-full flex flex-col gap-1.5 px-3 py-2.5 rounded-lg bg-base-200/30 border border-dashed border-base-300 text-left">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-base-content/70 shrink-0" />
          <span className="text-sm font-medium truncate flex-1">{displayName}</span>
          {progressLabel && (
            <span className="text-[10px] font-mono text-base-content/75 shrink-0">
              {progressLabel}
            </span>
          )}
          <span className="badge badge-sm badge-ghost text-[10px]">{t('subjects.zamerani')}</span>
        </div>
        {zamerani?.description && (
          <p className="pl-5 text-[11px] text-base-content/75 leading-snug line-clamp-3">
            {zamerani.description}
          </p>
        )}
        {zamerani && zamerani.subjects.length > 0 && (
          <div className="pl-5 flex flex-col gap-0.5">
            <div className="text-[10px] uppercase tracking-wider text-base-content/70">
              {t('subjects.zameraniMembers')}
            </div>
            {[...zamerani.subjects]
              .sort((a, b) => {
                const sa = subjectSemesters?.get(a.code)?.[0] ?? '999';
                const sb = subjectSemesters?.get(b.code)?.[0] ?? '999';
                return Number(sa) - Number(sb);
              })
              .map((s) => {
                const sems = subjectSemesters?.get(s.code);
                const rate = failRates?.[s.code] ?? null;
                return (
                  <button
                    key={s.code}
                    onClick={() => onSearchSubject(s.code)}
                    className="text-[11px] text-base-content/75 flex items-center gap-1.5 min-w-0 w-full text-left rounded hover:bg-base-200 px-1 -mx-1 transition-colors"
                  >
                    <span className="font-mono text-base-content/70 shrink-0">{s.code}</span>
                    {s.name !== s.code && <span className="truncate"> — {s.name}</span>}
                    <span className="flex items-center gap-1.5 shrink-0 ml-auto">
                      {rate != null && (
                        <span
                          className={`flex items-center justify-center h-4 px-1 rounded text-[10px] font-medium tracking-wide ${failRateTone(rate)}`}
                        >
                          {rate}%
                        </span>
                      )}
                      {sems &&
                        sems.map((n) => (
                          <span
                            key={n}
                            className="text-[10px] text-base-content/70 font-medium whitespace-nowrap"
                          >
                            {n}. {t('subjects.semesterShort')}
                          </span>
                        ))}
                    </span>
                  </button>
                );
              })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <button
        onClick={handleClick}
        onMouseEnter={hover.onMouseEnter}
        onMouseLeave={hover.onMouseLeave}
        className="w-full flex items-center gap-1.5 md:gap-3 px-2 md:px-3 py-2 md:py-2.5 rounded-lg hover:bg-base-300 transition-colors text-left group"
      >
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-sm truncate font-medium">{displayName}</span>
          {timeline && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-[var(--tone-primary)] mt-0.5">
              <Timer size={10} />
              <span>{timeline.formatted}</span>
            </div>
          )}
        </div>
        {badgeEl}
        {typeEl}
        {failRate != null && !subject.isFulfilled && !badge && (
          <span
            className={`group/fail flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-medium tracking-wide shrink-0 cursor-pointer transition-colors ${failRateTone(
              failRate
            )} ${failRateToneHover(failRate)}`}
            onClick={(e) => {
              e.stopPropagation();
              if (hasId) onOpenSubject(subject.code, subject.name, resolvedId, undefined, 'stats');
              else onSearchSubject(displayName);
            }}
          >
            {/* Always shown, never hover-revealed. The label used to be
              max-w-0/opacity-0 until :hover, which on a touch screen means
              never — the iPad showed a bare colour-coded number with nothing
              to say it was a failure rate. */}
            <span className="mr-1 whitespace-nowrap">{t('subjects.failRateLabel')}</span>
            {failRate}%
          </span>
        )}
        {zameraniTag && (
          <span className="text-[9px] font-mono tracking-widest text-[var(--tone-primary)] bg-primary/8 px-1.5 py-0.5 rounded shrink-0">
            {zameraniTag}
          </span>
        )}
        {showCredits && (
          <span className="hidden md:inline text-xs text-base-content/70 shrink-0">
            {subject.credits} kr.
          </span>
        )}
        {subject.isFulfilled && subject.fulfillmentDate ? (
          <span className="flex items-center gap-1.5 text-[11px] shrink-0">
            <CheckCircle2 className="w-4 h-4 text-success/50" />
            <span className="font-mono font-medium text-base-content/70">
              {subject.fulfillmentDate}
            </span>
          </span>
        ) : subject.isFulfilled ? (
          <CheckCircle2 className="w-4 h-4 text-success/50 shrink-0" />
        ) : null}
        {subject.enrollmentCount >= 2 && !subject.isFulfilled && (
          <span
            className="badge badge-sm badge-error gap-1 shrink-0"
            title={t('subjects.repeatWarning')}
          >
            <AlertTriangle className="w-3 h-3" />
            {subject.enrollmentCount}x
          </span>
        )}
        {!hideStatus &&
          !subject.isFulfilled &&
          (subject.isEnrolled ? (
            <span className="badge badge-sm badge-primary badge-outline shrink-0">
              {subject.rawStatusText}
            </span>
          ) : !hasId ? (
            <span className="badge badge-sm md:badge-ghost gap-1 text-base-content/70 bg-transparent border-none p-0 md:bg-base-content/5 md:px-2 shrink-0">
              <Search className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{t('subjects.searchToOpen')}</span>
            </span>
          ) : (
            <span className="badge badge-sm badge-ghost text-base-content/70 hidden md:inline-flex shrink-0">
              {subject.rawStatusText || t('subjects.notFulfilled')}
            </span>
          ))}
      </button>
    </div>
  );
}
