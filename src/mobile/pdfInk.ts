import { logError } from '../utils/reportError';
import { enforceCap, forget, recordOpen, resolve, store, type PdfCacheFs } from './pdfCache';
import {
  buildFileEntries,
  serveFile,
  type PdfInkFileEntry,
  type SubjectPdfInput,
} from './pdfInkFiles';

/**
 * The JS half of the `PdfInk` plugin (native/capacitor-pdf-ink): types, the
 * cache key, and the one sequence that opens a subject's PDFs in the native
 * PencilKit reader. Pure — every side effect comes in through `deps`, so the
 * whole decision tree is unit-tested; pdfInkNative.ts wires the real plugin and
 * Capacitor's Filesystem.
 */

/** Copy the reader shows, translated by the app (mobile.pdfInk.*). */
export interface PdfInkStrings {
  saveFailedTitle: string;
  saveFailedMessage: string;
  keepEditing: string;
  discard: string;
  openFailed: string;
  /** The reader's "add a blank page" bar button. */
  addPage: string;
  /** The reader's share button, which exports the PDF with the ink in it. */
  export: string;
  exportFailed: string;
  /** Dismisses the export failure; the app's generic Close. */
  close: string;
}

export interface PdfInkPlugin {
  /** True only on an iPad running iPadOS 16 or newer. */
  isAvailable(): Promise<{ available: boolean }>;
  /**
   * Presents the subject space (file sidebar + reader) on `currentLink`; resolves
   * when the student closes it with every link that was displayed. Rejects with
   * `code: 'unreadable'` if PDFKit cannot open the initial file.
   */
  open(o: {
    courseTitle: string;
    currentLink: string;
    files: PdfInkFileEntry[];
    strings: PdfInkStrings;
  }): Promise<{ shown: string[] }>;
  /** Answer to a `needsFile` event. */
  deliverFile(o: { link: string; pdfPath: string }): Promise<void>;
  fileUnavailable(o: { link: string }): Promise<void>;
  addListener(
    event: 'needsFile',
    listener: (e: { link: string }) => void | Promise<void>
  ): Promise<{ remove(): Promise<void> }>;
}

export interface OpenPdfWithInkDeps {
  plugin: Pick<PdfInkPlugin, 'open' | 'deliverFile' | 'fileUnavailable' | 'addListener'>;
  fs: PdfCacheFs;
  /** file:// URI of the ink archive for a key (Library, backed up — ink is irreplaceable). */
  inkUri(key: string): Promise<string>;
  /** Whether an ink archive exists for a key; those PDFs are never swept. */
  hasInk(key: string): Promise<boolean>;
  now(): number;
}

export interface OpenPdfWithInkInput {
  courseCode: string;
  courseTitle: string;
  fileLink: string;
  name: string;
  /** IS's document date from the file listing; '' when unknown (then no copy is ever fresh). */
  date: string;
  /** Every PDF of the subject, for the sidebar. Need not include the tapped file. */
  files: SubjectPdfInput[];
  strings: PdfInkStrings;
  /** null means IS served a viewer page, not a PDF. */
  fetchPdf(link: string): Promise<Blob | null>;
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
  const keyFor = (link: string) => pdfInkKey(input.courseCode, link);
  const key = await keyFor(input.fileLink);
  const state = await resolve(deps.fs, key, input.date);

  let blob: Blob | null = null;
  if (state !== 'fresh') {
    try {
      blob = await input.fetchPdf(input.fileLink);
    } catch (error) {
      if (state === 'absent') return { kind: 'failed', error };
      // Stale-if-error: IS is unreachable, but the student has a copy.
      logError('PdfInk.staleIfError', error);
    }
    if (!blob && state === 'absent') return { kind: 'notPdf' };
  }

  // From here on every failure is the caller's `failed`: the hook must be
  // able to tell the student, so nothing below is allowed to throw past it.
  const fileDeps = {
    fs: deps.fs,
    inkUri: deps.inkUri,
    keyFor,
    courseCode: input.courseCode,
    now: deps.now,
  };
  let subscription: { remove(): Promise<void> } | null = null;
  try {
    if (blob) {
      await store(
        deps.fs,
        key,
        blob,
        {
          date: input.date,
          name: input.name,
          courseCode: input.courseCode,
          link: input.fileLink,
        },
        deps.now()
      );
    }
    const current = { link: input.fileLink, name: input.name, date: input.date };
    const entries = await buildFileEntries(fileDeps, current, input.files);
    const byLink = new Map(entries.map((e) => [e.link, e]));

    // The sidebar asks for files it does not have; each answer goes through the
    // same fetch → cache path the tapped file took.
    subscription = await deps.plugin.addListener('needsFile', async ({ link }) => {
      const file = byLink.get(link);
      const served = file
        ? await serveFile(fileDeps, file, input.fetchPdf)
        : ({ kind: 'unavailable' } as const);
      if (served.kind === 'delivered') {
        await deps.plugin.deliverFile({ link, pdfPath: served.pdfPath });
      } else {
        await deps.plugin.fileUnavailable({ link });
      }
    });

    const { shown } = await deps.plugin.open({
      courseTitle: input.courseTitle,
      currentLink: input.fileLink,
      files: entries,
      strings: input.strings,
    });
    const now = deps.now();
    for (const link of shown) {
      await recordOpen(deps.fs, await keyFor(link), now, { courseCode: input.courseCode, link });
    }
    // The sweep may not take an annotated file with it: see enforceCap.
    await enforceCap(deps.fs, undefined, deps.hasInk);
    return { kind: 'shown', hasInk: false };
  } catch (error) {
    if (!isUnreadable(error)) return { kind: 'failed', error };
    // Bad bytes: drop the copy so the next open fetches afresh, and give the
    // web viewer the same blob when we still hold it (only a fresh copy that
    // went bad needs a second fetch).
    logError('PdfInk.unreadable', error);
    await forget(deps.fs, key);
    const fallback = blob ?? (await input.fetchPdf(input.fileLink).catch(() => null));
    return fallback ? { kind: 'unreadable', blob: fallback } : { kind: 'failed', error };
  } finally {
    // Cleanup must never replace the result: a failed removal is logged, not thrown.
    await subscription?.remove().catch((e: unknown) => logError('PdfInk.removeListener', e));
  }
}
