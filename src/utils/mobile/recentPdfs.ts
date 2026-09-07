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
