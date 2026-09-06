import { describe, it, expect, vi, beforeEach } from 'vitest';
import { memFs } from './memPdfCacheFs';
import { pdfPath, readIndex, store } from '../pdfCache';
import {
  openPdfWithInk,
  pdfInkKey,
  type OpenPdfWithInkDeps,
  type OpenPdfWithInkInput,
  type PdfInkStrings,
} from '../pdfInk';

vi.mock('../../utils/reportError', () => ({ logError: vi.fn() }));

const STRINGS: PdfInkStrings = {
  saveFailedTitle: 't',
  saveFailedMessage: 'm',
  keepEditing: 'k',
  discard: 'd',
};
const LINK = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=1';
const pdf = () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

function harness(over: Partial<OpenPdfWithInkDeps> = {}) {
  const { fs, files } = memFs();
  const open = vi.fn(async () => ({ hasInk: true }));
  const deps: OpenPdfWithInkDeps = {
    plugin: { open },
    fs,
    inkUri: async (key) => `file:///lib-cloud/pdf-ink/${key}.ink`,
    now: () => 5000,
    ...over,
  };
  const fetchPdf = vi.fn(async (): Promise<Blob | null> => pdf());
  const input: OpenPdfWithInkInput = {
    courseCode: 'EBC-MT',
    fileLink: LINK,
    name: 'Přednáška 09',
    date: '12. 3. 2026',
    strings: STRINGS,
    fetchPdf,
  };
  return { deps, input, open, fetchPdf, fs, files };
}

describe('pdfInkKey', () => {
  it('is the sha256 hex of courseCode:fileLink, the same identity the study notes use', async () => {
    const key = await pdfInkKey('EBC-MT', LINK);
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(await pdfInkKey('EBC-MT', LINK)).toBe(key);
    expect(await pdfInkKey('EBC-XY', LINK)).not.toBe(key);
  });
});

describe('openPdfWithInk', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches, stores and opens when nothing is cached', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);

    const result = await openPdfWithInk(deps, input);

    expect(result).toEqual({ kind: 'shown', hasInk: true });
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith({
      pdfPath: `file:///lib/${pdfPath(key)}`,
      inkPath: `file:///lib-cloud/pdf-ink/${key}.ink`,
      title: 'Přednáška 09',
      strings: STRINGS,
    });
    expect((await readIndex(fs))[key]).toMatchObject({
      date: '12. 3. 2026',
      name: 'Přednáška 09',
      lastOpenedAt: 5000,
    });
  });

  it('opens a fresh copy without touching the network', async () => {
    const { deps, input, open, fetchPdf, fs } = harness({ now: () => 9000 });
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: input.date, name: input.name }, 1000);

    await openPdfWithInk(deps, input);

    expect(fetchPdf).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledTimes(1);
    expect((await readIndex(fs))[key]?.lastOpenedAt).toBe(9000);
  });

  it('refetches once when the IS document date changed', async () => {
    const { deps, input, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: 'old date', name: input.name }, 1000);

    await openPdfWithInk(deps, input);

    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect((await readIndex(fs))[key]?.date).toBe('12. 3. 2026');
  });

  it('opens the stale copy when IS is unreachable', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: 'old date', name: input.name }, 1000);
    fetchPdf.mockRejectedValueOnce(new Error('offline'));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('shown');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('fails without opening when nothing is cached and the fetch throws', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockRejectedValueOnce(new Error('offline'));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });

  it('reports notPdf when IS served a viewer page and nothing is cached', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockResolvedValueOnce(null);

    expect(await openPdfWithInk(deps, input)).toEqual({ kind: 'notPdf' });
    expect(open).not.toHaveBeenCalled();
  });

  it('hands the same bytes back for the web viewer when PDFKit cannot read them, and forgets the copy', async () => {
    const { deps, input, open, fetchPdf, fs, files } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('unreadable');
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(files.has(pdfPath(key))).toBe(false);
    expect(await readIndex(fs)).toEqual({});
  });

  it('refetches for the web viewer when a FRESH copy turns out unreadable', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: input.date, name: input.name }, 1000);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('unreadable');
    expect(fetchPdf).toHaveBeenCalledTimes(1);
  });

  it('reports any other plugin rejection as failed', async () => {
    const { deps, input, open } = harness();
    open.mockRejectedValueOnce(new Error('no view controller'));
    expect((await openPdfWithInk(deps, input)).kind).toBe('failed');
  });

  it('enforces the cache cap after a successful open', async () => {
    const { deps, input, files } = harness();
    files.set('pdf-ink/orphan.pdf', { size: 301 * 1024 * 1024 });

    await openPdfWithInk(deps, input);

    expect(files.has('pdf-ink/orphan.pdf')).toBe(false);
  });
});
