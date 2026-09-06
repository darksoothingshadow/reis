import { useState } from 'react';
import { ChevronDown, Info, Trophy } from 'lucide-react';
import type { StudyStats, StudyComparison } from '@/types/studyPlan';
import { percentileStanding } from '@/api/studyComparison';
import { useTranslation } from '@/hooks/useTranslation';

interface Props {
  studyStats: StudyStats | null;
  comparison?: StudyComparison | null;
}

// IS Mendelu grade averages use a Czech decimal comma (lower is better).
function formatGpa(value: number): string {
  if (value <= 0) return '–'; // en-dash when the average isn't available yet
  return value.toFixed(2).replace('.', ',');
}

function formatPct(value: number): string {
  return value.toFixed(2).replace('.', ',');
}

function Row({ label, value, info }: { label: string; value: string; info?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-base-content/75 shrink-0 flex items-center gap-1">
        {label}
        {info && (
          <span className="tooltip tooltip-right flex" data-tip={info}>
            <Info className="w-3.5 h-3.5 text-base-content/70" />
          </span>
        )}
      </span>
      <span className="flex-1 border-b border-dotted border-base-content/25" />
      <span className="font-normal tabular-nums text-base-content/80 shrink-0">{value}</span>
    </div>
  );
}

export function StudyAveragesSection({ studyStats, comparison }: Props) {
  const { t } = useTranslation();
  // Expanded by default (no information lost for anyone who hasn't touched
  // it) — collapsing is an opt-out, not the default state.
  const [expanded, setExpanded] = useState(true);
  if (!studyStats) return null;

  const period = studyStats.currentSemester.gpa;
  const total = studyStats.gpaTotal;
  const weighted = studyStats.weightedGpaTotal;
  const hasAverages = ![period, total, weighted].every((v) => v <= 0);

  // Nothing to show for students with no graded subjects and no ranking yet.
  if (!hasAverages && !comparison) return null;

  const standing = comparison ? percentileStanding(comparison.percentile) : null;
  const sentence = standing
    ? standing.tier === 'top'
      ? t('subjects.comparison.top', { pct: formatPct(standing.pct) })
      : t('subjects.comparison.beat', { pct: formatPct(standing.pct) })
    : null;

  return (
    <div className="max-w-xl mx-auto bg-base-200 border border-base-300 rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="w-full flex items-center gap-2 px-4 py-2 hover:bg-base-200/40 transition-colors"
      >
        <span className="text-xs text-base-content/70 font-medium uppercase tracking-wider">
          {t('subjects.averages.title')}
        </span>
        {!expanded && hasAverages && (
          <span className="text-xs font-normal tabular-nums text-base-content/75">
            {formatGpa(period)}
          </span>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 text-base-content/70 ml-auto transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-2.5 pt-0.5 flex flex-col gap-2 border-t border-base-300/30 animate-in fade-in slide-in-from-top-1 duration-150">
          {hasAverages && (
            <>
              <Row label={t('subjects.averages.term')} value={formatGpa(period)} />
              <Row label={t('subjects.averages.study')} value={formatGpa(total)} />
              <Row
                label={t('subjects.averages.weightedShort')}
                value={formatGpa(weighted)}
                info={t('subjects.averages.weightedInfo')}
              />
            </>
          )}
          {comparison && standing && (
            <div
              className={`flex items-center flex-wrap gap-x-3 gap-y-1 ${hasAverages ? 'mt-1 pt-2 border-t border-base-300/30' : ''}`}
            >
              <span
                className={`flex items-center gap-2 text-sm font-medium ${standing.tier === 'top' ? 'text-success' : 'text-base-content/70'}`}
              >
                <Trophy className="w-4 h-4 shrink-0" />
                {sentence}
              </span>
              <span className="ml-auto flex items-baseline gap-1.5 shrink-0">
                <span className="text-xs text-base-content/70 font-medium uppercase tracking-wider">
                  {t('subjects.comparison.rank')}
                </span>
                <span className="text-sm font-normal tabular-nums text-base-content/80">
                  {comparison.rank}. / {comparison.total}
                </span>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
