import { useState } from 'react';
import { ChevronDown, Layers, CheckSquare, Square } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import type { ZameraniInsight } from './insights';
import { normalizeZameraniName } from './utils';
import { failRateTone } from './failRateTone';

interface Props {
  insights: ZameraniInsight[];
  picks: Set<string>;
  onTogglePick: (normalizedName: string) => void;
  minRequired?: number;
  subjectSemesters?: Map<string, string[]>;
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

const NO_RATE = 'bg-base-content/5 text-base-content/70';

/** The shared bands, with the null case this card additionally has. */
function rateClass(rate: number | null): string {
  return rate == null ? NO_RATE : failRateTone(rate);
}

interface RowProps {
  insight: ZameraniInsight;
  open: boolean;
  picked: boolean;
  subjectSemesters?: Map<string, string[]>;
  onToggle: () => void;
  onTogglePick: () => void;
  onOpen: Props['onOpenSubject'];
  onSearch: Props['onSearchSubject'];
}

function ZameraniRow({
  insight,
  open,
  picked,
  subjectSemesters,
  onToggle,
  onTogglePick,
  onOpen,
  onSearch,
}: RowProps) {
  const { t } = useTranslation();
  const cleanName = insight.name
    .replace(/^zaměření:\s*/i, '')
    .replace(/^specialization:\s*/i, '')
    .replace(/^scope:\s*/i, '');
  const PickIcon = picked ? CheckSquare : Square;
  // Only offer the chevron when opening it would show something. `studyPlan.en`
  // arrives with every specialization empty — no subjects, no description —
  // and the row used to toggle, flip its arrow and reveal nothing at all.
  const hasDetail = Boolean(insight.description) || insight.subjects.length > 0;
  return (
    <div
      className={`rounded-md border overflow-hidden transition-colors ${picked ? 'border-primary/30 bg-primary/5' : 'border-base-300/60'}`}
    >
      <button
        onClick={hasDetail ? onToggle : undefined}
        aria-expanded={hasDetail ? open : undefined}
        className={`w-full flex items-center gap-2 pl-2 pr-3 py-2 text-left transition-colors ${
          hasDetail ? 'hover:bg-base-200' : 'cursor-default'
        }`}
      >
        <span
          onClick={(e) => {
            e.stopPropagation();
            onTogglePick();
          }}
          title={picked ? t('subjects.zameraniPickUnpick') : t('subjects.zameraniPickPick')}
          className="shrink-0 p-1 rounded cursor-pointer"
        >
          <PickIcon
            className={`w-4 h-4 ${picked ? 'text-primary' : 'text-base-content/70 hover:text-primary'}`}
          />
        </span>
        <span className="flex-1 flex items-center gap-2 min-w-0">
          <span className="flex-1 text-sm font-medium truncate">{cleanName}</span>
          {insight.totalCredits > 0 && (
            <span className="text-[10px] text-base-content/70 font-mono shrink-0">
              {insight.totalCredits}
              <span className="hidden md:inline"> kr.</span>
            </span>
          )}
          {hasDetail && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-base-content/70 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`}
            />
          )}
        </span>
      </button>
      {open && hasDetail && (
        <div className="px-2 pb-2 flex flex-col">
          {insight.description && (
            <p className="px-2 pt-1 pb-2 text-[11px] text-base-content/75 leading-relaxed">
              {insight.description}
            </p>
          )}
          {insight.subjects.map((s) => {
            const handleClick = () =>
              s.id ? onOpen(s.code, s.name, s.id, undefined, 'stats') : onSearch(s.code);
            const sems = subjectSemesters?.get(s.code);
            const semLabel = sems?.length ? `${sems.join('+')}.` : null;
            return (
              <button
                key={s.code}
                onClick={handleClick}
                className="flex items-center gap-2 px-2 py-1 rounded hover:bg-base-200 transition-colors text-left"
              >
                <span className="font-mono text-[10px] text-base-content/70 shrink-0">
                  {s.code}
                </span>
                <span className="flex-1 text-[11px] truncate">{s.name}</span>
                {semLabel && (
                  <span className="text-[10px] text-base-content/70 shrink-0">
                    {semLabel}
                    <span className="hidden md:inline"> sem.</span>
                  </span>
                )}
                <span
                  className={`flex items-center justify-center h-4 px-1 rounded text-[10px] font-medium shrink-0 ${rateClass(s.stat?.rate ?? null)}`}
                >
                  {/* Named, not a bare number. This card compares zaměření BY
                      failure rate, and its rows were the one place in the study
                      plan that still showed "11%" with nothing saying what it
                      was a percentage of. Nothing when there is no stat: an em
                      dash has nothing to name. */}
                  {s.stat ? (
                    <>
                      <span className="mr-1 whitespace-nowrap">{t('subjects.failRateLabel')}</span>
                      {s.stat.rate}%
                    </>
                  ) : (
                    '—'
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ZameraniComparisonCard({
  insights,
  picks,
  onTogglePick,
  minRequired,
  subjectSemesters,
  onOpenSubject,
  onSearchSubject,
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  if (insights.length < 2) return null;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-base-200/50 transition-colors text-left"
      >
        <Layers className="w-4 h-4 text-primary shrink-0" />
        <span className="text-sm font-semibold flex-1">{t('subjects.insights.zameraniTitle')}</span>
        <span className="text-[10px] text-base-content/70 font-medium mr-1">
          {minRequired && minRequired > 0 ? (
            <>
              <span className="md:hidden">
                {picks.size} / {minRequired}
              </span>
              <span className="hidden md:inline">
                {t('subjects.zameraniPickProgress', { picked: picks.size, min: minRequired })}
              </span>
            </>
          ) : (
            <>
              <span className="md:hidden">{picks.size}</span>
              <span className="hidden md:inline">
                {t('subjects.zameraniPickProgressNoMin', { picked: picks.size })}
              </span>
            </>
          )}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-base-content/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-3 pb-3 flex flex-col gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {insights.map((z, i) => {
            const norm = normalizeZameraniName(z.name);
            return (
              <ZameraniRow
                key={z.name}
                insight={z}
                open={openIdx === i}
                picked={picks.has(norm)}
                subjectSemesters={subjectSemesters}
                onToggle={() => setOpenIdx(openIdx === i ? null : i)}
                onTogglePick={() => onTogglePick(norm)}
                onOpen={onOpenSubject}
                onSearch={onSearchSubject}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
