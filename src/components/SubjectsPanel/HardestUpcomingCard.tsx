import { useState } from 'react';
import { Flame, ChevronDown } from 'lucide-react';
import { useTranslation } from '@/hooks/useTranslation';
import { useCourseName } from '@/hooks/ui/useCourseName';
import type { HardestEntry } from './insights';
import { failRateTone } from './failRateTone';

interface Props {
  entries: HardestEntry[];
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

function Row({
  entry,
  onOpen,
  onSearch,
}: {
  entry: HardestEntry;
  onOpen: Props['onOpenSubject'];
  onSearch: Props['onSearchSubject'];
}) {
  const { t } = useTranslation();
  const { subject, stat, semesters } = entry;
  const displayName = useCourseName(subject.code, subject.name);
  const handleClick = () => {
    if (subject.id)
      onOpen(subject.code, subject.name, subject.id, undefined, 'stats', subject.isFulfilled);
    else onSearch(subject.code);
  };
  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-base-200 transition-colors text-left"
    >
      {semesters.length > 0 && (
        <span className="font-mono text-[10px] text-base-content/70 whitespace-nowrap shrink-0">
          {semesters.join('·')}.<span className="hidden md:inline"> sem.</span>
        </span>
      )}
      <span className="flex-1 text-sm truncate">{displayName}</span>
      <span
        className={`group/fail flex items-center justify-center h-5 px-1.5 rounded text-[10px] font-medium shrink-0 ${failRateTone(stat.rate)}`}
      >
        {/* Always shown, never hover-revealed — the same fix #265 made to
            SubjectRow, which this card was missed out of. It was
            max-w-0/opacity-0 until :hover, and a touch screen has no hover, so
            the iPad showed five bare colour-coded numbers while every row in
            the semester lists below named itself in full. */}
        <span className="mr-1 whitespace-nowrap">{t('subjects.failRateLabel')}</span>
        {stat.rate}%
      </span>
    </button>
  );
}

export function HardestUpcomingCard({ entries, onOpenSubject, onSearchSubject }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (entries.length === 0) return null;
  return (
    <div className="rounded-lg border border-base-300 bg-base-100">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-base-200/50 transition-colors text-left"
      >
        <Flame className="w-4 h-4 text-error shrink-0" />
        <span className="text-sm font-semibold flex-1">{t('subjects.insights.hardestTitle')}</span>
        <ChevronDown
          className={`w-4 h-4 text-base-content/70 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-1 pb-2 flex flex-col animate-in fade-in slide-in-from-top-1 duration-150">
          {entries.map((e) => (
            <Row key={e.subject.code} entry={e} onOpen={onOpenSubject} onSearch={onSearchSubject} />
          ))}
        </div>
      )}
    </div>
  );
}
