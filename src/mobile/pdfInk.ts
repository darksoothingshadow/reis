import { logError } from '../utils/reportError';
import {
  enforceCap,
  forget,
  pdfPath,
  recordOpen,
  resolve,
  store,
  type PdfCacheFs,
} from './pdfCache';

/**
 * The JS half of the `PdfInk` plugin (native/capacitor-pdf-ink): types, the
 * cache key, and the one sequence that opens a subject PDF in the native
 * PencilKit reader. Pure — every side effect comes in through `deps`, so the
 * whole decision tree is unit-tested; pdfInkNative.ts wires the real plugin and
 * Capacitor's Filesystem.
 */

/** Alert copy for a failed save, translated by the app (mobile.pdfInk.*). */
export interface PdfInkStrings {
  saveFailedTitle: string;
  saveFailedMessage: string;
  keepEditing: string;
  discard: string;
}

export interface PdfInkPlugin {
  /** True only on an iPad running iPadOS 16 or newer. */
  isAvailable(): Promise<{ available: boolean }>;
  /** Presents the reader; resolves on Done. Rejects with `code: 'unreadable'` if PDFKit cannot open the file. */
  open(o: {
    pdfPath: string;
    inkPath: string;
    title: string;
    strings: PdfInkStrings;
  }): Promise<{ hasInk: boolean }>;
}

export interface OpenPdfWithInkDeps {
  plugin: Pick<PdfInkPlugin, 'open'>;
  fs: PdfCacheFs;
  /** file:// URI of the ink archive for a key (Library, backed up — ink is irreplaceable). */
  inkUri(key: string): Promise<string>;
  now(): number;
}

export interface OpenPdfWithInkInput {
  courseCode: string;
  fileLink: string;
  name: string;
  /** IS's document date from the file listing; '' when unknown (then no copy is ever fresh). */
  date: string;
  strings: PdfInkStrings;
  /** null means IS served a viewer page, not a PDF. */
  fetchPdf(): Promise<Blob | null>;
}

export type OpenPdfWithInkResult =
  | { kind: 'shown'; hasInk: boolean }
  /** PDFKit rejected the bytes; show them in the web viewer instead. */
  | { kind: 'unreadable'; blob: Blob }
  | { kind: 'notPdf' }
  | { kind: 'failed'; error: unknown };

/** Same identity string as the study notes (`courseCode:fileLink`), hashed because a URL is not a filename. */
export async function pdfInkKey(courseCode: string, fileLink: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${courseCode}:${fileLink}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function isUnreadable(e: unknown): boolean {
  return (e as { code?: unknown } | null)?.code === 'unreadable';
}

export async function openPdfWithInk(
  deps: OpenPdfWithInkDeps,
  input: OpenPdfWithInkInput
): Promise<OpenPdfWithInkResult> {
  const key = await pdfInkKey(input.courseCode, input.fileLink);
  const state = await resolve(deps.fs, key, input.date);

  let blob: Blob | null = null;
  if (state !== 'fresh') {
    try {
      blob = await input.fetchPdf();
    } catch (error) {
      if (state === 'absent') return { kind: 'failed', error };
      // Stale-if-error: IS is unreachable, but the student has a copy.
      logError('PdfInk.staleIfError', error);
    }
    if (blob) {
      await store(deps.fs, key, blob, { date: input.date, name: input.name }, deps.now());
    } else if (state === 'absent') {
      return { kind: 'notPdf' };
    }
  }

  try {
    const { hasInk } = await deps.plugin.open({
      pdfPath: await deps.fs.uri(pdfPath(key)),
      inkPath: await deps.inkUri(key),
      title: input.name,
      strings: input.strings,
    });
    await recordOpen(deps.fs, key, deps.now());
    await enforceCap(deps.fs);
    return { kind: 'shown', hasInk };
  } catch (error) {
    if (!isUnreadable(error)) return { kind: 'failed', error };
    // Bad bytes: drop the copy so the next open fetches afresh, and give the
    // web viewer the same blob when we still hold it (only a fresh copy that
    // went bad needs a second fetch).
    logError('PdfInk.unreadable', error);
    await forget(deps.fs, key);
    const fallback = blob ?? (await input.fetchPdf().catch(() => null));
    return fallback ? { kind: 'unreadable', blob: fallback } : { kind: 'failed', error };
  }
}
