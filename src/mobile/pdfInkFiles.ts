import { logError } from '../utils/reportError';
import { pdfPath, readIndex, store, type PdfCacheFs, type PdfCacheIndex } from './pdfCache';

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
  /** Whose files these are; index entries of other subjects are ignored. */
  courseCode: string;
  now(): number;
}

/**
 * The tapped file first, then the rest of the subject in list order, then the
 * KEPT files. One index read for the lot; a copy counts as cached only when its
 * date still matches.
 *
 * Kept files are this subject's copies that are on the device but no longer in
 * the list IS gave us — a document the teacher removed, a folder that vanished
 * at the end of the semester, or a listing that simply did not sync. Reaching
 * them would otherwise depend on IS still serving them, which is exactly the
 * thing the device copy exists to survive. They go LAST and never interleaved:
 * everything above them is the drawer's order, and a kept file is precisely one
 * the drawer no longer has.
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
  for (const kept of await keptFiles(deps, index, new Set(ordered.map((f) => f.link)))) {
    entries.push(kept);
  }
  return entries;
}

/**
 * Index entries of this subject whose link is not in the listing. Entries
 * written before 5.1.1 carry no `courseCode`/`link` and cannot be placed, so
 * they simply do not appear until the file is opened once more.
 */
async function keptFiles(
  deps: PdfInkFileDeps,
  index: PdfCacheIndex,
  listed: Set<string>
): Promise<PdfInkFileEntry[]> {
  const kept: PdfInkFileEntry[] = [];
  for (const [key, entry] of Object.entries(index)) {
    const link = entry.link;
    if (!link || entry.courseCode !== deps.courseCode || listed.has(link)) continue;
    if (!(await deps.fs.exists(pdfPath(key)))) continue;
    kept.push({
      link,
      name: entry.name,
      date: entry.date,
      pdfPath: await deps.fs.uri(pdfPath(key)),
      inkPath: await deps.inkUri(key),
    });
  }
  return kept;
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
      await store(
        deps.fs,
        key,
        blob,
        { date: file.date, name: file.name, courseCode: deps.courseCode, link: file.link },
        deps.now()
      );
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
