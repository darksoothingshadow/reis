import { describe, it, expect } from 'vitest';
import { memFs } from './memPdfCacheFs';
import {
  PDF_CACHE_DIR,
  enforceCap,
  forget,
  pdfPath,
  readIndex,
  recordOpen,
  resolve,
  store,
} from '../pdfCache';

const pdf = () => new Blob(['%PDF-1.4 fake'], { type: 'application/pdf' });

describe('pdfCache.resolve', () => {
  it('is absent when neither the index nor the file knows the key', async () => {
    const { fs } = memFs();
    expect(await resolve(fs, 'k1', '12. 3. 2026')).toBe('absent');
  });

  it('is fresh when the file exists and the IS document date is unchanged', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: '12. 3. 2026', name: 'Přednáška 09' }, 1000);
    expect(await resolve(fs, 'k1', '12. 3. 2026')).toBe('fresh');
  });

  it('is stale when the teacher re-uploaded (date changed)', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: '12. 3. 2026', name: 'Přednáška 09' }, 1000);
    expect(await resolve(fs, 'k1', '19. 3. 2026')).toBe('stale');
  });

  it('is stale when the index knows the key but the file is gone', async () => {
    const { fs, files } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    files.delete(pdfPath('k1'));
    expect(await resolve(fs, 'k1', 'd')).toBe('stale');
  });

  it('is stale when the file exists but the index was lost', async () => {
    const { fs, files } = memFs();
    files.set(pdfPath('k1'), { size: 10 });
    expect(await resolve(fs, 'k1', 'd')).toBe('stale');
  });
});

describe('pdfCache index', () => {
  it('records date, size, name and lastOpenedAt on store', async () => {
    const { fs } = memFs();
    const blob = pdf();
    await store(fs, 'k1', blob, { date: 'd', name: 'Slides' }, 1000);
    expect(await readIndex(fs)).toEqual({
      k1: { date: 'd', bytes: blob.size, name: 'Slides', lastOpenedAt: 1000 },
    });
  });

  it('bumps lastOpenedAt on recordOpen and ignores unknown keys', async () => {
    const { fs } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    await recordOpen(fs, 'k1', 2000);
    await recordOpen(fs, 'nope', 3000);
    const index = await readIndex(fs);
    expect(index.k1?.lastOpenedAt).toBe(2000);
    expect(index.nope).toBeUndefined();
  });

  it('treats a corrupt index as empty instead of throwing', async () => {
    const { fs } = memFs();
    await fs.writeText(`${PDF_CACHE_DIR}/index.json`, '{not json');
    expect(await readIndex(fs)).toEqual({});
    await fs.writeText(`${PDF_CACHE_DIR}/index.json`, '[1,2]');
    expect(await readIndex(fs)).toEqual({});
  });

  it('keeps every entry when two stores overlap (index writes are serialised)', async () => {
    const { fs } = memFs();
    await Promise.all([
      store(fs, 'a', pdf(), { date: 'd', name: 'a' }, 1),
      store(fs, 'b', pdf(), { date: 'd', name: 'b' }, 2),
      store(fs, 'c', pdf(), { date: 'd', name: 'c' }, 3),
    ]);
    const index = await readIndex(fs);
    expect(Object.keys(index).sort()).toEqual(['a', 'b', 'c']);
    expect([index.a?.lastOpenedAt, index.b?.lastOpenedAt, index.c?.lastOpenedAt]).toEqual([
      1, 2, 3,
    ]);
  });

  it('forget removes the file and the entry', async () => {
    const { fs, files } = memFs();
    await store(fs, 'k1', pdf(), { date: 'd', name: 'n' }, 1000);
    await forget(fs, 'k1');
    expect(files.has(pdfPath('k1'))).toBe(false);
    expect(await readIndex(fs)).toEqual({});
  });
});

describe('pdfCache.enforceCap', () => {
  it('does nothing under the cap', async () => {
    const { fs, files } = memFs();
    await store(fs, 'a', pdf(), { date: 'd', name: 'a' }, 1);
    files.set(pdfPath('a'), { size: 100 });
    expect(await enforceCap(fs, 1000)).toEqual([]);
    expect(files.has(pdfPath('a'))).toBe(true);
  });

  it('evicts least-recently-opened PDFs first until under the cap', async () => {
    const { fs, files } = memFs();
    await store(fs, 'old', pdf(), { date: 'd', name: 'old' }, 1);
    await store(fs, 'mid', pdf(), { date: 'd', name: 'mid' }, 2);
    await store(fs, 'new', pdf(), { date: 'd', name: 'new' }, 3);
    for (const k of ['old', 'mid', 'new']) files.set(pdfPath(k), { size: 400 });
    expect(await enforceCap(fs, 1000)).toEqual(['old']);
    expect(files.has(pdfPath('old'))).toBe(false);
    expect(files.has(pdfPath('mid'))).toBe(true);
    expect(Object.keys(await readIndex(fs)).sort()).toEqual(['mid', 'new']);
  });

  it('counts a PDF with no index entry as the oldest, and never touches other files', async () => {
    const { fs, files } = memFs();
    await store(fs, 'known', pdf(), { date: 'd', name: 'known' }, 5);
    files.set(pdfPath('known'), { size: 600 });
    files.set(`${PDF_CACHE_DIR}/orphan.pdf`, { size: 600 });
    files.set(`${PDF_CACHE_DIR}/notes.ink`, { size: 600 });
    expect(await enforceCap(fs, 1000)).toEqual(['orphan']);
    expect(files.has(`${PDF_CACHE_DIR}/notes.ink`)).toBe(true);
    expect(files.has(pdfPath('known'))).toBe(true);
  });
});
