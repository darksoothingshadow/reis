import { useState, useRef } from 'react';
import { ChevronUp, ChevronDown, X } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { StudyPlan, SubjectStatus } from '@/types/studyPlan';

interface TableACourse {
  code: string;
  name: string;
  credits: number;
}

export interface ManualCourse {
  code: string;
  name: string;
  credits: number;
}

interface Props {
  plan: StudyPlan;
  selectedCodes: string[];
  onToggle: (code: string) => void;
  tableACourses: TableACourse[];
  onReorder: (fromIndex: number, toIndex: number) => void;
  hoveredRowIndex?: number | null;
  manualCourses: ManualCourse[];
  onAddManual: (course: ManualCourse) => void;
  onRemoveManual: (index: number) => void;
  onReorderManual: (from: number, to: number) => void;
}

const ROW_CLS =
  'grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 last:border-b-0 text-xs transition-colors';
const BTN_CHEVRON =
  'btn btn-ghost w-4 h-3.5 min-h-0 p-0 text-base-content/20 hover:text-[var(--tone-primary)] disabled:opacity-0 disabled:pointer-events-none rounded-none';
const BTN_REMOVE =
  'btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/15 hover:text-error hover:bg-error/10 rounded-full';

function ReorderButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  return (
    <div className="flex flex-col gap-0">
      <button onClick={onUp} disabled={disableUp} className={BTN_CHEVRON}>
        <ChevronUp size={11} />
      </button>
      <button onClick={onDown} disabled={disableDown} className={BTN_CHEVRON}>
        <ChevronDown size={11} />
      </button>
    </div>
  );
}

function PlanRow({
  subject,
  displayCredits,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
  isHovered,
}: {
  subject: SubjectStatus;
  displayCredits: number;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  isHovered?: boolean;
}) {
  const displayName = useCourseName(subject.code, subject.name);
  return (
    <div
      className={`${ROW_CLS} ${isHovered ? 'bg-primary/10 border-primary/30 shadow-[inset_3px_0_0_oklch(var(--p))]' : 'hover:bg-base-200'}`}
    >
      <ReorderButtons
        onUp={onMoveUp}
        onDown={onMoveDown}
        disableUp={isFirst}
        disableDown={isLast}
      />
      <span className="font-mono text-base-content/70 w-20 truncate">{subject.code}</span>
      <span className="truncate font-medium">{displayName}</span>
      <span className="tabular-nums font-bold text-base-content/70 w-12 text-right">
        {displayCredits}
      </span>
      <button onClick={onRemove} className={BTN_REMOVE}>
        <X size={12} />
      </button>
    </div>
  );
}

function ManualRow({
  course,
  isFirst,
  isLast,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  course: ManualCourse;
  isFirst: boolean;
  isLast: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  return (
    <div className={`${ROW_CLS} hover:bg-base-200`}>
      <ReorderButtons
        onUp={onMoveUp}
        onDown={onMoveDown}
        disableUp={isFirst}
        disableDown={isLast}
      />
      <span className="font-mono text-base-content/70 w-20 truncate">{course.code}</span>
      <span className="truncate font-medium">{course.name}</span>
      <span className="tabular-nums font-bold text-base-content/70 w-12 text-right">
        {course.credits}
      </span>
      <button onClick={onRemove} className={BTN_REMOVE}>
        <X size={12} />
      </button>
    </div>
  );
}

export function LATableB({
  plan,
  selectedCodes,
  onToggle,
  tableACourses,
  onReorder,
  hoveredRowIndex,
  manualCourses,
  onAddManual,
  onRemoveManual,
  onReorderManual,
}: Props) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [credits, setCredits] = useState('');
  const codeRef = useRef<HTMLInputElement>(null);

  const allSubjects = (plan.blocks || []).flatMap((b) =>
    (b.groups || []).flatMap((g) => g.subjects || [])
  );
  const selected: SubjectStatus[] = (selectedCodes || [])
    .map((c) => allSubjects.find((s) => s.code === c))
    .filter((s): s is SubjectStatus => s !== undefined);

  const tableATotal = tableACourses.reduce((sum, c) => sum + c.credits, 0);
  const knownBTotal = selected.reduce((sum, s) => (s.credits < 999 ? sum + s.credits : sum), 0);
  const positionalExaTotal = selected.reduce(
    (sum, s, i) => (s.credits >= 999 ? sum + (tableACourses[i]?.credits ?? 0) : sum),
    0
  );
  const residual = Math.max(0, tableATotal - knownBTotal - positionalExaTotal);

  const displayCredits = selected.map((s, i) =>
    s.credits >= 999 ? (tableACourses[i]?.credits ?? 0) : s.credits
  );
  const lastExaIdx = selected
    .map((s, i) => (s.credits >= 999 ? i : -1))
    .filter((i) => i >= 0)
    .pop();
  if (residual > 0 && lastExaIdx !== undefined) displayCredits[lastExaIdx] += residual;

  const planTotal = displayCredits.reduce((sum, c) => sum + c, 0);
  const manualTotal = manualCourses.reduce((sum, c) => sum + c.credits, 0);
  const totalCredits = planTotal + manualTotal;

  const hasRows = selected.length > 0 || manualCourses.length > 0;

  const handleAdd = () => {
    const c = parseInt(credits, 10) || 0;
    onAddManual({ code: code.trim(), name: name.trim(), credits: c });
    setCode('');
    setName('');
    setCredits('');
    codeRef.current?.focus();
  };

  const openForm = () => {
    setAdding(true);
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <div className="badge badge-sm font-black tracking-wider bg-success/10 text-base-content border-success/20">
          B
        </div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-base-content/70">
          {t('erasmus.tableBTitle')}
        </span>
        {hasRows && (
          <span className="ml-auto text-[10px] text-base-content/70 tabular-nums">
            {selected.length + manualCourses.length} {t('erasmus.selected')}
          </span>
        )}
      </div>

      {!hasRows && !adding ? (
        <div className="border border-dashed border-base-300 rounded-lg px-4 py-4 text-center">
          <p className="text-xs text-base-content/70">{t('erasmus.tableBEmpty')}</p>
        </div>
      ) : (
        <div className="border border-base-300 rounded-xl overflow-hidden bg-base-100 shadow-sm">
          <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 px-3 py-2 bg-base-200 border-b border-base-300 text-[10px] uppercase tracking-wider font-bold text-base-content/70">
            <span className="w-4" />
            <span className="w-20">{t('erasmus.colCode')}</span>
            <span>{t('erasmus.colMendeluCourse')}</span>
            <span className="w-12 text-right">{t('erasmus.colECTS')}</span>
            <span className="w-5" />
          </div>

          {selected.map((s, i) => (
            <PlanRow
              key={s.code}
              subject={s}
              displayCredits={displayCredits[i]}
              isFirst={i === 0}
              isLast={i === selected.length - 1 && manualCourses.length === 0}
              onMoveUp={() => onReorder(i, i - 1)}
              onMoveDown={() => onReorder(i, i + 1)}
              onRemove={() => onToggle(s.code)}
              isHovered={hoveredRowIndex === i}
            />
          ))}

          {manualCourses.map((c, i) => (
            <ManualRow
              key={i}
              course={c}
              isFirst={i === 0 && selected.length === 0}
              isLast={i === manualCourses.length - 1}
              onMoveUp={() => onReorderManual(i, i - 1)}
              onMoveDown={() => onReorderManual(i, i + 1)}
              onRemove={() => onRemoveManual(i)}
            />
          ))}

          {adding && (
            <div className="grid grid-cols-[auto_1fr_auto_auto] gap-2 items-center px-3 py-2 border-b border-base-300/50 bg-base-200">
              <input
                ref={codeRef}
                autoFocus
                className="input input-xs input-bordered w-20 font-mono text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder={t('erasmus.colCode')}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <input
                className="input input-xs input-bordered w-full text-xs focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder={t('erasmus.colMendeluCourse')}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <input
                className="input input-xs input-bordered w-12 text-xs text-right tabular-nums focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                placeholder="0"
                value={credits}
                onChange={(e) => setCredits(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              />
              <button
                onClick={() => setAdding(false)}
                className="btn btn-ghost btn-xs w-5 h-5 min-h-0 p-0 text-base-content/70 hover:text-error rounded-full"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {hasRows && (
            <div className="grid grid-cols-[auto_auto_1fr_auto_auto] gap-2 items-center px-3 py-2 bg-base-200 border-t border-base-300 text-xs">
              <span className="w-4" />
              <span className="font-bold text-base-content/70 w-20">{t('erasmus.total')}</span>
              <span />
              <span className="tabular-nums font-black w-12 text-right">{totalCredits}</span>
              <span className="w-5" />
            </div>
          )}
        </div>
      )}

      {/* Fallback escape hatch — visually silent, only noticed when needed */}
      {!adding && (
        <button
          onClick={openForm}
          className="self-end text-xs text-base-content/70 hover:text-base-content transition-colors duration-150 leading-none pt-0.5 cursor-pointer"
        >
          {t('erasmus.addManuallyFallback')}
        </button>
      )}
    </div>
  );
}
