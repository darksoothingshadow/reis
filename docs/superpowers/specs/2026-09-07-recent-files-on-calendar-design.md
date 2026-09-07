# Calendar: today's recent files, one tap back into the reader

**Date:** 2026-09-07 · **Scope:** mobile web tree + `src/mobile/pdfCache.ts` reads · **Approved by:** Dominik (today-only; dismiss hides from the strip only)

## The problem

Reaching a subject PDF costs three taps from either the calendar or the Subjects
tab, and both routes make the student walk the subject hierarchy again to reopen
the file they were reading ten minutes ago. The reader is somewhere you land,
never somewhere you live. The cache already knows every file's `lastOpenedAt`,
`name`, `courseCode` and `link` (`PdfCacheEntry`, written since 5.1.1) — enough
to list and reopen from the device alone, offline.

## Decisions already taken

- **Today only.** One `lastOpenedAt` per file cannot answer "opened on that
  day" for past days without a new open-event log. For today the two are the
  same thing; the strip renders only when `selectedIso` is today.
- **Dismiss hides from the strip only.** PDF copy and ink untouched; the file is
  still in the drawer. Reopening the file makes it show again.
- **Not a new event log.** Read the index that exists.

## Design

### Data — `createRecentPdfsSlice`

```ts
interface RecentPdf { key: string; courseCode: string; link: string; name: string; date: string; lastOpenedAt: number }
recentPdfs: RecentPdf[];                       // sorted desc, capped at 5, dismissed removed
dismissed: Record<string, number>;             // key → dismissedAt, persisted (IndexedDB 'recent_pdfs_dismissed')
refreshRecentPdfs(): Promise<void>;            // reads the cache index through nativePdfInkDeps.fs
dismissRecentPdf(key: string): Promise<void>;
```

- A file is shown when it has `courseCode` and `link` (entries older than 5.1.1
  have neither and cannot be reopened from the device — filtered out, not
  faked) and `lastOpenedAt > (dismissed[key] ?? 0)`. That comparison is what
  makes "reopening shows it again" true without any coupling to the reader:
  `recordOpen` bumps `lastOpenedAt` past `dismissedAt`.
- `refreshRecentPdfs` runs on boot beside `loadHiddenItems` /
  `loadRecentSearches` (`useAppStore.ts:165-168`) and after every
  `openPdfWithInk` resolves in `usePdfPreview`. No `useEffect`
  fetching in components (iron rule); the strip reads the slice synchronously.
- On web / iPhone / Android `isPdfInkAvailable()` is false and the slice stays
  empty — the strip never renders there. The index is native-only and so is
  the reader that would reopen a row.

### UI — `RecentFilesStrip`

- Placed in `CalendarScreen` directly under `DayAgenda` (or under the empty-day
  state — today with no lessons is the common case right now), above
  `MenuCard`, inside the same scroller. Renders nothing when not today or the
  list is empty.
- Header `t('mobile.calendar.recentFiles')` ("Naposledy otevřené" / "Recently
  opened" — same words the search sheet already uses for subjects).
- Compact rows, `min-h-11`: file `name` (truncate) with the subject's title (or
  `courseCode` when the subject is not in the store) as the second line; a
  dismiss `X` icon button on the right, `aria-label = t('common.close')`,
  `stopPropagation`.
- Row tap → `openRecent(row)` in `usePdfPreview`: `openPdfWithInk` with
  `courseTitle = subjects?.data[courseCode]?.displayName ?? courseCode` (`SubjectInfo` has `displayName`, not `name`)
  (the lookup `SubjectDrawerSheet.tsx:56` already uses), `files` = every
  cached entry of the same `courseCode` from the index (the sidebar shows what
  the device has), `fetchPdf` = the existing session fetch (stale-if-error
  already covers offline). Failures use the hook's existing toasts.
- DaisyUI classes only; same card tint family as `MenuCard`.

## Tests (test first)

- Slice: sorts desc, caps at 5, drops entries without `courseCode`/`link`,
  hides a dismissed key, shows it again once `lastOpenedAt` passes
  `dismissedAt`, persists `dismissed` through `IndexedDBService`.
- `RecentFilesStrip`: nothing when `selectedIso` ≠ today; nothing when empty;
  row tap calls `onOpen(row)` and not dismiss; X calls dismiss and not open.
- `usePdfPreview.openRecent`: passes the subject's cached siblings as `files`
  and falls back to `courseCode` for the title.
- `verify-ui` at 320/390/430 with 5 rows plus a full teaching day: the 8am
  lecture must stay on screen — the strip lives in the scroller, below the
  agenda, so it costs nothing above the fold.

## Out of scope

Per-day scoping (needs an open-event log). Deleting the cached copy from the
strip (a dismiss that can destroy ink is a trap). Any change to eviction.
