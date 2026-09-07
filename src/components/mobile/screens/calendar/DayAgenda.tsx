import type { AgendaRow } from '../../../../utils/mobile/dayAgenda';
import type { BlockLesson } from '../../../../types/calendarTypes';
import { AgendaEvent } from './AgendaEvent';
import { GapMarker } from './GapMarker';

export interface DayAgendaProps {
  rows: AgendaRow[];
  onOpenSubject: (lesson: BlockLesson) => void;
  onShowOnMap: (lesson: BlockLesson) => void;
}

/** The day's timeline: a start/end rail on the left, event cards and gap markers on the right. */
export function DayAgenda({ rows, onOpenSubject, onShowOnMap }: DayAgendaProps) {
  const events = rows.filter((r): r is Extract<AgendaRow, { type: 'event' }> => r.type === 'event');
  const railStart = events[0]?.lesson.startTime ?? '';
  const railEnd = events[events.length - 1]?.lesson.endTime ?? '';

  return (
    <div data-testid="day-agenda" className="flex gap-3 px-4">
      <div className="flex flex-shrink-0 flex-col items-center pt-1">
        <span className="text-xs font-medium text-base-content/60">{railStart}</span>
        {/* Solid, not a gradient. It faded primary → base-300, and in the
                    dark theme base-300 (#0f172a) is DARKER than the base-200
                    screen behind it, so the lower half of the rail dissolved
                    into the background and the day looked like it stopped
                    early. */}
        <div className="my-1 w-0.5 flex-1 rounded-full bg-primary/40" />
        <span className="text-xs font-medium text-base-content/60">{railEnd}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 pb-8">
        {rows.map((row, i) =>
          row.type === 'gap' ? (
            <GapMarker key={`gap-${i}`} minutes={row.minutes} />
          ) : (
            <AgendaEvent
              key={row.lesson.id}
              lesson={row.lesson}
              onOpenSubject={() => onOpenSubject(row.lesson)}
              onShowOnMap={() => onShowOnMap(row.lesson)}
            />
          )
        )}
      </div>
    </div>
  );
}
