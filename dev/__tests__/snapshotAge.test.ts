import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { formatSnapshotAge, mountSnapshotAge, badgeTop } from '../snapshotAge';
import { DEMO_BANNER_HEIGHT } from '../../src/components/mobile/toastOffset';

const NOW = new Date('2026-09-04T12:00:00.000Z');

describe('formatSnapshotAge', () => {
  it('says today for a snapshot taken this morning', () => {
    expect(formatSnapshotAge('2026-09-04T08:00:00.000Z', NOW)).toBe('data scraped today');
  });

  it('counts whole days', () => {
    expect(formatSnapshotAge('2026-09-02T08:00:00.000Z', NOW)).toBe('data scraped 2 days ago');
  });

  it('uses the singular for one day', () => {
    expect(formatSnapshotAge('2026-09-03T08:00:00.000Z', NOW)).toBe('data scraped 1 day ago');
  });

  // An unreadable date must not silently render as "today", which would be the
  // most misleading possible answer.
  it('says so when the date cannot be read', () => {
    expect(formatSnapshotAge('not-a-date', NOW)).toBe('snapshot date unknown');
  });

  // The snapshot's actual `lastSync` field is a numeric epoch-ms timestamp
  // (confirmed against public/preview-data.json), not an ISO string —
  // stringifying it first (`String(1788509744145)`) produces an Invalid
  // Date, so the function must accept the number directly.
  it('reads a numeric epoch timestamp, the shape the snapshot actually carries', () => {
    expect(formatSnapshotAge(Date.UTC(2026, 8, 2, 8, 0, 0), NOW)).toBe('data scraped 2 days ago');
  });

  // JSON.parse returns `any`, so the `string | number` annotation polices
  // nothing at runtime — a malformed snapshot can hand back any of these, and
  // `new Date(null)` / `new Date(0)` are valid, non-NaN dates that would
  // otherwise render a fabricated day count.
  it('treats null as unknown, not epoch zero', () => {
    expect(formatSnapshotAge(null, NOW)).toBe('snapshot date unknown');
  });

  it('treats undefined as unknown', () => {
    expect(formatSnapshotAge(undefined, NOW)).toBe('snapshot date unknown');
  });

  it('treats numeric 0 as unknown, not the Unix epoch', () => {
    expect(formatSnapshotAge(0, NOW)).toBe('snapshot date unknown');
  });

  it('treats an empty string as unknown', () => {
    expect(formatSnapshotAge('', NOW)).toBe('snapshot date unknown');
  });

  it('treats a negative number as unknown', () => {
    expect(formatSnapshotAge(-100, NOW)).toBe('snapshot date unknown');
  });

  it('treats a non-finite number as unknown', () => {
    expect(formatSnapshotAge(Number.POSITIVE_INFINITY, NOW)).toBe('snapshot date unknown');
    expect(formatSnapshotAge(Number.NaN, NOW)).toBe('snapshot date unknown');
  });

  it('treats a date in the future as unknown rather than a negative day count', () => {
    expect(formatSnapshotAge('2026-09-10T08:00:00.000Z', NOW)).toBe('snapshot date unknown');
  });
});

// The badge sits below `DemoBanner` using the same `--safe-top` +
// known-banner-height calculation `toastOffset.ts` already uses for the same
// problem (a top-pinned element colliding with the banner), driven by
// whether demo mode is on rather than by measuring the DOM — so it can't go
// stale if the banner unmounts, the viewport resizes, or the safe-area inset
// changes.
describe('badgeTop', () => {
  it('sits flush at the top when demo mode is off', () => {
    expect(badgeTop(false)).toBe('0px');
  });

  it('clears the banner box when demo mode is on', () => {
    const top = badgeTop(true);
    expect(top).toContain('var(--safe-top, 0px)');
    expect(top).toContain(DEMO_BANNER_HEIGHT);
  });
});

describe('mountSnapshotAge', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    // The age is counted from the real clock, so a fixture dated "two days
    // before the day this was written" became three days, then four. Two of
    // these tests had already rotted into a red CI. Pin the clock instead: the
    // point is the wording, not what today happens to be.
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows nothing outside the real-data build', () => {
    mountSnapshotAge({ VITE_PREVIEW_BUILD: 'true' }, '2026-09-04T08:00:00.000Z', true, document);
    expect(document.querySelector('[data-testid="snapshot-age"]')).toBeNull();
  });

  it('shows the age in the real-data build', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      '2026-09-02T08:00:00.000Z',
      true,
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toContain('2 days ago');
  });

  it('mounts only once', () => {
    const env = { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' };
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', true, document);
    mountSnapshotAge(env, '2026-09-04T08:00:00.000Z', true, document);
    expect(document.querySelectorAll('[data-testid="snapshot-age"]')).toHaveLength(1);
  });

  it('accepts the numeric epoch timestamp the snapshot actually carries', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      Date.UTC(2026, 8, 2, 8, 0, 0),
      true,
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toContain('2 days ago');
  });

  it('renders "snapshot date unknown" for a null lastSync instead of a fabricated day count', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      null,
      true,
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toBe('snapshot date unknown');
  });

  it('renders "snapshot date unknown" for an undefined lastSync', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      undefined,
      true,
      document
    );
    const el = document.querySelector('[data-testid="snapshot-age"]');
    expect(el?.textContent).toBe('snapshot date unknown');
  });

  // happy-dom's CSSStyleDeclaration validator silently drops `top: calc(var(...))`
  // — a real browser applies it fine (this is the same value shape
  // `toastOffset.ts` already hands to sonner), but the environment this suite
  // runs under can't round-trip it through `el.style.top`. A plain stub
  // `Document` sidesteps that limitation while still proving mountSnapshotAge
  // threads `demoMode` through to `badgeTop` and assigns the result.
  it('positions the badge to clear the banner when demo mode is on', () => {
    const created: Record<string, { style: { top: string }; dataset: Record<string, string> }> = {};
    const fakeDoc = {
      getElementById: (id: string) => created[id] ?? null,
      createElement: () => ({ style: { top: '' }, dataset: {} }),
      body: {
        appendChild: (el: { id: string }) => {
          created[el.id] = el as never;
        },
      },
    } as unknown as Document;

    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      '2026-09-04T08:00:00.000Z',
      true,
      fakeDoc
    );
    const el = created['reis-snapshot-age'];
    expect(el.style.top).toBe(badgeTop(true));
    expect(el.style.top).toContain(DEMO_BANNER_HEIGHT);
  });

  it('positions the badge flush at the top when demo mode is off', () => {
    mountSnapshotAge(
      { VITE_PREVIEW_BUILD: 'true', VITE_PREVIEW_DATA: 'real' },
      '2026-09-04T08:00:00.000Z',
      false,
      document
    );
    const el = document.getElementById('reis-snapshot-age') as HTMLElement;
    expect(el.style.top).toBe('0px');
  });
});
