import { Capacitor, registerPlugin } from '@capacitor/core';
import { getPlatform } from '../platform';
import { PDF_CACHE_DIR, type PdfCacheFs } from './pdfCache';
import type { OpenPdfWithInkDeps, PdfInkPlugin } from './pdfInk';

/**
 * The real wiring for pdfInk.ts: the registered plugin and Capacitor's
 * Filesystem. Pattern: eduroamNative.ts. Kept apart from the sequencing so that
 * file stays pure and this one stays thin.
 */
const PdfInk = registerPlugin<PdfInkPlugin>('PdfInk');

let availability: Promise<boolean> | null = null;

/**
 * Can this device show the native reader? Decided once per session. The iPad /
 * iPadOS 16 test is the plugin's, never a user-agent or viewport guess (a
 * WKWebView can call itself a Macintosh). Android is answered here without a
 * call: there is no Android half, by design.
 */
export function isPdfInkAvailable(): Promise<boolean> {
  if (!availability) {
    availability = (async () => {
      if (getPlatform().kind !== 'capacitor' || Capacitor.getPlatform() !== 'ios') return false;
      try {
        return (await PdfInk.isAvailable()).available;
      } catch {
        return false;
      }
    })();
  }
  return availability;
}

export function __resetPdfInkAvailabilityForTests(): void {
  availability = null;
}

// Loaded lazily like openIsFile.ts does: the module is only ever needed on the
// native path, and the web build should not pay for it.
async function fsModule() {
  return import('@capacitor/filesystem');
}

/** PDF bytes and the index: LibraryNoCloud — refetchable, so kept out of the device backup. */
export const capacitorPdfCacheFs: PdfCacheFs = {
  async readText(path) {
    const { Filesystem, Directory, Encoding } = await fsModule();
    try {
      const { data } = await Filesystem.readFile({
        path,
        directory: Directory.LibraryNoCloud,
        encoding: Encoding.UTF8,
      });
      return typeof data === 'string' ? data : null;
    } catch {
      return null;
    }
  },
  async writeText(path, text) {
    const { Filesystem, Directory, Encoding } = await fsModule();
    await Filesystem.writeFile({
      path,
      data: text,
      directory: Directory.LibraryNoCloud,
      encoding: Encoding.UTF8,
      recursive: true,
    });
  },
  async writeBase64(path, base64) {
    const { Filesystem, Directory } = await fsModule();
    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.LibraryNoCloud,
      recursive: true,
    });
  },
  async exists(path) {
    const { Filesystem, Directory } = await fsModule();
    try {
      await Filesystem.stat({ path, directory: Directory.LibraryNoCloud });
      return true;
    } catch {
      return false;
    }
  },
  async list(dir) {
    const { Filesystem, Directory } = await fsModule();
    try {
      const { files } = await Filesystem.readdir({
        path: dir,
        directory: Directory.LibraryNoCloud,
      });
      return files.filter((f) => f.type === 'file').map((f) => ({ name: f.name, size: f.size }));
    } catch {
      return [];
    }
  },
  async remove(path) {
    const { Filesystem, Directory } = await fsModule();
    await Filesystem.deleteFile({ path, directory: Directory.LibraryNoCloud });
  },
  async uri(path) {
    const { Filesystem, Directory } = await fsModule();
    return (await Filesystem.getUri({ path, directory: Directory.LibraryNoCloud })).uri;
  },
};

export const nativePdfInkDeps: OpenPdfWithInkDeps = {
  plugin: PdfInk,
  fs: capacitorPdfCacheFs,
  // Ink is irreplaceable, so it lives in Library and rides along in the device backup.
  inkUri: async (key) => {
    const { Filesystem, Directory } = await fsModule();
    return (
      await Filesystem.getUri({ path: `${PDF_CACHE_DIR}/${key}.ink`, directory: Directory.Library })
    ).uri;
  },
  hasInk: async (key) => {
    const { Filesystem, Directory } = await fsModule();
    try {
      await Filesystem.stat({ path: `${PDF_CACHE_DIR}/${key}.ink`, directory: Directory.Library });
      return true;
    } catch {
      return false;
    }
  },
  now: () => Date.now(),
};
