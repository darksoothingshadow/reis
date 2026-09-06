import { logError } from '../utils/reportError';
import { pdfPath, readIndex, store, type PdfCacheFs } from './pdfCache';

/**
 * The sidebar half of the iPad reader's contract: which files the subject has,
 * which of them are already on the device, and serving one the reader asks for.
 * Pure like pdfInk.ts — everything reaches the outside world through `deps`.
 */

/** One row of the reader's sidebar, as the plugin receives it. */
export interface PdfInkFileEntry {
  link: string;
  name: string;
  date: string;
  /** file:// URI of the cached PDF when the copy is fresh for `date`, else null. */
  pdfPath: string | null;
  inkPath: string;
}

export interface SubjectPdfInput {
  link: string;
  name: string;
  date: string;
}

export interface PdfInkFileDeps {
  fs: PdfCacheFs;
  inkUri(key: string): Promise<string>;
  keyFor(link: string): Promise<string>;
  now(): number;
}

/**
 * The tapped file first, then the rest of the subject in list order. One index
 * read for the lot; a copy counts as cached only when its date still matches.
 */
export async function buildFileEntries(
  deps: PdfInkFileDeps,
  current: SubjectPdfInput,
  files: SubjectPdfInput[]
): Promise<PdfInkFileEntry[]> {
  const ordered = [current, ...files.filter((f) => f.link !== current.link)];
  const index = await readIndex(deps.fs);
  const entries: PdfInkFileEntry[] = [];
  for (const file of ordered) {
    const key = await deps.keyFor(file.link);
    const fresh = index[key]?.date === file.date && (await deps.fs.exists(pdfPath(key)));
    entries.push({
      link: file.link,
      name: file.name,
      date: file.date,
      pdfPath: fresh ? await deps.fs.uri(pdfPath(key)) : null,
      inkPath: await deps.inkUri(key),
    });
  }
  return entries;
}

export type ServeFileResult = { kind: 'delivered'; pdfPath: string } | { kind: 'unavailable' };

/**
 * Answer to the reader's `needsFile`: fetch, cache, hand back a path. When IS
 * cannot be reached (or serves a page instead of the file) and an older copy is
 * on the device, that copy is delivered — stale-if-error, the same as the file
 * the student tapped first. Only a file with nothing on disk is "unavailable";
 * the reader says so and keeps it in the list.
 */
export async function serveFile(
  deps: PdfInkFileDeps,
  file: SubjectPdfInput,
  fetchPdf: (link: string) => Promise<Blob | null>
): Promise<ServeFileResult> {
  const key = await deps.keyFor(file.link);
  try {
    const blob = await fetchPdf(file.link);
    if (blob) {
      await store(deps.fs, key, blob, { date: file.date, name: file.name }, deps.now());
      return { kind: 'delivered', pdfPath: await deps.fs.uri(pdfPath(key)) };
    }
  } catch (error) {
    logError('PdfInk.serveFile', error);
  }
  if (await deps.fs.exists(pdfPath(key))) {
    return { kind: 'delivered', pdfPath: await deps.fs.uri(pdfPath(key)) };
  }
  return { kind: 'unavailable' };
}
