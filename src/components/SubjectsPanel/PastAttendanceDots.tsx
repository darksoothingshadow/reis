import { useMemo } from 'react';
import { ExternalLink } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/hooks/useTranslation';

interface PastAttendanceDotsProps {
  courseCode: string;
}

const DOT: Record<string, string> = {
  present: 'bg-success',
  elsewhere: 'bg-success',
  absent: 'bg-error',
  excluded: 'bg-error',
  late: 'bg-warning',
  'early-leave': 'bg-warning',
  excused: 'bg-base-content/30',
};

const IS_BASE = 'https://is.mendelu.cz';

export function PastAttendanceDots({ courseCode }: PastAttendanceDotsProps) {
  const groups = useAppStore((s) => s.pastAttendance[courseCode]);
  const subjectInfo = useAppStore((s) => s.subjects?.data[courseCode]);
  const studium = useAppStore((s) => s.studiumId);
  const { language } = useTranslation();
  const lang = language === 'cz' ? 'cz' : 'en';

  const subjectId = subjectInfo?.subjectId;
  const hasPrubezne = subjectInfo?.hasPrubezne;
  const hasTest = subjectInfo?.hasTest;

  const { dots, presentCount, totalCount } = useMemo(() => {
    if (!groups) return { dots: [], presentCount: 0, totalCount: 0 };
    const all = groups.flatMap((g) => g.records);
    let present = 0,
      total = 0;
    for (const d of all) {
      if (d.status === 'present' || d.status === 'elsewhere') present++;
      if (d.status !== 'excused' && d.status !== 'excluded') total++;
    }
    return { dots: all.slice(-12), presentCount: present, totalCount: total };
  }, [groups]);

  const hasLinkContext = Boolean(studium && subjectId);
  const hasAnything = dots.length > 0 || (hasLinkContext && (hasPrubezne || hasTest));
  if (!hasAnything) return null;

  const buildUrl = (extra: string) =>
    `${IS_BASE}/auth/student/list.pl?studium=${studium};predmet=${subjectId};${extra};lang=${lang}`;

  return (
    <div className="flex items-center gap-1.5 pl-5 pb-1.5 -mt-0.5 opacity-70">
      {dots.length > 0 && (
        <>
          <div className="flex items-center gap-[3px]">
            {dots.map((d, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT[d.status] ?? 'bg-base-content/15'}`}
              />
            ))}
          </div>
          <span className="text-[9px] font-mono text-base-content/70 tabular-nums">
            {presentCount}/{totalCount}
          </span>
        </>
      )}
      {hasPrubezne && studium && subjectId && (
        <a
          href={buildUrl('prubezne=1')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-0.5 text-[10px] text-primary/60 hover:text-primary transition-colors shrink-0"
        >
          PH <ExternalLink size={9} />
        </a>
      )}
      {hasTest && studium && subjectId && (
        <a
          href={buildUrl('test=1')}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-0.5 text-[10px] text-primary/60 hover:text-primary transition-colors shrink-0"
        >
          VT <ExternalLink size={9} />
        </a>
      )}
    </div>
  );
}
