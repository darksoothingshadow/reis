# Recent Files on the Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Under today's agenda on the phone calendar, a compact, dismissable strip of the PDFs last opened in the iPad reader, each row reopening its file from the device's cache in one tap.

**Architecture:** A pure selector (`utils/mobile/recentPdfs.ts`) turns the existing cache index into a sorted, filtered list; a new Zustand slice (`createRecentPdfsSlice`) owns that list plus a persisted `dismissed` map and refreshes it at boot, after every reader open, and when the calendar tab is shown; a `RecentFilesStrip` component renders it; a small hook (`useRecentPdfOpen`) reopens a row through the existing `openPdfWithInk`, with the subject's other cached files as the sidebar. No new persistence format: the index is read as-is, `dismissed` goes in IndexedDB's `meta` store like the search recents do.

**Tech Stack:** React 18 + TypeScript, Zustand slices, `IndexedDBService` (`meta` store), Capacitor Filesystem via `capacitorPdfCacheFs`, vitest + @testing-library/react.

**Spec:** `docs/superpowers/specs/2026-09-07-recent-files-on-calendar-design.md`

## Global Constraints

- Today only: the strip renders only when `selectedIso === toIso(new Date())`.
- Dismiss hides from the strip only — never touches the PDF copy or the ink.
- Entries without `courseCode` or `link` (pre-5.1.1) are filtered out, never faked.
- A file shows when `lastOpenedAt > (dismissed[key] ?? 0)`; cap 5 rows.
- No `useEffect` data fetching in components; the strip reads the slice. All state in the slice.
- Nothing native on web/iPhone/Android: every refresh starts with `isPdfInkAvailable()`.
- Locale keys in BOTH `cs.json` and `en.json` (`mobileKeys.test.ts` enforces parity under `mobile.*`). Copy: cs `Naposledy otevřené`, en `Recently opened`.
- DaisyUI/Tailwind only; muted text at `/70`; touch targets `min-h-11`; the strip lives INSIDE the agenda scroller, under the agenda, above `MenuCard`.
- Max 200 lines per file — `usePdfPreview.ts` is at ~200, so its ink-strings block is extracted rather than grown.
- Tests: `npx vitest run <path>`; `npx tsc -b`; the `verify-ui` skill at 320/390/430.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Branch from `test`, PR based on `test`. Ship AFTER the calendar-lesson plan or rebase over it — both touch `CalendarScreen.tsx`.

---

### Task 1: The selector (test first)

**Files:**
- Create: `src/utils/mobile/recentPdfs.ts`
- Test: `src/utils/mobile/__tests__/recentPdfs.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface RecentPdf { key: string; courseCode: string; link: string; name: string; date: string; lastOpenedAt: number }
  export const RECENT_PDFS_LIMIT = 5;
  export function listablePdfs(index: PdfCacheIndex): RecentPdf[]          // has courseCode+link, sorted lastOpenedAt desc
  export function visibleRecentPdfs(all: RecentPdf[], dismissed: Record<string, number>, limit?: number): RecentPdf[]
  ```
- Consumes: `PdfCacheIndex`, `PdfCacheEntry` from `src/mobile/pdfCache.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/mobile/__tests__/recentPdfs.test.ts
import { describe, it, expect } from 'vitest';
import type { PdfCacheIndex } from '../../../mobile/pdfCache';
import { listablePdfs, visibleRecentPdfs, RECENT_PDFS_LIMIT } from '../recentPdfs';

function entry(name: string, lastOpenedAt: number, identity = true) {
  return {
    date: '12. 3. 2026',
    bytes: 1,
    name,
    lastOpenedAt,
    ...(identity ? { courseCode: 'EBC-AP', link: `https://is/${name}` } : {}),
  };
}

describe('listablePdfs', () => {
  it('sorts most recently opened first and carries the key', () => {
    const index: PdfCacheIndex = { a: entry('A', 10), b: entry('B', 30), c: entry('C', 20) };
    expect(listablePdfs(index).map((p) => [p.key, p.name])).toEqual([
      ['b', 'B'],
      ['c', 'C'],
      ['a', 'A'],
    ]);
  });

  it('drops entries that cannot be reopened from the device (no courseCode/link, pre-5.1.1)', () => {
    const index: PdfCacheIndex = { old: entry('Old', 99, false), fresh: entry('Fresh', 1) };
    expect(listablePdfs(index).map((p) => p.key)).toEqual(['fresh']);
  });
});

describe('visibleRecentPdfs', () => {
  const all = listablePdfs({
    a: entry('A', 60),
    b: entry('B', 50),
    c: entry('C', 40),
    d: entry('D', 30),
    e: entry('E', 20),
    f: entry('F', 10),
  });

  it('caps at the limit', () => {
    expect(visibleRecentPdfs(all, {})).toHaveLength(RECENT_PDFS_LIMIT);
    expect(visibleRecentPdfs(all, {}).at(-1)?.key).toBe('e');
  });

  it('hides a dismissed file and lets the next one in', () => {
    expect(visibleRecentPdfs(all, { a: 61 }).map((p) => p.key)).toEqual(['b', 'c', 'd', 'e', 'f']);
  });

  it('shows a dismissed file again once it has been opened after the dismissal', () => {
    // dismissed at 55, reopened at 60: lastOpenedAt > dismissedAt → back
    expect(visibleRecentPdfs(all, { a: 55 }).map((p) => p.key)).toContain('a');
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/utils/mobile/__tests__/recentPdfs.test.ts
```

Expected: FAIL — `Failed to resolve import "../recentPdfs"`.

- [ ] **Step 3: Implement**

```ts
// src/utils/mobile/recentPdfs.ts
import type { PdfCacheIndex } from '../../mobile/pdfCache';

/**
 * A row of the calendar's "recently opened" strip: a cached PDF the device can
 * list and reopen on its own — no IS round trip, offline included.
 */
export interface RecentPdf {
  key: string;
  courseCode: string;
  link: string;
  name: string;
  date: string;
  lastOpenedAt: number;
}

export const RECENT_PDFS_LIMIT = 5;

/**
 * Every entry the index can vouch for, newest open first. Entries written
 * before 5.1.1 have no `courseCode`/`link` and cannot be reopened from the
 * device, so they are left out rather than shown as rows that go nowhere.
 */
export function listablePdfs(index: PdfCacheIndex): RecentPdf[] {
  const rows: RecentPdf[] = [];
  for (const [key, e] of Object.entries(index)) {
    if (!e.courseCode || !e.link) continue;
    rows.push({
      key,
      courseCode: e.courseCode,
      link: e.link,
      name: e.name,
      date: e.date,
      lastOpenedAt: e.lastOpenedAt,
    });
  }
  return rows.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

/**
 * What the strip shows. A dismissal is a timestamp, not a flag: the file comes
 * back the moment it is opened again, because `recordOpen` bumps `lastOpenedAt`
 * past `dismissedAt` — no coupling to the reader needed.
 */
export function visibleRecentPdfs(
  all: RecentPdf[],
  dismissed: Record<string, number>,
  limit = RECENT_PDFS_LIMIT
): RecentPdf[] {
  return all.filter((p) => p.lastOpenedAt > (dismissed[p.key] ?? 0)).slice(0, limit);
}
```

- [ ] **Step 4: Run it, watch it pass**

```bash
npx vitest run src/utils/mobile/__tests__/recentPdfs.test.ts
```

Expected: `5 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/utils/mobile/recentPdfs.ts src/utils/mobile/__tests__/recentPdfs.test.ts
git commit -m "feat(calendar): select the recently opened PDFs from the cache index

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The slice (test first)

**Files:**
- Create: `src/store/slices/createRecentPdfsSlice.ts`
- Modify: `src/store/types.ts` (the `AppState` intersection, next to `import('./slices/createSearchSlice').SearchSlice &`)
- Modify: `src/store/useAppStore.ts` (the spread list near line 77; the boot microtask near line 168)
- Test: `src/store/slices/__tests__/createRecentPdfsSlice.test.ts`

**Interfaces:**
- Produces on the store:
  ```ts
  cachedPdfs: RecentPdf[];                       // every listable entry, newest first
  recentPdfs: RecentPdf[];                       // visibleRecentPdfs(cachedPdfs, dismissedRecentPdfs)
  dismissedRecentPdfs: Record<string, number>;
  refreshRecentPdfs(): Promise<void>;
  dismissRecentPdf(key: string): Promise<void>;
  ```
- Consumes: Task 1; `isPdfInkAvailable`, `capacitorPdfCacheFs` from `src/mobile/pdfInkNative.ts`; `readIndex` from `src/mobile/pdfCache.ts`; `IndexedDBService` (`meta` store, key `recent_pdfs_dismissed`).

- [ ] **Step 1: Write the failing test**

```ts
// src/store/slices/__tests__/createRecentPdfsSlice.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const idb = vi.hoisted(() => ({
  get: vi.fn(async () => null as unknown),
  set: vi.fn(async () => undefined),
}));
vi.mock('../../../services/storage', () => ({ IndexedDBService: idb }));

const native = vi.hoisted(() => ({
  available: true,
  indexJson: '{}',
}));
vi.mock('../../../mobile/pdfInkNative', () => ({
  isPdfInkAvailable: async () => native.available,
  capacitorPdfCacheFs: { readText: async () => native.indexJson },
  nativePdfInkDeps: { tag: 'native-deps' },
}));

import { useAppStore } from '../../useAppStore';

const INDEX = {
  a: { date: 'd', bytes: 1, name: 'A', lastOpenedAt: 30, courseCode: 'EBC-AP', link: 'l-a' },
  b: { date: 'd', bytes: 1, name: 'B', lastOpenedAt: 20, courseCode: 'EBC-AP', link: 'l-b' },
  old: { date: 'd', bytes: 1, name: 'Old', lastOpenedAt: 99 },
};

describe('createRecentPdfsSlice', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    native.available = true;
    native.indexJson = JSON.stringify(INDEX);
    idb.get.mockResolvedValue(null);
    useAppStore.setState({ cachedPdfs: [], recentPdfs: [], dismissedRecentPdfs: {} } as never);
  });

  it('refresh reads the index and lists what the device can reopen, newest first', async () => {
    await useAppStore.getState().refreshRecentPdfs();
    expect(useAppStore.getState().recentPdfs.map((p) => p.key)).toEqual(['a', 'b']);
    expect(useAppStore.getState().cachedPdfs).toHaveLength(2);
  });

  it('refresh hydrates the persisted dismissals and applies them', async () => {
    idb.get.mockResolvedValue({ a: 31 });
    await useAppStore.getState().refreshRecentPdfs();
    expect(idb.get).toHaveBeenCalledWith('meta', 'recent_pdfs_dismissed');
    expect(useAppStore.getState().recentPdfs.map((p) => p.key)).toEqual(['b']);
  });

  it('dismiss hides the row at once and persists the timestamp', async () => {
    await useAppStore.getState().refreshRecentPdfs();
    vi.spyOn(Date, 'now').mockReturnValue(1000);

    await useAppStore.getState().dismissRecentPdf('a');

    expect(useAppStore.getState().recentPdfs.map((p) => p.key)).toEqual(['b']);
    expect(idb.set).toHaveBeenCalledWith('meta', 'recent_pdfs_dismissed', { a: 1000 });
  });

  it('does nothing where there is no native reader', async () => {
    native.available = false;
    await useAppStore.getState().refreshRecentPdfs();
    expect(useAppStore.getState().recentPdfs).toEqual([]);
    expect(idb.get).not.toHaveBeenCalled();
  });

  it('keeps a dismissal made while a refresh was in flight', async () => {
    let release!: (v: unknown) => void;
    idb.get.mockReturnValueOnce(new Promise((r) => (release = r)));
    const refreshing = useAppStore.getState().refreshRecentPdfs();
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    await useAppStore.getState().dismissRecentPdf('a');
    release({}); // the stored map predates the dismissal
    await refreshing;

    expect(useAppStore.getState().dismissedRecentPdfs).toEqual({ a: 1000 });
    expect(useAppStore.getState().recentPdfs.map((p) => p.key)).toEqual(['b']);
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/store/slices/__tests__/createRecentPdfsSlice.test.ts
```

Expected: FAIL — `useAppStore.getState().refreshRecentPdfs is not a function`.

- [ ] **Step 3: Write the slice**

```ts
// src/store/slices/createRecentPdfsSlice.ts
import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { readIndex } from '../../mobile/pdfCache';
import { capacitorPdfCacheFs, isPdfInkAvailable } from '../../mobile/pdfInkNative';
import { listablePdfs, visibleRecentPdfs, type RecentPdf } from '../../utils/mobile/recentPdfs';

export interface RecentPdfsSlice {
  /** Every cached PDF the device can list and reopen, newest open first. */
  cachedPdfs: RecentPdf[];
  /** What the calendar's strip shows: `cachedPdfs` minus dismissals, capped. */
  recentPdfs: RecentPdf[];
  /** key → when it was dismissed. A later open outranks it (see visibleRecentPdfs). */
  dismissedRecentPdfs: Record<string, number>;
  refreshRecentPdfs: () => Promise<void>;
  dismissRecentPdf: (key: string) => Promise<void>;
}

const DISMISSED_KEY = 'recent_pdfs_dismissed';

function mergeDismissed(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out = { ...b };
  for (const [key, at] of Object.entries(a)) out[key] = Math.max(out[key] ?? 0, at);
  return out;
}

function isDismissedRecord(v: unknown): v is Record<string, number> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v as object).every((n) => typeof n === 'number')
  );
}

/**
 * The "recently opened" strip's state. Reads the iPad reader's cache index —
 * the same `index.json` the reader writes — rather than keeping a second log,
 * so nothing here can disagree with what the reader knows. Refreshed at boot,
 * after every reader open, and whenever the calendar tab is shown.
 *
 * Native-only by construction: every refresh starts with `isPdfInkAvailable()`,
 * which is false on web, iPhone and Android, where there is neither an index
 * nor a reader to reopen a row.
 */
export const createRecentPdfsSlice: AppSlice<RecentPdfsSlice> = (set, get) => ({
  cachedPdfs: [],
  recentPdfs: [],
  dismissedRecentPdfs: {},

  refreshRecentPdfs: async () => {
    try {
      if (!(await isPdfInkAvailable())) return;
      const [index, stored] = await Promise.all([
        readIndex(capacitorPdfCacheFs),
        IndexedDBService.get('meta', DISMISSED_KEY),
      ]);
      // Merge, newest timestamp wins: a dismissal made while this read was in
      // flight is only in memory, and taking the stored map alone would undo
      // it until the next refresh.
      const dismissed = mergeDismissed(
        get().dismissedRecentPdfs,
        isDismissedRecord(stored) ? stored : {}
      );
      const cachedPdfs = listablePdfs(index);
      set({
        cachedPdfs,
        dismissedRecentPdfs: dismissed,
        recentPdfs: visibleRecentPdfs(cachedPdfs, dismissed),
      });
    } catch (error) {
      logError('RecentPdfsSlice.refreshRecentPdfs', error);
    }
  },

  dismissRecentPdf: async (key) => {
    const dismissed = { ...get().dismissedRecentPdfs, [key]: Date.now() };
    set({ dismissedRecentPdfs: dismissed, recentPdfs: visibleRecentPdfs(get().cachedPdfs, dismissed) });
    try {
      await IndexedDBService.set('meta', DISMISSED_KEY, dismissed);
    } catch (error) {
      logError('RecentPdfsSlice.dismissRecentPdf', error);
    }
  },
});
```

- [ ] **Step 4: Register the slice**

`src/store/types.ts` — in the `AppState` intersection, directly after the line `import('./slices/createSearchSlice').SearchSlice &`, add:

```ts
  import('./slices/createRecentPdfsSlice').RecentPdfsSlice &
```

`src/store/useAppStore.ts` — add the import beside the other slice imports:

```ts
import { createRecentPdfsSlice } from './slices/createRecentPdfsSlice';
```

and directly after the line `...createSearchSlice(...a),` add:

```ts
  ...createRecentPdfsSlice(...a),
```

In the boot microtask, directly after `s2.loadRecentSearches();` add:

```ts
    s2.refreshRecentPdfs();
```

- [ ] **Step 5: Refresh when the calendar tab is shown**

`src/store/slices/createMobileUiSlice.ts` today reads (line 14 and line 48):

```ts
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set) => ({
…
  setMobileTab: (tab) => set({ mobileTab: tab, mobileSheets: [] }),
```

Change the creator's signature to take `get` and give `setMobileTab` a block body:

```ts
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set, get) => ({
…
  setMobileTab: (tab) => {
    set({ mobileTab: tab, mobileSheets: [] });
    // A file opened from the Subjects tab should be in the calendar's
    // "recently opened" strip by the time the student gets there.
    if (tab === 'calendar') void get().refreshRecentPdfs();
  },
```

- [ ] **Step 6: Run the slice tests and the mobile-ui slice tests, then types**

```bash
npx vitest run src/store/slices/__tests__/createRecentPdfsSlice.test.ts src/store/slices/__tests__/createMobileUiSlice.test.ts && npx tsc -b
```

Expected: `5 passed` for the new file, the mobile-ui file still green, `tsc` silent.

- [ ] **Step 7: Commit**

```bash
git add src/store/slices/createRecentPdfsSlice.ts src/store/slices/__tests__/createRecentPdfsSlice.test.ts src/store/types.ts src/store/useAppStore.ts src/store/slices/createMobileUiSlice.ts
git commit -m "feat(store): recentPdfs slice — the cache index as a list, with dismissals

Read at boot, after each reader open, and when the calendar tab is shown.
Dismissals are timestamps in the meta store; a later open outranks one.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Extract the ink strings hook, and refresh after every reader open

**Files:**
- Create: `src/hooks/ui/usePdfInkStrings.ts`
- Modify: `src/hooks/ui/usePdfPreview.ts` (remove the `inkStrings` block; call the hook; refresh after `openPdfWithInk`)
- Test: `src/hooks/ui/__tests__/usePdfPreview.test.tsx` (one added case)

**Interfaces:**
- Produces: `usePdfInkStrings(): () => PdfInkStrings` — a memoised builder, identical output to today's `inkStrings()`.
- Consumes: Task 2's `refreshRecentPdfs` on the store.

- [ ] **Step 1: Add the failing test case**

Append inside the `describe('usePdfPreview', …)` block of `src/hooks/ui/__tests__/usePdfPreview.test.tsx`:

```tsx
  it('refreshes the recently-opened list after the native reader closes', async () => {
    isPdfInkAvailable.mockResolvedValue(true);
    openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: false });
    const refreshRecentPdfs = vi.fn(async () => undefined);
    useAppStore.setState({ refreshRecentPdfs } as never);

    const { result } = renderHook(() => usePdfPreview('EBC-AP'));
    await act(async () => void (await result.current.viewPdf('/x.pdf', { name: 'Notes' })));

    expect(refreshRecentPdfs).toHaveBeenCalledTimes(1);
  });
```

and add to the file's imports (after `import { usePdfPreview } from '../usePdfPreview';`):

```ts
import { useAppStore } from '../../../store/useAppStore';
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/hooks/ui/__tests__/usePdfPreview.test.tsx
```

Expected: the new case FAILS with `expected "spy" to be called 1 times, but got 0 times`; every other case passes.

- [ ] **Step 3: Extract the strings hook**

```ts
// src/hooks/ui/usePdfInkStrings.ts
import { useCallback } from 'react';
import { useTranslation } from '../useTranslation';
import type { PdfInkStrings } from '../../mobile/pdfInk';

/**
 * The copy the native iPad reader shows, translated here and handed over on
 * `open`. One place, because two hooks open the reader now — the file drawer's
 * `usePdfPreview` and the calendar strip's `useRecentPdfOpen` — and the
 * `mobileKeys` guard only helps if both ask for the same keys.
 */
export function usePdfInkStrings(): () => PdfInkStrings {
  const { t } = useTranslation();
  return useCallback(
    (): PdfInkStrings => ({
      saveFailedTitle: t('mobile.pdfInk.saveFailedTitle'),
      saveFailedMessage: t('mobile.pdfInk.saveFailedMessage'),
      keepEditing: t('mobile.pdfInk.keepEditing'),
      discard: t('mobile.pdfInk.discard'),
      openFailed: t('mobile.pdfInk.openFailed'),
      addPage: t('mobile.pdfInk.addPage'),
      export: t('mobile.pdfInk.export'),
      exportFailed: t('mobile.pdfInk.exportFailed'),
      close: t('common.close'),
      pages: t('mobile.pdfInk.pages'),
      search: t('mobile.pdfInk.search'),
      page: t('mobile.pdfInk.page'),
      noMatches: t('mobile.pdfInk.noMatches'),
      removePage: t('mobile.pdfInk.removePage'),
      cancel: t('common.cancel'),
    }),
    [t]
  );
}
```

- [ ] **Step 4: Use it in `usePdfPreview`, and refresh after the reader**

In `src/hooks/ui/usePdfPreview.ts`:

Replace the import line `import { openPdfWithInk, type PdfInkStrings } from '../../mobile/pdfInk';` with:

```ts
import { openPdfWithInk } from '../../mobile/pdfInk';
import { usePdfInkStrings } from './usePdfInkStrings';
import { useAppStore } from '../../store/useAppStore';
```

Delete the whole `const inkStrings = useCallback(…)` block (from `const inkStrings = useCallback(` through its closing `);` and the blank line after) and in its place put:

```ts
  const inkStrings = usePdfInkStrings();
```

In `tryNativeReader`, directly after the `const result = await openPdfWithInk(nativePdfInkDeps, { … });` statement (after its closing `});`), add:

```ts
      // The reader has closed by now (open resolves on Close) and the index has
      // the new lastOpenedAt: the calendar's strip should show this file.
      void useAppStore.getState().refreshRecentPdfs();
```

- [ ] **Step 5: Run the hook tests, then types**

```bash
npx vitest run src/hooks/ui/__tests__/usePdfPreview.test.tsx && npx tsc -b && wc -l src/hooks/ui/usePdfPreview.ts
```

Expected: all cases pass including the new one; `tsc` silent; the line count is under 200.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/ui/usePdfInkStrings.ts src/hooks/ui/usePdfPreview.ts src/hooks/ui/__tests__/usePdfPreview.test.tsx
git commit -m "refactor(pdf ink): the reader's strings in one hook; refresh recents after each open

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Reopen a row — `useRecentPdfOpen` (test first)

**Files:**
- Create: `src/hooks/ui/useRecentPdfOpen.ts`
- Test: `src/hooks/ui/__tests__/useRecentPdfOpen.test.tsx`

**Interfaces:**
- Produces: `useRecentPdfOpen(): { openRecentPdf(row: RecentPdf): Promise<void>; isOpening: boolean }`.
- Consumes: `RecentPdf` (Task 1); store `cachedPdfs`, `subjects`, `refreshRecentPdfs` (Task 2); `usePdfInkStrings` (Task 3); `useFileActions().fetchPdfBlob`; `openPdfWithInk`, `nativePdfInkDeps`.

- [ ] **Step 1: Write the failing test**

```tsx
// src/hooks/ui/__tests__/useRecentPdfOpen.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const fetchPdfBlob = vi.fn();
vi.mock('../useFileActions', () => ({
  useFileActions: () => ({
    openPdfInline: vi.fn(),
    fetchPdfBlob: (...a: unknown[]) => fetchPdfBlob(...a),
    openFile: vi.fn(),
    downloadSingle: vi.fn(),
    isDownloading: false,
    downloadProgress: null,
  }),
}));
vi.mock('../../../mobile/pdfInkNative', () => ({
  isPdfInkAvailable: async () => true,
  nativePdfInkDeps: { tag: 'native-deps' },
  capacitorPdfCacheFs: { readText: async () => '{}' },
}));
const openPdfWithInk = vi.fn();
vi.mock('../../../mobile/pdfInk', () => ({
  openPdfWithInk: (...a: unknown[]) => openPdfWithInk(...a),
}));
const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import { useRecentPdfOpen } from '../useRecentPdfOpen';
import { useAppStore } from '../../../store/useAppStore';
import type { RecentPdf } from '../../../utils/mobile/recentPdfs';

const row = (key: string, courseCode: string, name: string): RecentPdf => ({
  key,
  courseCode,
  link: `https://is/${key}`,
  name,
  date: '12. 3. 2026',
  lastOpenedAt: 1,
});

describe('useRecentPdfOpen', () => {
  const refreshRecentPdfs = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    openPdfWithInk.mockResolvedValue({ kind: 'shown', hasInk: false });
    useAppStore.setState({
      refreshRecentPdfs,
      subjects: null,
      cachedPdfs: [row('a', 'EBC-AP', 'A'), row('b', 'EBC-AP', 'B'), row('m', 'EBC-MAN', 'M')],
    } as never);
  });

  it("opens the row with the subject's other cached files as the sidebar, and no IS listing", async () => {
    const { result } = renderHook(() => useRecentPdfOpen());
    await act(async () => void (await result.current.openRecentPdf(row('a', 'EBC-AP', 'A'))));

    const input = openPdfWithInk.mock.calls[0]?.[1] as {
      courseCode: string;
      courseTitle: string;
      fileLink: string;
      files: { link: string }[];
    };
    expect(input.courseCode).toBe('EBC-AP');
    expect(input.fileLink).toBe('https://is/a');
    expect(input.files.map((f) => f.link).sort()).toEqual(['https://is/a', 'https://is/b']);
  });

  it('falls back to the course code for the title when the subject is not in the store', async () => {
    const { result } = renderHook(() => useRecentPdfOpen());
    await act(async () => void (await result.current.openRecentPdf(row('a', 'EBC-AP', 'A'))));
    expect((openPdfWithInk.mock.calls[0]?.[1] as { courseTitle: string }).courseTitle).toBe('EBC-AP');
  });

  it('uses the subject display name when it is known', async () => {
    useAppStore.setState({
      subjects: { data: { 'EBC-AP': { displayName: 'Architektura počítačů' } } },
    } as never);
    const { result } = renderHook(() => useRecentPdfOpen());
    await act(async () => void (await result.current.openRecentPdf(row('a', 'EBC-AP', 'A'))));
    expect((openPdfWithInk.mock.calls[0]?.[1] as { courseTitle: string }).courseTitle).toBe(
      'Architektura počítačů'
    );
  });

  it('refreshes the strip after the reader closes, and tells the student when it failed', async () => {
    openPdfWithInk.mockResolvedValue({ kind: 'failed', error: new Error('x') });
    const { result } = renderHook(() => useRecentPdfOpen());
    await act(async () => void (await result.current.openRecentPdf(row('a', 'EBC-AP', 'A'))));
    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(refreshRecentPdfs).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it, watch it fail**

```bash
npx vitest run src/hooks/ui/__tests__/useRecentPdfOpen.test.tsx
```

Expected: FAIL — `Failed to resolve import "../useRecentPdfOpen"`.

- [ ] **Step 3: Implement**

```ts
// src/hooks/ui/useRecentPdfOpen.ts
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useFileActions } from './useFileActions';
import { usePdfInkStrings } from './usePdfInkStrings';
import { useTranslation } from '../useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';
import { openPdfWithInk } from '../../mobile/pdfInk';
import { nativePdfInkDeps } from '../../mobile/pdfInkNative';
import type { RecentPdf } from '../../utils/mobile/recentPdfs';

/**
 * Reopens a "recently opened" row in the iPad reader, from the device alone.
 *
 * The drawer's `usePdfPreview` needs the subject's IS file listing for the
 * sidebar; the calendar has none. What it has is the cache index, so the
 * sidebar is every cached file of the same subject — which is exactly the set
 * the device can show without IS. Offline is the existing stale-if-error path.
 *
 * There is no web viewer here: a copy PDFKit rejects, or a link IS now serves as
 * a viewer page, is reported and left to the drawer route, which has one.
 */
export function useRecentPdfOpen() {
  const { fetchPdfBlob } = useFileActions();
  const { t } = useTranslation();
  const strings = usePdfInkStrings();
  const [isOpening, setIsOpening] = useState(false);

  const openRecentPdf = useCallback(
    async (row: RecentPdf) => {
      if (isOpening) return;
      setIsOpening(true);
      try {
        const { subjects, cachedPdfs, refreshRecentPdfs } = useAppStore.getState();
        const files = cachedPdfs
          .filter((f) => f.courseCode === row.courseCode)
          .map(({ link, name, date }) => ({ link, name, date }));
        const result = await openPdfWithInk(nativePdfInkDeps, {
          courseCode: row.courseCode,
          courseTitle: subjects?.data[row.courseCode]?.displayName ?? row.courseCode,
          fileLink: row.link,
          name: row.name,
          date: row.date,
          files,
          strings: strings(),
          fetchPdf: (target) => fetchPdfBlob(target),
        });
        if (result.kind === 'failed') logError('useRecentPdfOpen', result.error);
        if (result.kind !== 'shown') toast.error(t('course.file.openFailed'));
        await refreshRecentPdfs();
      } finally {
        setIsOpening(false);
      }
    },
    [isOpening, strings, fetchPdfBlob, t]
  );

  return { openRecentPdf, isOpening };
}
```

- [ ] **Step 4: Run it, watch it pass**

```bash
npx vitest run src/hooks/ui/__tests__/useRecentPdfOpen.test.tsx && npx tsc -b
```

Expected: `4 passed`; `tsc` silent.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/ui/useRecentPdfOpen.ts src/hooks/ui/__tests__/useRecentPdfOpen.test.tsx
git commit -m "feat(pdf ink): reopen a recent file from the device, siblings from the cache index

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The strip (test first) and its place on the screen

**Files:**
- Create: `src/components/mobile/screens/calendar/RecentFilesStrip.tsx`
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (`mobile.calendar.recentFiles`)
- Modify: `src/components/mobile/screens/CalendarScreen.tsx` (import; one element in the scroller)
- Test: `src/components/mobile/screens/calendar/__tests__/RecentFilesStrip.test.tsx`

**Interfaces:**
- Produces: `<RecentFilesStrip visible={boolean} />`.
- Consumes: store `recentPdfs`, `subjects`, `dismissRecentPdf` (Task 2); `useRecentPdfOpen` (Task 4).

- [ ] **Step 1: Locale keys**

`src/i18n/locales/en.json`, in `"mobile"."calendar"`, change:

```json
      "teachingStarts": "Teaching starts {date}"
    },
```

to:

```json
      "teachingStarts": "Teaching starts {date}",
      "recentFiles": "Recently opened"
    },
```

`src/i18n/locales/cs.json`, same block, change:

```json
      "teachingStarts": "Výuka začíná {date}"
    },
```

to:

```json
      "teachingStarts": "Výuka začíná {date}",
      "recentFiles": "Naposledy otevřené"
    },
```

- [ ] **Step 2: Write the failing test**

```tsx
// src/components/mobile/screens/calendar/__tests__/RecentFilesStrip.test.tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const openRecentPdf = vi.fn(async () => undefined);
vi.mock('../../../../../hooks/ui/useRecentPdfOpen', () => ({
  useRecentPdfOpen: () => ({ openRecentPdf, isOpening: false }),
}));

import { RecentFilesStrip } from '../RecentFilesStrip';
import { useAppStore } from '../../../../../store/useAppStore';
import type { RecentPdf } from '../../../../../utils/mobile/recentPdfs';

const row = (key: string, name: string, courseCode = 'EBC-AP'): RecentPdf => ({
  key,
  courseCode,
  link: `https://is/${key}`,
  name,
  date: '12. 3. 2026',
  lastOpenedAt: 1,
});

describe('RecentFilesStrip', () => {
  const dismissRecentPdf = vi.fn(async () => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({
      language: 'cz',
      subjects: null,
      dismissRecentPdf,
      recentPdfs: [row('a', 'Přednáška 09'), row('b', 'Skripta')],
    } as never);
  });

  it('renders nothing when the selected day is not today', () => {
    render(<RecentFilesStrip visible={false} />);
    expect(screen.queryByTestId('recent-files')).toBeNull();
  });

  it('renders nothing when there is nothing recent', () => {
    useAppStore.setState({ recentPdfs: [] } as never);
    render(<RecentFilesStrip visible />);
    expect(screen.queryByTestId('recent-files')).toBeNull();
  });

  it('lists the files under the heading, subject code as the second line', () => {
    render(<RecentFilesStrip visible />);
    expect(screen.getByText('Naposledy otevřené')).toBeInTheDocument();
    expect(screen.getByText('Přednáška 09')).toBeInTheDocument();
    expect(screen.getAllByText('EBC-AP')).toHaveLength(2);
  });

  it('tapping a row opens it and does not dismiss it', () => {
    render(<RecentFilesStrip visible />);
    fireEvent.click(screen.getByText('Skripta'));
    expect(openRecentPdf).toHaveBeenCalledWith(expect.objectContaining({ key: 'b' }));
    expect(dismissRecentPdf).not.toHaveBeenCalled();
  });

  it('the X dismisses that row and does not open it', () => {
    render(<RecentFilesStrip visible />);
    fireEvent.click(screen.getAllByRole('button', { name: 'Zavřít' })[0]!);
    expect(dismissRecentPdf).toHaveBeenCalledWith('a');
    expect(openRecentPdf).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run it, watch it fail**

```bash
npx vitest run src/components/mobile/screens/calendar/__tests__/RecentFilesStrip.test.tsx
```

Expected: FAIL — `Failed to resolve import "../RecentFilesStrip"`.

- [ ] **Step 4: Write the component**

```tsx
// src/components/mobile/screens/calendar/RecentFilesStrip.tsx
import { X } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useRecentPdfOpen } from '../../../../hooks/ui/useRecentPdfOpen';

/**
 * The files last opened in the iPad reader, one tap from the calendar.
 *
 * Both routes to a PDF (calendar → lesson → subject → file, Subjects → subject
 * → file) make the student walk the subject again to reopen the file they were
 * reading ten minutes ago. This is the way back. Today only — the cache knows
 * one `lastOpenedAt` per file, which is exactly "recent", and not "opened on a
 * given day"; for today those are the same question.
 *
 * Under the agenda, inside its scroller: on a full teaching day it must not
 * push the 8am lecture off the screen. Renders nothing off-day or when empty
 * (the slice is empty wherever there is no native reader).
 */
export function RecentFilesStrip({ visible }: { visible: boolean }) {
  const { t } = useTranslation();
  const recent = useAppStore((s) => s.recentPdfs);
  const subjects = useAppStore((s) => s.subjects);
  const dismissRecentPdf = useAppStore((s) => s.dismissRecentPdf);
  const { openRecentPdf, isOpening } = useRecentPdfOpen();

  if (!visible || recent.length === 0) return null;

  return (
    // Same card as MenuCard: a hairline on the base-200 backdrop, because a
    // base-100 surface alone is invisible there in the light theme.
    <div data-testid="recent-files" className="mt-3 flex-shrink-0 px-4">
      <div className="rounded-2xl border border-base-content/10 bg-base-100 pb-1">
        <div className="px-3.5 pt-2.5 text-xs font-bold uppercase tracking-wide text-base-content/70">
          {t('mobile.calendar.recentFiles')}
        </div>
        <ul>
          {recent.map((row) => (
            <li key={row.key} className="flex items-stretch">
              <button
                type="button"
                disabled={isOpening}
                onClick={() => void openRecentPdf(row)}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 pl-3.5 text-left"
              >
                <span className="truncate text-md font-semibold text-base-content">{row.name}</span>
                <span className="truncate text-2sm text-base-content/70">
                  {subjects?.data[row.courseCode]?.displayName ?? row.courseCode}
                </span>
              </button>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={(e) => {
                  e.stopPropagation();
                  void dismissRecentPdf(row.key);
                }}
                className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center text-base-content/70"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Put it on the screen**

`src/components/mobile/screens/CalendarScreen.tsx` — add the import after `import { MenuCard } from './calendar/MenuCard';`:

```ts
import { RecentFilesStrip } from './calendar/RecentFilesStrip';
```

Directly after `const selectedIso = mobileSelectedDayIso ?? toIso(new Date());` add:

```ts
  const isToday = selectedIso === toIso(new Date());
```

In the scroller, between the agenda/empty-day block and `<MenuCard dayIso={selectedIso} />`, add:

```tsx
        {/* Today only: the way back into the file you were reading. Below the
            agenda for the same reason MenuCard is — the timetable first. */}
        <RecentFilesStrip visible={isToday} />
```

- [ ] **Step 6: Tests, types, the calendar screen tests, lint**

```bash
npx vitest run src/components/mobile/screens/calendar/__tests__/RecentFilesStrip.test.tsx src/components/mobile/screens/__tests__ src/i18n && npx tsc -b && npx eslint src/components/mobile/screens/calendar/RecentFilesStrip.tsx src/components/mobile/screens/CalendarScreen.tsx src/hooks/ui/useRecentPdfOpen.ts src/hooks/ui/usePdfInkStrings.ts src/store/slices/createRecentPdfsSlice.ts src/utils/mobile/recentPdfs.ts
```

Expected: `5 passed` for the strip; the four `CalendarScreen.*.test.tsx` files still pass; `mobileKeys.test.ts` passes (both locales have the key); `tsc` and eslint silent.

- [ ] **Step 7: Commit**

```bash
git add src/components/mobile/screens/calendar/RecentFilesStrip.tsx src/components/mobile/screens/calendar/__tests__/RecentFilesStrip.test.tsx src/components/mobile/screens/CalendarScreen.tsx src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(calendar): today's recently opened files under the agenda, one tap back in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Full suite, then look at it

**Files:** none (verification), plus any `fix(calendar): …` commits it forces.

- [ ] **Step 1: Everything**

```bash
npx vitest run && npx tsc -b
```

Expected: no failures; the count is the previous total plus 18 new cases (5 + 4 + 1 + 4 + 5 − 1 counted in Task 3's file).

- [ ] **Step 2: UI verification**

Invoke the `verify-ui` skill on the calendar screen at 320/390/430, with store state seeded to five `recentPdfs` rows (one with a long name — 60+ characters — and one whose `courseCode` has no subject in the store) AND a full teaching day (four lessons). Must hold: the first lesson is on screen without scrolling; the strip's rows are ≥44px tall; no horizontal overflow; the `/70` texts pass contrast on `bg-base-100` in both themes; the X is 44×44.

- [ ] **Step 3: On the simulator, the real thing**

Build and install on the iPad simulator, open any subject PDF from the drawer, close it, return to the calendar tab: the file must appear in the strip. Tap it: the reader opens with the subject's cached files in the sidebar and no IS listing fetch. Tap the X: the row goes; open the same file from the drawer again: the row is back.

```bash
npm run cap:sync 2>&1 | tail -3
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'id=32B6CB7C-756A-4803-AC49-292E1CA8D495' -derivedDataPath /tmp/reis-pdfink-sim-dd build 2>&1 | grep -E "error:|\*\* BUILD" | tail -3
xcrun simctl install 32B6CB7C-756A-4803-AC49-292E1CA8D495 /tmp/reis-pdfink-sim-dd/Build/Products/Debug-iphonesimulator/App.app && xcrun simctl launch --terminate-running-process 32B6CB7C-756A-4803-AC49-292E1CA8D495 cz.reis.app
```

Before trusting a screenshot, `xcrun simctl listapps 32B6CB7C-756A-4803-AC49-292E1CA8D495 | grep -c pdfinkharness` — if that is not 0, a stale harness app is installed and can intercept taps; `xcrun simctl uninstall 32B6CB7C-756A-4803-AC49-292E1CA8D495 cz.reis.pdfinkharness` first.

---

## Self-review

- **Spec coverage:** selector + filters + cap (Task 1); slice shape, `meta` persistence, boot refresh, refresh after open (Tasks 2–3), refresh on calendar tab (Task 2 Step 5 — an addition the spec's "somewhere you return to" needs for the Subjects-tab route; noted here); native-only guard (Task 2); strip placement, header copy, row anatomy, dismiss X with `common.close`, `stopPropagation` (Task 5); `openRecent` with cached siblings and the `displayName ?? courseCode` title (Task 4); every test the spec lists (Tasks 1, 2, 4, 5) plus the `usePdfPreview` refresh case (Task 3); verify-ui with five rows + full day (Task 6).
- **Deviation from the spec, stated:** the spec named `getSubject(courseCode)?.name`; `SubjectInfo` has no `name` — it is `displayName` (`src/types/documents.ts:4`). The plan uses `displayName`. The spec's `t('common.close')` for the X is kept.
- **Placeholders:** none. Task 2 Step 5 quotes `setMobileTab` as it is today (`createMobileUiSlice.ts:48`) and the exact replacement.
- **Type consistency:** `RecentPdf` is defined once (Task 1) and imported everywhere else; `dismissedRecentPdfs: Record<string, number>` matches `visibleRecentPdfs`'s parameter; `openRecentPdf(row: RecentPdf)` matches the strip's call; `refreshRecentPdfs` is `() => Promise<void>` in the slice, the hook (`await`), `usePdfPreview` (`void`) and `setMobileTab` (`void`).
