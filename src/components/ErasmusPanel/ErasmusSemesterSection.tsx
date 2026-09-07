import { Info } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import { isCompulsoryGroup, isCoreElectiveGroup, isElectiveGroup } from '@/utils/studyPlanUtils';
import { isTransferableCourse } from './isTransferableCourse';
import type { SemesterBlock, SubjectStatus } from '@/types/studyPlan';

interface Props {
  block: SemesterBlock;
  failRates: Record<string, number | null>;
  selectedCodes: Set<string>;
  onToggleCourse: (code: string) => void;
  onOpenSubject: (courseCode: string, courseName?: string, courseId?: string) => void;
  onSearchSubject: (name: string) => void;
}

const isRecognizedCode = (code: string) => (code || '').startsWith('EXA-UP');

function SelectableRow({
  subject,
  failRate,
  selected,
  isRecognized,
  onToggle,
  onOpen,
}: {
  subject: SubjectStatus;
  failRate: number | null;
  selected: boolean;
  isRecognized?: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const displayName = useCourseName(subject.code, subject.name);

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-colors group ${selected ? 'bg-primary/10 hover:bg-primary/20' : 'hover:bg-base-200'}`}
    >
      <button onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-2 text-left">
        <input
          type="checkbox"
          className="checkbox checkbox-xs checkbox-primary shrink-0 pointer-events-none"
          checked={selected}
          readOnly
        />
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm truncate flex-1 text-left">{displayName}</span>
          </div>
          {isRecognized && (
            <span className="text-[9px] uppercase font-bold text-success/70 tracking-tighter -mt-0.5">
              {t('erasmus.recognizedSubject')}
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {failRate != null && !isRecognized && (
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
              failRate >= 25
                ? 'bg-error/10 text-error'
                : failRate >= 20
                  ? 'bg-warning/15 text-warning-content'
                  : 'bg-base-content/5 text-base-content/70'
            }`}
          >
            {failRate}%
          </span>
        )}
        <span className="text-xs text-base-content/70">
          {subject.credits >= 999 ? '?' : subject.credits} kr.
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          className="btn btn-ghost btn-xs w-8 h-8 p-0 text-base-content/70 hover:text-[var(--tone-primary)] hover:bg-primary/5 rounded-full"
          title="Details"
        >
          <Info size={16} />
        </button>
      </div>
    </div>
  );
}

export function ErasmusSemesterSection({
  block,
  failRates,
  selectedCodes,
  onToggleCourse,
  onOpenSubject,
  onSearchSubject,
}: Props) {
  const { t } = useTranslation();
  if (!block || !block.groups) return null;

  const groups = block.groups;

  // Include all graduation-relevant groups (compulsory, core elective, and elective)
  const visibleGroups = groups.filter(
    (g) =>
      g &&
      (isCompulsoryGroup(g.name, block.title) ||
        isCoreElectiveGroup(g.name) ||
        isElectiveGroup(g.name, block.title))
  );

  const allVisibleSubjects = visibleGroups
    .flatMap((g) => g.subjects || [])
    .filter((s) => isTransferableCourse(s));

  const totalCredits = allVisibleSubjects
    .filter((s) => s && s.credits <= 50)
    .reduce((a, s) => a + s.credits, 0);

  const selectedCount = allVisibleSubjects.filter((s) => s && selectedCodes?.has(s.code)).length;

  if (visibleGroups.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 px-1">
        <span className="text-sm font-bold text-base-content/80 flex-1">{block.title}</span>
        <span className="text-[11px] text-base-content/70 tabular-nums">{totalCredits} kr.</span>
        {selectedCount > 0 && (
          <span className="badge badge-sm badge-primary bg-primary/20 text-base-content border-none font-bold">
            {selectedCount} {t('erasmus.selected')}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        {visibleGroups.map((group, gi) => {
          if (!group) return null;
          const isCompulsory = isCompulsoryGroup(group.name, block.title);
          const isCoreElective = isCoreElectiveGroup(group.name);

          const subjects = group.subjects || [];
          const filteredSubjects = subjects.filter((s) => isTransferableCourse(s));
          if (filteredSubjects.length === 0) return null;

          return (
            <div key={gi}>
              <div className="flex items-center justify-between px-2 py-1 mt-1">
                <div className="text-[10px] text-base-content/70 font-bold uppercase tracking-wider truncate mr-2">
                  {group.name}
                </div>
                {isCompulsory && (
                  <span className="text-[9px] uppercase font-black text-[var(--tone-primary)] tracking-widest shrink-0">
                    {t('erasmus.coreSubject')}
                  </span>
                )}
                {isCoreElective && (
                  <span className="text-[9px] uppercase font-black text-base-content/20 tracking-widest shrink-0">
                    {t('erasmus.coreElectiveSubject')}
                  </span>
                )}
              </div>
              {filteredSubjects.map((s) => {
                if (!s) return null;
                const isRecognized = isRecognizedCode(s.code);
                return (
                  <SelectableRow
                    key={s.code}
                    subject={s}
                    failRate={failRates[s.code] ?? null}
                    selected={!!selectedCodes?.has(s.code)}
                    isRecognized={isRecognized}
                    onToggle={() => onToggleCourse(s.code)}
                    onOpen={() =>
                      s.id ? onOpenSubject(s.code, s.name, s.id) : onSearchSubject(s.code)
                    }
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
