import { renderHook, act } from '@testing-library/react';
import { useFileActions } from './useFileActions';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('jszip', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      file: vi.fn(),
      generateAsync: vi.fn().mockResolvedValue(new Blob(['test-zip-content'])),
      files: { 'file1.pdf': {}, 'file2.pdf': {} },
    })),
  };
});

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

vi.mock('../../utils/fileUrl', () => ({
  normalizeFileUrl: vi.fn((url) => url),
}));

vi.mock('../../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock requestQueue - use vi.mock without outer variables to avoid hoisting issues
vi.mock('../../utils/requestQueue', () => ({
  requestQueue: {
    add: vi.fn((fn) => fn()),
  },
}));

import { requestQueue } from '../../utils/requestQueue';

describe('useFileActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: async () => new Blob(['test content']),
      headers: new Map([['content-disposition', 'attachment; filename="test.pdf"']]),
    });
  });

  it('should track progress during downloadZip', async () => {
    const { result } = renderHook(() => useFileActions());
    const fileLinks = ['link1', 'link2', 'link3'];

    await act(async () => {
      await result.current.downloadZip(fileLinks, 'test.zip');
    });

    expect(result.current.isDownloading).toBe(false);
    expect(result.current.downloadProgress).toBe(null);
    expect(requestQueue.add).toHaveBeenCalledTimes(3);
  });

  it('should retry once on 500 error', async () => {
    const { result } = renderHook(() => useFileActions());

    // Mock fail then success
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['ok']), headers: new Map() }) // retry success
      .mockResolvedValueOnce({ ok: true, blob: async () => new Blob(['ok2']), headers: new Map() }); // second file success

    await act(async () => {
      await result.current.downloadZip(['f1', 'f2'], 'test.zip');
    });

    // 3 calls total: 2 for first file (fail + retry), 1 for second file
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });
  describe('fetchPdfBlob / openPdfInline', () => {
    it('fetchPdfBlob returns the bytes with credentials, null when IS refuses', async () => {
      const { result } = renderHook(() => useFileActions());
      const blob = await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf');
      expect(blob).toBeInstanceOf(Blob);
      expect(global.fetch).toHaveBeenCalledWith('https://is.mendelu.cz/x.pdf', {
        credentials: 'include',
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
      expect(await result.current.fetchPdfBlob('https://is.mendelu.cz/x.pdf')).toBeNull();
    });

    it('openPdfInline is fetchPdfBlob plus a blob URL', async () => {
      URL.createObjectURL = vi.fn(() => 'blob:one');
      const { result } = renderHook(() => useFileActions());
      expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBe('blob:one');
      expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false });
      expect(await result.current.openPdfInline('https://is.mendelu.cz/x.pdf')).toBeNull();
    });
  });
});
