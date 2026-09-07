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

  // Boot and the calendar tab both refresh; a dismissal in that window is only
  // in memory, and the stored map the refresh read predates it.
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
