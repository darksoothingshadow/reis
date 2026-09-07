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
