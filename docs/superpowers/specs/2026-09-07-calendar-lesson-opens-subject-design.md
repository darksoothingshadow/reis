# Calendar: a lesson opens its subject; the room is a pin on the row

**Date:** 2026-09-07 · **Scope:** mobile web tree (`src/components/mobile/screens/calendar`) · **Approved by:** Dominik

## The problem

Tapping a lesson on the phone calendar opens `EventDetailSheet`: room · time ·
teacher — which the row you just tapped already shows — plus two buttons,
"Show on map" and "Open subject". The sheet is a landing between the lesson and
the two things a student actually wants. Reaching a subject PDF from the calendar
is lesson → sheet → subject → file; the sheet is the tap that buys nothing.

## Design

### `AgendaEvent`

- The row's main tap → `pushSheet({ kind: 'subjectDrawer', courseCode, courseName })`
  — the same call `EventDetailSheet.onShowSubject` makes today. Exams included:
  an exam row goes to its subject too.
- **The map pin moves to the right edge and becomes the action.** Today's pin is
  decorative on line 2's left. It becomes a `min-h-11 min-w-11` icon button on
  the trailing edge, `aria-label = t('mobile.sheet.showOnMap')`, calling
  `setMobileTab('map')` + `focusRoomByCode(room)` with the same `(Campus)`
  suffix strip `CalendarScreen.openRoute` uses. One pin per row; the decorative
  one goes.
- **HTML:** a button inside a button is invalid. The row becomes a `<div>` with
  two sibling controls: the main `<button>` (`flex-1`, whole text area) and the
  pin `<button>`. Same visual result; the pin's handler stops propagation so a
  pin tap never also opens the drawer.
- The row already holds the day's own `lesson` object, so the id/day matching
  the sheet needed (`EventDetailSheet.tsx:47-63` — one IS id shared across every
  week of the semester) has nothing left to solve. No lookup.
- `AgendaEventProps` becomes `{ lesson, onOpenSubject, onShowOnMap }`; both
  handlers built in `CalendarScreen`, where `pushSheet`, `setMobileTab` and
  `focusRoomByCode` already live. `DayAgenda` passes them through.

### Removed

- `EventDetailSheet.tsx`, `__tests__/EventDetailSheet.test.tsx`,
  `__tests__/EventDetailSheet.showSubject.test.tsx`.
- `{ kind: 'eventDetail'; … }` from `MobileSheet` in `store/types.ts`; the
  `case 'eventDetail'` in `SheetHost`; the `pushSheet` at `CalendarScreen.tsx:182`.
- Locale key `mobile.sheet.showSubject` (both files). `mobile.sheet.showOnMap`
  and `map.showOnMap` stay — the pin uses the former.
- The stale comment in `AgendaEvent` ("the full name is one tap away in the
  event sheet") — the drawer header lists every teacher's full name.

### Guard

`src/test/guards/desktopHasNoShowOnMap.test.ts` pins that the phone keeps an
explicit "show on map" control (touch has no hover). The phone allowlist entry
moves from `components/mobile/sheets/EventDetailSheet.tsx` to
`components/mobile/screens/calendar/AgendaEvent.tsx`. The guard's reason is
unchanged and still true.

`ProfileScreen.tsx:35` mentions the sheet in a comment about hidden events;
reword, since hiding was removed from the sheet before this and the sheet is
gone now.

### Lost

Nothing. Room, time and surname are on the row; the full teacher names are in
the drawer header; "Show on map" is the pin.

## Tests

New `screens/calendar/__tests__/AgendaEvent.test.tsx`:

- tapping the row calls `onOpenSubject` once and never `onShowOnMap`;
- tapping the pin calls `onShowOnMap` once and never `onOpenSubject`;
- the pin carries the `showOnMap` label.

`CalendarScreen` wiring test (existing screen tests or a small new one):
`onOpenSubject` pushes `subjectDrawer` with the lesson's code and name;
`onShowOnMap` switches tab and focuses the stripped room code.
`SheetHost.test.tsx` loses its `eventDetail` case. `verify-ui` at 320/390/430:
the pin must not push the title into truncation on a 390px row with a long
course name.

## Out of scope

Long-press or exam-only survival of the sheet (rejected: delete it). The desktop
calendar (`CalendarEventCard`) is untouched.
