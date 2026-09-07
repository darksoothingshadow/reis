import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { useTranslation } from '../../../../hooks/useTranslation';
import { localizedCourseName, localizedRoom } from '../../../../utils/localizedLesson';

/**
 * Colour tokens match `CalendarEventCard`'s desktop scheme exactly (same
 * `exam-*`/`lecture-*`/`seminar-*` design tokens) — these card backgrounds are
 * fixed light tints that do NOT follow the active theme, so the foreground
 * uses the fixed `content-primary`/`content-secondary` tokens too, not
 * theme-reactive `base-content`.
 */
function eventStyles(lesson: BlockLesson) {
  if (lesson.isExam) {
    return {
      bg: 'bg-exam-bg/85',
      border: 'border-exam-border/30',
      rail: 'border-l-exam-border',
      text: 'text-exam-text',
    };
  }
  if (lesson.isSeminar === 'true') {
    return {
      bg: 'bg-seminar-bg/85',
      border: 'border-seminar-border/30',
      rail: 'border-l-seminar-border',
      text: 'text-seminar-text',
    };
  }
  return {
    bg: 'bg-lecture-bg/85',
    border: 'border-lecture-border/30',
    rail: 'border-l-lecture-border',
    text: 'text-lecture-text',
  };
}

export interface AgendaEventProps {
  lesson: BlockLesson;
  onOpenSubject: () => void;
  onShowOnMap: () => void;
}

/**
 * One lesson on the day's agenda: the row opens the subject (files, syllabus,
 * classmates), the pin on the right shows the room on the map.
 *
 * Two SIBLING buttons inside a div, not a button with a button in it — that is
 * invalid HTML and browsers dispatch the inner tap to both. The whole text area
 * is the subject tap; the pin is its own `min-h-11` target.
 *
 * There used to be a sheet between the row and these two actions
 * (`EventDetailSheet`), showing room · time · teacher — which this row already
 * shows — and two buttons for exactly these. It was the tap that bought nothing.
 */
export function AgendaEvent({ lesson, onOpenSubject, onShowOnMap }: AgendaEventProps) {
  const { t, language } = useTranslation();
  const courseName = localizedCourseName(lesson, language);
  const room = localizedRoom(lesson, language);
  // Surname only ("Melicharová"), not the full titled name — that is what
  // lets room, time and teacher share one line at 390px without clipping.
  // Every teacher's full name is in the subject drawer's header.
  const teacher = lesson.teachers[0]?.shortName || lesson.teachers[0]?.fullName;
  const styles = eventStyles(lesson);

  return (
    <div
      className={`flex w-full items-stretch rounded-xl border border-l-4 ${styles.bg} ${styles.border} ${styles.rail}`}
    >
      <button
        type="button"
        onClick={onOpenSubject}
        className="flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col justify-center gap-0.5 py-2.5 pl-3 pr-1 text-left"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-md font-semibold leading-snug text-content-primary">
            {courseName}
          </span>
          {lesson.isExam && (
            <span className={`flex-shrink-0 text-xs font-bold uppercase ${styles.text}`}>
              {t('course.badge.exam')}
            </span>
          )}
        </div>
        <span className="truncate text-2sm leading-snug text-content-secondary">
          {room} · {lesson.startTime} – {lesson.endTime}
          {teacher && ` · ${teacher}`}
        </span>
      </button>
      <button
        type="button"
        aria-label={t('mobile.sheet.showOnMap')}
        onClick={(e) => {
          e.stopPropagation();
          onShowOnMap();
        }}
        className="flex min-h-11 min-w-11 flex-shrink-0 cursor-pointer items-center justify-center pr-1 text-content-secondary"
      >
        <MapPin size={18} />
      </button>
    </div>
  );
}
