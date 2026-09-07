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
  openFailed: 'o',
  addPage: 'a',
  export: 'e',
  exportFailed: 'ef',
  close: 'c',
  pages: 'p',
  search: 's',
  page: 'pg',
  noMatches: 'nm',
  removePage: 'rp',
  cancel: 'ca',
  openAlongside: 'oa',
  closePane: 'cp',
  pickFile: 'pf',
};
const LINK = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359057;id=1';
const LINK_B = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359058;id=1';
const LINK_C = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=359059;id=1';
const FILES = [
  { link: LINK, name: 'Přednáška 09', date: '12. 3. 2026' },
  { link: LINK_B, name: 'Přednáška 10', date: '19. 3. 2026' },
  { link: LINK_C, name: 'Skripta', date: '01. 2. 2026' },
];
const pdf = () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

function harness(over: Partial<OpenPdfWithInkDeps> = {}) {
  const { fs, files } = memFs();
  const open = vi.fn<(o: unknown) => Promise<{ shown: string[] }>>(async () => ({ shown: [LINK] }));
  const deliverFile = vi.fn(async () => {});
  const fileUnavailable = vi.fn(async () => {});
  const remove = vi.fn(async () => {});
  let needsFile: ((e: { link: string }) => Promise<void>) | null = null;
  const addListener = vi.fn(
    async (_event: 'needsFile', cb: (e: { link: string }) => Promise<void>) => {
      needsFile = cb;
      return { remove };
    }
  );
  const hasInk = vi.fn<(key: string) => Promise<boolean>>(async () => false);
  const deps: OpenPdfWithInkDeps = {
    plugin: { open, deliverFile, fileUnavailable, addListener },
    fs,
    inkUri: async (key) => `file:///lib-cloud/pdf-ink/${key}.ink`,
    hasInk,
    now: () => 5000,
    ...over,
  };
  const fetchPdf = vi.fn<(link: string) => Promise<Blob | null>>(async () => pdf());
  const input: OpenPdfWithInkInput = {
    courseCode: 'EBC-MT',
    courseTitle: 'Matematika',
    fileLink: LINK,
    name: 'Přednáška 09',
    date: '12. 3. 2026',
    files: FILES,
    strings: STRINGS,
    fetchPdf,
  };
  const trigger = (link: string) => {
    if (!needsFile) throw new Error('needsFile listener was never registered');
    return needsFile({ link });
  };
  return {
    deps,
    input,
    open,
    deliverFile,
    fileUnavailable,
    remove,
    trigger,
    fetchPdf,
    hasInk,
    fs,
    files,
  };
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

  it('fetches, stores and opens the tapped file with the subject list', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    const keyB = await pdfInkKey(input.courseCode, LINK_B);
    const keyC = await pdfInkKey(input.courseCode, LINK_C);

    const result = await openPdfWithInk(deps, input);

    expect(result).toEqual({ kind: 'shown', hasInk: false });
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(fetchPdf).toHaveBeenCalledWith(LINK);
    expect(open).toHaveBeenCalledWith({
      courseTitle: 'Matematika',
      currentLink: LINK,
      files: [
        {
          link: LINK,
          name: 'Přednáška 09',
          date: '12. 3. 2026',
          pdfPath: `file:///lib/${pdfPath(key)}`,
          inkPath: `file:///lib-cloud/pdf-ink/${key}.ink`,
        },
        {
          link: LINK_B,
          name: 'Přednáška 10',
          date: '19. 3. 2026',
          pdfPath: null,
          inkPath: `file:///lib-cloud/pdf-ink/${keyB}.ink`,
        },
        {
          link: LINK_C,
          name: 'Skripta',
          date: '01. 2. 2026',
          pdfPath: null,
          inkPath: `file:///lib-cloud/pdf-ink/${keyC}.ink`,
        },
      ],
      strings: STRINGS,
    });
    expect((await readIndex(fs))[key]).toMatchObject({ date: '12. 3. 2026', lastOpenedAt: 5000 });
  });

  it('gives the sidebar a cached path only for copies that are fresh for their date', async () => {
    const { deps, input, open, fs } = harness();
    const keyB = await pdfInkKey(input.courseCode, LINK_B);
    const keyC = await pdfInkKey(input.courseCode, LINK_C);
    await store(fs, keyB, pdf(), { date: '19. 3. 2026', name: 'Přednáška 10' }, 1000);
    await store(fs, keyC, pdf(), { date: 'older date', name: 'Skripta' }, 1000);

    await openPdfWithInk(deps, input);

    const files = (open.mock.calls[0]?.[0] as { files: { link: string; pdfPath: string | null }[] })
      .files;
    expect(files.find((f) => f.link === LINK_B)?.pdfPath).toBe(`file:///lib/${pdfPath(keyB)}`);
    expect(files.find((f) => f.link === LINK_C)?.pdfPath).toBeNull();
  });

  it('keeps listing a copy on the device after IS stops offering the file', async () => {
    const { deps, input, open, fs } = harness();
    const gone = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=111111;id=1';
    const keyGone = await pdfInkKey(input.courseCode, gone);
    await store(
      fs,
      keyGone,
      pdf(),
      { date: '05. 1. 2026', name: 'Zadání semestrálky', courseCode: 'EBC-MT', link: gone },
      1000
    );

    await openPdfWithInk(deps, input);

    const files = (open.mock.calls[0]?.[0] as { files: { link: string; pdfPath: string | null }[] })
      .files;
    // Last, never interleaved: the rest of the list is the drawer's order, and
    // a kept file is precisely one the drawer no longer has.
    expect(files.at(-1)).toEqual({
      link: gone,
      name: 'Zadání semestrálky',
      date: '05. 1. 2026',
      pdfPath: `file:///lib/${pdfPath(keyGone)}`,
      inkPath: `file:///lib-cloud/pdf-ink/${keyGone}.ink`,
    });
  });

  it("does not borrow another subject's cached files for this sidebar", async () => {
    const { deps, input, open, fs } = harness();
    const other = 'https://is.mendelu.cz/auth/dok_server/slozka.pl?download=222222;id=1';
    await store(
      fs,
      await pdfInkKey('EBC-XY', other),
      pdf(),
      { date: 'd', name: 'Cizí přednáška', courseCode: 'EBC-XY', link: other },
      1000
    );

    await openPdfWithInk(deps, input);

    const files = (open.mock.calls[0]?.[0] as { files: { link: string }[] }).files;
    expect(files.map((f) => f.link)).toEqual([LINK, LINK_B, LINK_C]);
  });

  it('lists the tapped file even when the subject list does not contain it', async () => {
    const { deps, input, open } = harness();
    await openPdfWithInk(deps, { ...input, files: [FILES[1]!] });
    const files = (open.mock.calls[0]?.[0] as { files: { link: string }[] }).files;
    expect(files.map((f) => f.link)).toEqual([LINK, LINK_B]);
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

    expect((await openPdfWithInk(deps, input)).kind).toBe('shown');
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('fails without opening when nothing is cached and the fetch throws', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockRejectedValueOnce(new Error('offline'));
    expect((await openPdfWithInk(deps, input)).kind).toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });

  it('reports notPdf when IS served a viewer page and nothing is cached', async () => {
    const { deps, input, open, fetchPdf } = harness();
    fetchPdf.mockResolvedValueOnce(null);
    expect(await openPdfWithInk(deps, input)).toEqual({ kind: 'notPdf' });
    expect(open).not.toHaveBeenCalled();
  });

  it('answers needsFile by fetching, caching and delivering that file', async () => {
    const { deps, input, open, deliverFile, trigger, fetchPdf, fs } = harness();
    const keyC = await pdfInkKey(input.courseCode, LINK_C);
    open.mockImplementationOnce(async () => {
      await trigger(LINK_C);
      return { shown: [LINK, LINK_C] };
    });

    await openPdfWithInk(deps, input);

    expect(fetchPdf).toHaveBeenCalledWith(LINK_C);
    expect(deliverFile).toHaveBeenCalledWith({
      link: LINK_C,
      pdfPath: `file:///lib/${pdfPath(keyC)}`,
    });
    expect((await readIndex(fs))[keyC]).toMatchObject({ date: '01. 2. 2026', name: 'Skripta' });
  });

  it('reports a file IS will not serve, or cannot fetch, as unavailable', async () => {
    const { deps, input, open, deliverFile, fileUnavailable, trigger, fetchPdf } = harness();
    open.mockImplementationOnce(async () => {
      fetchPdf.mockResolvedValueOnce(null);
      await trigger(LINK_B);
      fetchPdf.mockRejectedValueOnce(new Error('offline'));
      await trigger(LINK_C);
      return { shown: [LINK] };
    });

    await openPdfWithInk(deps, input);

    expect(deliverFile).not.toHaveBeenCalled();
    expect(fileUnavailable).toHaveBeenCalledWith({ link: LINK_B });
    expect(fileUnavailable).toHaveBeenCalledWith({ link: LINK_C });
  });

  it('delivers a stale cached copy of a sidebar file when IS is unreachable or serves a page', async () => {
    const { deps, input, open, deliverFile, fileUnavailable, trigger, fetchPdf, fs } = harness();
    const keyB = await pdfInkKey(input.courseCode, LINK_B);
    const keyC = await pdfInkKey(input.courseCode, LINK_C);
    await store(fs, keyB, pdf(), { date: 'old date', name: 'Přednáška 10' }, 1000);
    await store(fs, keyC, pdf(), { date: 'old date', name: 'Skripta' }, 1000);
    open.mockImplementationOnce(async () => {
      fetchPdf.mockRejectedValueOnce(new Error('offline'));
      await trigger(LINK_B);
      fetchPdf.mockResolvedValueOnce(null);
      await trigger(LINK_C);
      return { shown: [LINK] };
    });

    await openPdfWithInk(deps, input);

    expect(fileUnavailable).not.toHaveBeenCalled();
    expect(deliverFile).toHaveBeenCalledWith({
      link: LINK_B,
      pdfPath: `file:///lib/${pdfPath(keyB)}`,
    });
    expect(deliverFile).toHaveBeenCalledWith({
      link: LINK_C,
      pdfPath: `file:///lib/${pdfPath(keyC)}`,
    });
    // The stale entries keep their old date so the next online open refetches.
    expect((await readIndex(fs))[keyB]?.date).toBe('old date');
  });

  it('reports a failed cache write as failed instead of throwing', async () => {
    const { deps, input, open } = harness();
    deps.fs.writeBase64 = async () => {
      throw new Error('disk full');
    };
    const result = await openPdfWithInk(deps, input);
    expect(result.kind).toBe('failed');
    expect(open).not.toHaveBeenCalled();
  });

  it('keeps its result when removing the listener fails', async () => {
    const { deps, input, remove } = harness();
    remove.mockRejectedValueOnce(new Error('bridge gone'));
    expect(await openPdfWithInk(deps, input)).toEqual({ kind: 'shown', hasInk: false });
  });

  it('records lastOpenedAt for every shown file, then stops listening', async () => {
    const { deps, input, open, remove, trigger, fs } = harness({ now: () => 7000 });
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    const keyC = await pdfInkKey(input.courseCode, LINK_C);
    open.mockImplementationOnce(async () => {
      await trigger(LINK_C);
      return { shown: [LINK, LINK_C] };
    });

    await openPdfWithInk(deps, input);

    const index = await readIndex(fs);
    expect(index[key]?.lastOpenedAt).toBe(7000);
    expect(index[keyC]?.lastOpenedAt).toBe(7000);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('hands the same bytes back for the web viewer when PDFKit cannot read them, and forgets the copy', async () => {
    const { deps, input, open, fetchPdf, fs, files, remove } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    const result = await openPdfWithInk(deps, input);

    expect(result.kind).toBe('unreadable');
    expect(fetchPdf).toHaveBeenCalledTimes(1);
    expect(files.has(pdfPath(key))).toBe(false);
    expect(await readIndex(fs)).toEqual({});
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('refetches for the web viewer when a FRESH copy turns out unreadable', async () => {
    const { deps, input, open, fetchPdf, fs } = harness();
    const key = await pdfInkKey(input.courseCode, input.fileLink);
    await store(fs, key, pdf(), { date: input.date, name: input.name }, 1000);
    open.mockRejectedValueOnce(Object.assign(new Error('bad pdf'), { code: 'unreadable' }));

    expect((await openPdfWithInk(deps, input)).kind).toBe('unreadable');
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
