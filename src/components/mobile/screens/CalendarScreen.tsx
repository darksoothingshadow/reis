import type { ReactNode } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { ScreenSkeleton } from '../primitives/ScreenSkeleton';
import { ScreenError } from '../primitives/ScreenError';
import { useTranslation } from '../../../hooks/useTranslation';
import { useSchedule } from '../../../hooks/data/useSchedule';
import { resolveNowNext } from '../../../utils/mobile/nowNext';
import { buildDayAgenda } from '../../../utils/mobile/dayAgenda';
import { isLessonHidden } from '../../../utils/hiddenLessons';
import { getCzechHoliday } from '../../../utils/holidays';
import { isOutsideTeaching } from '../../../utils/mobile/teachingPeriod';
import { semesterStart } from '../../../utils/mobile/semesterStart';
import { toIso } from '../../../utils/mobile/weekDays';
import { roomCodeFor, subjectSheetFor } from '../../../utils/mobile/lessonActions';
import { ScreenHeader } from './calendar/ScreenHeader';
import { NowNextCard } from './calendar/NowNextCard';
import { DayChips } from './calendar/DayChips';
import { DayAgenda } from './calendar/DayAgenda';
import { CalendarEmptyDay } from './calendar/CalendarEmptyDay';
import { MenuCard } from './calendar/MenuCard';
import { RecentFilesStrip } from './calendar/RecentFilesStrip';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';

function CalendarSkeleton() {
  const { t } = useTranslation();
  return (
    <ScreenSkeleton
      testId="calendar-skeleton"
      label={t('mobile.calendar.loading')}
      // One row shorter than it was, and no inset of its own: the header above
      // it is real now rather than a placeholder bar.
      rows={['h-28', 'h-10', 'h-20', 'h-20']}
      underHeader
    />
  );
}

export function CalendarScreen() {
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const { schedule } = useSchedule();
  const mobileSelectedDayIso = useAppStore((s) => s.mobileSelectedDayIso);
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const pushSheet = useAppStore((s) => s.pushSheet);
  const focusRoomByCode = useAppStore((s) => s.focusRoomByCode);
  const handshakeDone = useAppStore((s) => s.syncStatus.handshakeDone);
  const handshakeTimedOut = useAppStore((s) => s.syncStatus.handshakeTimedOut);
  const isSyncing = useAppStore((s) => s.syncStatus.isSyncing);
  const firstSyncSettled = useAppStore((s) => s.firstSyncSettled);
  const syncLoaded = useAppStore((s) => s.syncLoaded);
  const hiddenItems = useAppStore((s) => s.hiddenItems);
  const teachingWeekData = useAppStore((s) => s.teachingWeekData);

  // The vývěska is no longer mounted here. It was a portal owned by this one
  // screen while the button that opens it ships with every screen's header, so
  // it opened from the calendar tab and nowhere else; it is a sheet in the
  // shared stack now — see sheets/BulletinSheet.
  //
  // The date and the header's four actions come from the selected day and the
  // store, never from the fetch, so they are knowable in every state below —
  // and the header is the ONLY way into search, settings, notifications and
  // the vývěska. Returning a bare skeleton or error in its place left a
  // student with no route to any of them for as long as a crawl took, which on
  // a first sign-in is minutes.
  const selectedIso = mobileSelectedDayIso ?? toIso(new Date());
  const isToday = selectedIso === toIso(new Date());
  // The arrows and chips only ever step AWAY from today; this is the step back.
  // Beside the date where it fits (the iPad), under it where it does not (a
  // phone — inline it clipped the date at 320 and 390), and only off-day, so
  // today's screen is exactly what it was. `null` is "today" in the store, so
  // the day re-derives itself at midnight rather than pinning a date. Ink on
  // a tint, not the lime: text-primary on a light surface is 1.89:1.
  const todayPill = isToday ? undefined : (
    <button
      type="button"
      onClick={() => setMobileSelectedDay(null)}
      className="flex-shrink-0 whitespace-nowrap rounded-full bg-base-content/10 px-2.5 py-1 text-xs font-semibold text-base-content"
    >
      {t('common.today')}
    </button>
  );

  // Lifted above `chrome` so it is computed once for the strip below, in every
  // state including the skeleton — with no schedule the set is simply empty,
  // and the strip falls back to Mon–Fri.
  const visibleSchedule = schedule.filter((l) => !isLessonHidden(l, hiddenItems));
  const lessonDates = new Set(visibleSchedule.map((l) => l.date));
  const chrome = (
    <>
      {/* The date IS the title, and the eyebrow stays empty. It was the
          eyebrow under a "Ahoj, {name}" greeting that told the student nothing
          they did not already know, and a week label was tried there and
          rejected the same way — the strip and the title already say which
          week and which day this is. */}
      <ScreenHeader
        title={formatHeaderDate(new Date(`${selectedIso}T00:00:00`), locale)}
        beside={todayPill}
      />
    </>
  );
  const shell = (body: ReactNode) => (
    <div data-testid="calendar-screen" className="flex flex-1 flex-col overflow-hidden">
      {chrome}
      {body}
    </div>
  );

  // Two different questions, and only one of them is `handshakeDone`. That
  // flag flips on the first status message, which the sync posts as it STARTS,
  // so on a first run it says "connected", not "finished". Until a crawl has
  // actually completed (`firstSyncSettled`) and while one is in flight, an
  // absence of lessons means it has not arrived yet — show the skeleton rather than
  // an empty state that reads as a wrong answer.
  //
  // Deliberately not gated on `!firstSyncSettled`: that flag is latched, so a
  // retry after a failed run would otherwise sit on ScreenError for its whole
  // duration. `syncLoaded.schedule` is what protects a genuinely empty week
  // from getting a skeleton thrown back over it every fifteen minutes.
  if (
    (!handshakeDone && !handshakeTimedOut) ||
    (isSyncing && !syncLoaded.schedule && schedule.length === 0)
  ) {
    return shell(<CalendarSkeleton />);
  }

  // The third state. A finished sync that never delivered this domain, with
  // nothing cached to fall back on, means the fetch failed — and "Nic nemáš,
  // pohodička" over a failed fetch is the same lie as showing it mid-sync,
  // just later. (The first run in a process always fetches, so a missing
  // arrival here cannot be a TTL skip.)
  if (firstSyncSettled && !syncLoaded.schedule && schedule.length === 0) {
    return shell(<ScreenError testId="calendar-error" />);
  }

  const now = new Date();
  const nowNext = resolveNowNext(schedule, now);
  const agenda = buildDayAgenda(visibleSchedule, selectedIso);
  // The util has existed since the desktop calendar shipped; the phone simply
  // never asked. Without it a public holiday reads as an ordinary free day —
  // "Nic nemáš, pohodička" over 28 September.
  const holiday = getCzechHoliday(
    new Date(`${selectedIso}T00:00:00`),
    language === 'en' ? 'en' : 'cz'
  );
  // The same question the desktop calendar asks, from the same store field:
  // before term, "Nic nemáš, pohodička" reads as "you happen to be free" when
  // the truth is "there is no schedule to see yet".
  const outsideTeaching = isOutsideTeaching(teachingWeekData, new Date(`${selectedIso}T00:00:00`));
  // And when it starts, which is what a student wants from that answer. Only
  // when it is still ahead — after term this would be last September's date.
  // The DATE, not the sentence: the copy and its formatting belong to the
  // component that shows it.
  const firstTeachingDay = semesterStart(schedule);
  const teachingStartsOn =
    firstTeachingDay && firstTeachingDay > new Date(`${selectedIso}T00:00:00`)
      ? firstTeachingDay
      : null;

  const openRoute = () => {
    if (!nowNext?.next) return;
    setMobileTab('map');
    focusRoomByCode(roomCodeFor(nowNext.next));
  };

  return shell(
    <>
      {nowNext && <NowNextCard data={nowNext} onRoute={openRoute} />}

      {/* Above the agenda rather than only inside the empty state: a holiday
          can still carry a lesson (a rescheduled block, a combined-study
          Saturday), and the student needs to know the day is a holiday either
          way. */}
      {holiday && (
        <div
          data-testid="calendar-holiday"
          className="mx-4 mt-3 flex flex-shrink-0 items-center gap-2 rounded-xl border border-error/25 bg-error/10 px-3 py-2"
        >
          <span className="text-sm font-semibold text-error">{holiday}</span>
        </div>
      )}

      <DayChips
        selectedIso={selectedIso}
        onSelect={setMobileSelectedDay}
        lessonDates={lessonDates}
      />

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
        {/* The way back into the file you were reading, on every day. Below
            the agenda for the same reason MenuCard is — the timetable first. */}
        <RecentFilesStrip />
        {/* Under the day's agenda, inside the scroller: lunch is what you look
            at after the timetable, not before it, and on a full teaching day
            the card must not push the 8am lecture off the screen. */}
        <MenuCard dayIso={selectedIso} />
      </div>
    </>
  );
}
