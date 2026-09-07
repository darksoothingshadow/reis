# Calendar Lesson Opens Subject Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping a lesson on the phone calendar opens its subject drawer directly; the room becomes a map-pin button on the right of the row; `EventDetailSheet` is deleted.

**Architecture:** `AgendaEvent` becomes a `<div>` with two sibling buttons (subject / pin) and two callbacks; `DayAgenda` passes the lesson through; `CalendarScreen` builds the handlers from two pure helpers in a new `utils/mobile/lessonActions.ts` (unit-tested without the screen harness). Everything that existed only to serve the sheet — the `eventDetail` sheet kind, the `SheetHost` case, the locale key, two test files — goes.

**Tech Stack:** React 18 + TypeScript, Zustand (`useAppStore`), DaisyUI/Tailwind classes, lucide-react icons, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-07-calendar-lesson-opens-subject-design.md`

## Global Constraints

- No custom CSS; DaisyUI/Tailwind classes only. Touch targets `min-h-11`.
- No `useEffect` data fetching. All state in Zustand slices.
- Max 200 lines per file.
- Locale keys must exist in BOTH `src/i18n/locales/cs.json` and `en.json` (`src/i18n/__tests__/mobileKeys.test.ts` enforces parity under `mobile.*`).
- The phone must keep an explicit "show on map" control (`src/test/guards/desktopHasNoShowOnMap.test.ts`) — the pin is it.
- Exams go straight to the subject too. The decorative left pin is removed, not kept.
- `(Campus)` suffix strip for the map is the existing regex `/\s*\([^)]*\)\s*$/` — do not invent a second one.
- Tests: `npx vitest run <path>`; types: `npx tsc -b`; UI: the `verify-ui` skill at 320/390/430.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Branch from `test`, PR based on `test`.

---

### Task 1: Pure lesson actions (test first)

**Files:**
- Create: `src/utils/mobile/lessonActions.ts`
- Test: `src/utils/mobile/__tests__/lessonActions.test.ts`

**Interfaces:**
- Produces: `subjectSheetFor(lesson: BlockLesson): Extract<MobileSheet, { kind: 'subjectDrawer' }>` and `roomCodeFor(lesson: BlockLesson): string`. `CalendarScreen` (Task 3) and `openRoute` consume both.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/mobile/__tests__/lessonActions.test.ts
import { describe, it, expect } from 'vitest';
import { makeLesson } from '../../../test/fixtures/lesson';
import { roomCodeFor, subjectSheetFor } from '../lessonActions';

describe('lessonActions', () => {
  it('builds the subject drawer sheet from the lesson itself — no lookup, no day matching', () => {
    const lesson = makeLesson({ courseCode: 'EBC-AP', courseName: 'Architektura počítačů' });
    expect(subjectSheetFor(lesson)).toEqual({
      kind: 'subjectDrawer',
      courseCode: 'EBC-AP',
      courseName: 'Architektura počítačů',
    });
  });

  it('strips the trailing "(Campus)" from the room the way openRoute always has', () => {
    expect(roomCodeFor(makeLesson({ room: 'Q01 (Brno)' }))).toBe('Q01');
    expect(roomCodeFor(makeLesson({ room: 'Q01' }))).toBe('Q01');
    expect(roomCodeFor(makeLesson({ room: '  Q01  ' }))).toBe('Q01');
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/utils/mobile/__tests__/lessonActions.test.ts
```

Expected: FAIL — `Failed to resolve import "../lessonActions"`.

- [ ] **Step 3: Implement**

```ts
// src/utils/mobile/lessonActions.ts
import type { BlockLesson } from '../../types/calendarTypes';
import type { MobileSheet } from '../../store/types';

/**
 * What a lesson row can do, as data. Both used to live inside
 * `EventDetailSheet`, which is gone: the row holds the day's own lesson, so
 * there is nothing to look up and no id/day matching to get wrong.
 */
export function subjectSheetFor(
  lesson: BlockLesson
): Extract<MobileSheet, { kind: 'subjectDrawer' }> {
  return { kind: 'subjectDrawer', courseCode: lesson.courseCode, courseName: lesson.courseName };
}

/** The room as the map knows it: IS appends " (Campus)" that `focusRoomByCode` does not want. */
export function roomCodeFor(lesson: BlockLesson): string {
  return lesson.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
```

- [ ] **Step 4: Run it, watch it pass**

```bash
npx vitest run src/utils/mobile/__tests__/lessonActions.test.ts
```

Expected: `2 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mobile/lessonActions.ts src/utils/mobile/__tests__/lessonActions.test.ts
git commit -m "feat(calendar): lesson actions as data — the subject sheet and the room code

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The row — subject tap, pin button (test first)

**Files:**
- Modify: `src/components/mobile/screens/calendar/AgendaEvent.tsx`
- Modify: `src/components/mobile/screens/calendar/DayAgenda.tsx`
- Test: `src/components/mobile/screens/calendar/__tests__/AgendaEvent.test.tsx`

**Interfaces:**
- Produces: `AgendaEventProps { lesson: BlockLesson; onOpenSubject: () => void; onShowOnMap: () => void }`; `DayAgendaProps { rows: AgendaRow[]; onOpenSubject: (lesson: BlockLesson) => void; onShowOnMap: (lesson: BlockLesson) => void }`.
- Consumes: nothing from Task 1 (the row is dumb; the screen decides).

- [ ] **Step 1: Write the failing test**

```tsx
// src/components/mobile/screens/calendar/__tests__/AgendaEvent.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AgendaEvent } from '../AgendaEvent';
import { useAppStore } from '../../../../../store/useAppStore';
import { makeLesson } from '../../../../../test/fixtures/lesson';

describe('AgendaEvent', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('tapping the row opens the subject and does not touch the map', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent
        lesson={makeLesson({ courseName: 'Management' })}
        onOpenSubject={onOpenSubject}
        onShowOnMap={onShowOnMap}
      />
    );

    fireEvent.click(screen.getByText('Management'));

    expect(onOpenSubject).toHaveBeenCalledTimes(1);
    expect(onShowOnMap).not.toHaveBeenCalled();
  });

  it('tapping the pin shows the map and does not open the subject', () => {
    const onOpenSubject = vi.fn();
    const onShowOnMap = vi.fn();
    render(
      <AgendaEvent lesson={makeLesson()} onOpenSubject={onOpenSubject} onShowOnMap={onShowOnMap} />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));

    expect(onShowOnMap).toHaveBeenCalledTimes(1);
    expect(onOpenSubject).not.toHaveBeenCalled();
  });

  it('is two controls, not a button inside a button', () => {
    render(<AgendaEvent lesson={makeLesson()} onOpenSubject={() => {}} onShowOnMap={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.closest('button:not(:scope)')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/components/mobile/screens/calendar/__tests__/AgendaEvent.test.tsx
```

Expected: FAIL — first test: `onOpenSubject` not called (the prop is ignored; today's prop is `onOpen`). Second test: `Unable to find an accessible element with the role "button" and name "Ukázat na mapě"`.

- [ ] **Step 3: Rewrite `AgendaEvent`**

Replace the `AgendaEventProps` interface and the `AgendaEvent` function in `src/components/mobile/screens/calendar/AgendaEvent.tsx` (leave the imports and `eventStyles` as they are):

```tsx
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
```

- [ ] **Step 4: Pass the lesson through `DayAgenda`**

Replace the whole of `src/components/mobile/screens/calendar/DayAgenda.tsx` with:

```tsx
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
```

- [ ] **Step 5: Run the row test**

```bash
npx vitest run src/components/mobile/screens/calendar/__tests__/AgendaEvent.test.tsx
```

Expected: `3 passed`. (`tsc -b` will fail until Task 3 rewires `CalendarScreen` — that is expected at this point; do not run it yet.)

- [ ] **Step 6: Commit**

```bash
git add src/components/mobile/screens/calendar/AgendaEvent.tsx src/components/mobile/screens/calendar/DayAgenda.tsx src/components/mobile/screens/calendar/__tests__/AgendaEvent.test.tsx
git commit -m "feat(calendar): a lesson row opens its subject; the room is a pin on the right

Two sibling buttons, not a button in a button.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Wire the screen and delete the sheet

**Files:**
- Modify: `src/components/mobile/screens/CalendarScreen.tsx` (imports; `openRoute`; the `<DayAgenda …/>` call)
- Delete: `src/components/mobile/sheets/EventDetailSheet.tsx`, `src/components/mobile/sheets/__tests__/EventDetailSheet.test.tsx`, `src/components/mobile/sheets/__tests__/EventDetailSheet.showSubject.test.tsx`
- Modify: `src/store/types.ts:440`, `src/components/mobile/sheets/SheetHost.tsx` (import + case), `src/i18n/locales/cs.json` + `en.json` (`mobile.sheet.showSubject`), `src/test/guards/desktopHasNoShowOnMap.test.ts:31`, `src/components/mobile/screens/ProfileScreen.tsx:34-37`, `src/utils/localizedLesson.ts:11`

**Interfaces:**
- Consumes: `subjectSheetFor`, `roomCodeFor` (Task 1); `DayAgendaProps` (Task 2).

- [ ] **Step 1: Rewire `CalendarScreen`**

Add to the imports (after the `toIso` import):

```ts
import { roomCodeFor, subjectSheetFor } from '../../../utils/mobile/lessonActions';
```

Replace `openRoute`:

```ts
  const openRoute = () => {
    if (!nowNext?.next) return;
    setMobileTab('map');
    focusRoomByCode(roomCodeFor(nowNext.next));
  };
```

Replace the `<DayAgenda …/>` element (the one with the `onOpenEvent` prop and its two-line comment) with:

```tsx
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
```

- [ ] **Step 2: Delete the sheet and its tests**

```bash
git rm src/components/mobile/sheets/EventDetailSheet.tsx src/components/mobile/sheets/__tests__/EventDetailSheet.test.tsx src/components/mobile/sheets/__tests__/EventDetailSheet.showSubject.test.tsx
```

- [ ] **Step 3: Remove the sheet kind and the host case**

In `src/store/types.ts` delete the line:

```ts
  | { kind: 'eventDetail'; eventId: string; dayIso?: string }
```

In `src/components/mobile/sheets/SheetHost.tsx` delete the import line `import { EventDetailSheet } from './EventDetailSheet';` and the two lines:

```tsx
          case 'eventDetail':
            return <EventDetailSheet key={index} sheet={sheet} onClose={popSheet} />;
```

- [ ] **Step 4: Locale key**

In `src/i18n/locales/en.json` under `"mobile"."sheet"`, change:

```json
      "navigateToRoom": "Show {room} on the map",
      "showSubject": "Open subject"
    },
```

to:

```json
      "navigateToRoom": "Show {room} on the map"
    },
```

In `src/i18n/locales/cs.json` under `"mobile"."sheet"`, change:

```json
      "navigateToRoom": "Ukázat {room} na mapě",
      "showSubject": "Ukázat předmět"
    },
```

to:

```json
      "navigateToRoom": "Ukázat {room} na mapě"
    },
```

- [ ] **Step 5: Move the guard's phone allowlist entry**

In `src/test/guards/desktopHasNoShowOnMap.test.ts`, change:

```ts
  it.each([
    'components/mobile/sheets/EventDetailSheet.tsx',
    'components/CampusMap/EventComposer.tsx',
  ])('%s still does', (file) => {
```

to:

```ts
  it.each([
    'components/mobile/screens/calendar/AgendaEvent.tsx',
    'components/CampusMap/EventComposer.tsx',
  ])('%s still does', (file) => {
```

and in the doc comment above, change `The phone sheet keeps its button (a sheet has\n * room for it, and touch has no hover affordance to replace it)` to `The phone keeps its button — a pin on every agenda row, since\n * touch has no hover affordance to replace it —`.

- [ ] **Step 6: Two stale comments**

`src/components/mobile/screens/ProfileScreen.tsx`, replace:

```
 * `HiddenItemsSection` is the same component the desktop sidebar profile
 * uses, so an event `EventDetailSheet` hides shows up here already —
 * restoring it calls the same `unhideEvent` action that removes it from the
 * store's `hiddenItems`.
```

with:

```
 * `HiddenItemsSection` is the same component the desktop sidebar profile
 * uses, so a hidden event shows up here already — restoring it calls the same
 * `unhideEvent` action that removes it from the store's `hiddenItems`.
```

`src/utils/localizedLesson.ts:11`, change `` Shared by mobile (`AgendaEvent`, `NowNextCard`, `EventDetailSheet`) `` to `` Shared by mobile (`AgendaEvent`, `NowNextCard`) ``.

- [ ] **Step 7: Types, the whole suite, lint on touched files**

```bash
npx tsc -b && npx vitest run && npx eslint src/components/mobile/screens/calendar src/components/mobile/screens/CalendarScreen.tsx src/components/mobile/sheets/SheetHost.tsx src/utils/mobile/lessonActions.ts src/test/guards/desktopHasNoShowOnMap.test.ts
```

Expected: `tsc` silent; vitest `Test Files N passed | 1 skipped` with **no** failures (two files fewer than before — the deleted sheet tests); eslint silent for the listed files. `grep -rn "eventDetail\|EventDetailSheet" src` must print nothing.

- [ ] **Step 8: Commit**

```bash
git add -A src
git commit -m "feat(calendar): tap a lesson, land in the subject; EventDetailSheet goes

Room · time · teacher were already on the row. The sheet's two buttons are
now the row (subject) and a pin on its right (map). The phone allowlist
in the show-on-map guard moves to the row.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Look at it

**Files:** none.

- [ ] **Step 1: Run the UI verification**

Invoke the `verify-ui` skill on the calendar screen with a seeded day of lessons — at least one long course name ("Studijní průvodce stavebnice Arduino logické obvody pro denní studium" length) and one exam row — at 320, 390 and 430. What must hold: the pin does not push the title into earlier truncation than before on the 390 row; the pin's hit area is ≥44×44; no horizontal overflow; contrast of the pin against each of the three card tints passes in both themes.

- [ ] **Step 2: Fix and re-verify, or stop**

If the 320 row truncates the course name to under ~12 characters, drop the pin's `pr-1` and the main button's `pr-1` (reclaim 8px) and re-run. Do not shrink the pin below `min-w-11`. Commit any fix as `fix(calendar): …` with the co-author trailer.

---

## Self-review

- **Spec coverage:** row tap → `subjectDrawer` (Task 2/3); pin on the right, `min-h-11`, `showOnMap` label, stop propagation (Task 2); div + two sibling buttons (Task 2, asserted by the third test); no lookup — the lesson is in hand (Task 1 + Task 3 comment); `AgendaEventProps`/`DayAgendaProps` shapes (Task 2); handlers built in `CalendarScreen` (Task 3); every removal in the spec's "Removed" list (Task 3 Steps 2–4, 6); guard allowlist move (Step 5); `ProfileScreen` comment (Step 6); exams included (nothing special-cases `isExam`); verify-ui (Task 4). The spec's "CalendarScreen wiring test" is delivered as `lessonActions.test.ts` (Task 1) — the screen calls those two functions directly, and its four existing `CalendarScreen.*.test.tsx` files still exercise the render.
- **Placeholders:** none.
- **Type consistency:** `onOpenSubject/onShowOnMap` are `() => void` on the row and `(lesson: BlockLesson) => void` on `DayAgenda` — Task 2 Step 4 adapts between them. `subjectSheetFor` returns the `subjectDrawer` member of `MobileSheet`, which is what `pushSheet` takes.
