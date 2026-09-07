import type { AgendaRow } from '../../../../utils/mobile/dayAgenda';
import { useAppStore } from '../../../../store/useAppStore';
import { roomCodeFor, subjectSheetFor } from '../../../../utils/mobile/lessonActions';
import { DayAgenda } from './DayAgenda';
import { CalendarEmptyDay } from './CalendarEmptyDay';
import { RecentFilesStrip } from './RecentFilesStrip';
import { MenuCard } from './MenuCard';

export interface DayBodyProps {
  agenda: AgendaRow[];
  selectedIso: string;
  holiday: string | null;
  outsideTeaching: boolean;
  teachingStartsOn: Date | null;
}

/**
 * The scrolling part of the calendar screen: the day's agenda (or its empty
 * state), then the recently opened files, then lunch — the timetable first,
 * and on a full teaching day nothing below it may push the 8am lecture off the
 * screen. The two things under the agenda are the student's own (the shelf
 * follows the student, the menu follows the day), which is why they sit below
 * it on every day rather than only when the day is empty.
 */
export function DayBody({
  agenda,
  selectedIso,
  holiday,
  outsideTeaching,
  teachingStartsOn,
}: DayBodyProps) {
  const pushSheet = useAppStore((s) => s.pushSheet);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {agenda.length === 0 ? (
        <CalendarEmptyDay
          holiday={holiday}
          outsideTeaching={outsideTeaching}
          teachingStartsOn={teachingStartsOn}
        />
      ) : (
        <DayAgenda
          rows={agenda}
          // The row hands over the day's own lesson object, so there is no
          // id to look up and no week to disambiguate.
          onOpenSubject={(lesson) => pushSheet(subjectSheetFor(lesson))}
          onShowOnMap={(lesson) => {
            setMobileTab('map');
            focusRoomByCode(roomCodeFor(lesson));
          }}
        />
      )}
      <RecentFilesStrip />
      <MenuCard dayIso={selectedIso} />
    </div>
  );
}
