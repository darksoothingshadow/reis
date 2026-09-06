import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.mock is hoisted above every `const`, so anything a factory reads at
// factory time must be hoisted with it — otherwise "Cannot access before
// initialization" (see the note in useFileActions.test.ts).
const { plugin, Filesystem } = vi.hoisted(() => ({
  plugin: { isAvailable: vi.fn(), open: vi.fn() },
  Filesystem: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
    deleteFile: vi.fn(),
    getUri: vi.fn(),
  },
}));
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => plugin),
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));
vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem,
  Directory: { Library: 'LIBRARY', LibraryNoCloud: 'LIBRARY_NO_CLOUD' },
  Encoding: { UTF8: 'utf8' },
}));

import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../../platform';
import {
  __resetPdfInkAvailabilityForTests,
  capacitorPdfCacheFs,
  isPdfInkAvailable,
  nativePdfInkDeps,
} from '../pdfInkNative';

function host(kind: 'extension' | 'capacitor' | 'web', os: 'ios' | 'android' | 'web' = 'web') {
  vi.mocked(getPlatform).mockReturnValue({ kind } as never);
  vi.mocked(Capacitor.getPlatform).mockReturnValue(os);
}

beforeEach(() => {
  vi.clearAllMocks();
  __resetPdfInkAvailabilityForTests();
});

describe('isPdfInkAvailable', () => {
  it('is false in a browser and never asks the plugin', async () => {
    host('web');
    expect(await isPdfInkAvailable()).toBe(false);
    expect(plugin.isAvailable).not.toHaveBeenCalled();
  });

  it('is false on Android without asking the plugin — there is no Android half', async () => {
    host('capacitor', 'android');
    expect(await isPdfInkAvailable()).toBe(false);
    expect(plugin.isAvailable).not.toHaveBeenCalled();
  });

  it('is whatever the iOS plugin answers (iPad + iPadOS 16 is decided natively)', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockResolvedValue({ available: true });
    expect(await isPdfInkAvailable()).toBe(true);
    __resetPdfInkAvailabilityForTests();
    plugin.isAvailable.mockResolvedValue({ available: false });
    expect(await isPdfInkAvailable()).toBe(false);
  });

  it('is false when the plugin rejects (not registered)', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockRejectedValue(new Error('"PdfInk" plugin is not implemented on ios'));
    expect(await isPdfInkAvailable()).toBe(false);
  });

  it('asks once per session', async () => {
    host('capacitor', 'ios');
    plugin.isAvailable.mockResolvedValue({ available: true });
    await isPdfInkAvailable();
    await isPdfInkAvailable();
    expect(plugin.isAvailable).toHaveBeenCalledTimes(1);
  });
});

describe('capacitorPdfCacheFs', () => {
  it('reads text from the no-cloud Library and maps a missing file to null', async () => {
    Filesystem.readFile.mockResolvedValueOnce({ data: '{"a":1}' });
    expect(await capacitorPdfCacheFs.readText('pdf-ink/index.json')).toBe('{"a":1}');
    expect(Filesystem.readFile).toHaveBeenCalledWith({
      path: 'pdf-ink/index.json',
      directory: 'LIBRARY_NO_CLOUD',
      encoding: 'utf8',
    });
    Filesystem.readFile.mockRejectedValueOnce(new Error('File does not exist'));
    expect(await capacitorPdfCacheFs.readText('pdf-ink/index.json')).toBeNull();
  });

  it('writes base64 bytes with parent directories', async () => {
    await capacitorPdfCacheFs.writeBase64('pdf-ink/k.pdf', 'QUJD');
    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: 'pdf-ink/k.pdf',
      data: 'QUJD',
      directory: 'LIBRARY_NO_CLOUD',
      recursive: true,
    });
  });

  it('answers exists from stat, and lists only files with their sizes', async () => {
    Filesystem.stat.mockRejectedValueOnce(new Error('missing'));
    expect(await capacitorPdfCacheFs.exists('pdf-ink/k.pdf')).toBe(false);
    Filesystem.stat.mockResolvedValueOnce({ type: 'file' });
    expect(await capacitorPdfCacheFs.exists('pdf-ink/k.pdf')).toBe(true);

    Filesystem.readdir.mockResolvedValueOnce({
      files: [
        { name: 'a.pdf', type: 'file', size: 10 },
        { name: 'sub', type: 'directory', size: 0 },
      ],
    });
    expect(await capacitorPdfCacheFs.list('pdf-ink')).toEqual([{ name: 'a.pdf', size: 10 }]);
    Filesystem.readdir.mockRejectedValueOnce(new Error('missing'));
    expect(await capacitorPdfCacheFs.list('pdf-ink')).toEqual([]);
  });

  it('puts PDFs in the no-cloud Library and ink in the backed-up Library', async () => {
    Filesystem.getUri.mockResolvedValue({ uri: 'file:///x' });
    await capacitorPdfCacheFs.uri('pdf-ink/k.pdf');
    expect(Filesystem.getUri).toHaveBeenLastCalledWith({
      path: 'pdf-ink/k.pdf',
      directory: 'LIBRARY_NO_CLOUD',
    });
    await nativePdfInkDeps.inkUri('k');
    expect(Filesystem.getUri).toHaveBeenLastCalledWith({
      path: 'pdf-ink/k.ink',
      directory: 'LIBRARY',
    });
  });
});
