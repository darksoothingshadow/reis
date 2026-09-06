import { blobToBase64 } from '../api/capacitorBinary';

/**
 * Where the iPad reader keeps the PDF bytes it has opened, and whether a copy is
 * still the one IS serves.
 *
 * Why cache at all: the ink then always sits on the exact bytes it was drawn on,
 * a second open is instant, and annotated slides work offline. Why here and not
 * IndexedDB: WebKit may evict a Capacitor app's IndexedDB under disk pressure;
 * files in the app's Library are not evicted. The index lives beside the files
 * so an eviction can never orphan the PDFs either.
 *
 * Pure logic over an injected `PdfCacheFs` (relative paths under the no-cloud
 * Library directory), so vitest drives it with an in-memory fake. The Capacitor
 * adapter is in pdfInkNative.ts.
 */
export const PDF_CACHE_DIR = 'pdf-ink';
export const PDF_CACHE_INDEX = `${PDF_CACHE_DIR}/index.json`;
export const PDF_CACHE_CAP_BYTES = 300 * 1024 * 1024;

export interface PdfCacheEntry {
  /** IS's document date string, stored verbatim; a re-upload changes it. */
  date: string;
  bytes: number;
  name: string;
  lastOpenedAt: number;
}
export type PdfCacheIndex = Record<string, PdfCacheEntry>;
export type PdfCacheState = 'fresh' | 'stale' | 'absent';

export interface PdfCacheFs {
  readText(path: string): Promise<string | null>;
  writeText(path: string, text: string): Promise<void>;
  writeBase64(path: string, base64: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  list(dir: string): Promise<{ name: string; size: number }[]>;
  remove(path: string): Promise<void>;
  uri(path: string): Promise<string>;
}

export function pdfPath(key: string): string {
  return `${PDF_CACHE_DIR}/${key}.pdf`;
}

export async function readIndex(fs: PdfCacheFs): Promise<PdfCacheIndex> {
  const text = await fs.readText(PDF_CACHE_INDEX);
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as PdfCacheIndex;
  } catch {
    // A corrupt index is rebuilt by the next opens; orphaned PDFs are the cap
    // sweep's job (a `.pdf` with no entry counts as least recently opened).
    return {};
  }
}

async function writeIndex(fs: PdfCacheFs, index: PdfCacheIndex): Promise<void> {
  await fs.writeText(PDF_CACHE_INDEX, JSON.stringify(index));
}

// Every change to the index is a read-modify-write of one JSON file. Two of
// them overlapping (the sidebar asking for two files in quick succession, a
// store racing the cap sweep) would each read the same index and the second
// write would drop the first's entry — leaving a PDF on disk that `resolve`
// calls stale and the sweep calls oldest. So they queue.
let indexQueue: Promise<unknown> = Promise.resolve();

function withIndex<T>(
  fs: PdfCacheFs,
  mutate: (index: PdfCacheIndex) => Promise<T> | T
): Promise<T> {
  const run = indexQueue.then(async () => {
    const index = await readIndex(fs);
    const result = await mutate(index);
    await writeIndex(fs, index);
    return result;
  });
  indexQueue = run.catch(() => undefined);
  return run;
}

export async function resolve(fs: PdfCacheFs, key: string, date: string): Promise<PdfCacheState> {
  const entry = (await readIndex(fs))[key];
  const present = await fs.exists(pdfPath(key));
  if (!entry && !present) return 'absent';
  if (entry && present && entry.date === date) return 'fresh';
  return 'stale';
}

export async function store(
  fs: PdfCacheFs,
  key: string,
  blob: Blob,
  meta: { date: string; name: string },
  now: number
): Promise<void> {
  await fs.writeBase64(pdfPath(key), await blobToBase64(blob));
  await withIndex(fs, (index) => {
    index[key] = { date: meta.date, bytes: blob.size, name: meta.name, lastOpenedAt: now };
  });
}

export async function recordOpen(fs: PdfCacheFs, key: string, now: number): Promise<void> {
  await withIndex(fs, (index) => {
    const entry = index[key];
    if (entry) index[key] = { ...entry, lastOpenedAt: now };
  });
}

/** Drop a copy PDFKit could not open, so the next open fetches afresh. */
export async function forget(fs: PdfCacheFs, key: string): Promise<void> {
  await fs.remove(pdfPath(key)).catch(() => {});
  await withIndex(fs, (index) => {
    delete index[key];
  });
}

/** Evicts least-recently-opened `.pdf` files until the total is under the cap. Returns evicted keys. */
export async function enforceCap(
  fs: PdfCacheFs,
  capBytes: number = PDF_CACHE_CAP_BYTES
): Promise<string[]> {
  const pdfs = (await fs.list(PDF_CACHE_DIR)).filter((f) => f.name.endsWith('.pdf'));
  let total = pdfs.reduce((n, f) => n + f.size, 0);
  if (total <= capBytes) return [];
  return withIndex(fs, async (index) => {
    const byAge = pdfs
      .map((f) => {
        const key = f.name.slice(0, -'.pdf'.length);
        return { ...f, key, lastOpenedAt: index[key]?.lastOpenedAt ?? 0 };
      })
      .sort((a, b) => a.lastOpenedAt - b.lastOpenedAt);
    const evicted: string[] = [];
    for (const f of byAge) {
      if (total <= capBytes) break;
      await fs.remove(`${PDF_CACHE_DIR}/${f.name}`);
      delete index[f.key];
      total -= f.size;
      evicted.push(f.key);
    }
    return evicted;
  });
}
