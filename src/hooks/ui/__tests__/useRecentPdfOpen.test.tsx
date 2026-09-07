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
