import type { PdfCacheFs } from '../pdfCache';

/** In-memory PdfCacheFs. Sizes are what `list` reports, so tests can seed them. */
export function memFs() {
  const files = new Map<string, { text?: string; base64?: string; size: number }>();
  const fs: PdfCacheFs = {
    readText: async (p) => files.get(p)?.text ?? null,
    writeText: async (p, t) => void files.set(p, { text: t, size: t.length }),
    writeBase64: async (p, b) =>
      void files.set(p, { base64: b, size: Math.floor((b.length * 3) / 4) }),
    exists: async (p) => files.has(p),
    list: async (dir) =>
      [...files.entries()]
        .filter(([p]) => p.startsWith(`${dir}/`))
        .map(([p, f]) => ({ name: p.slice(dir.length + 1), size: f.size })),
    remove: async (p) => void files.delete(p),
    uri: async (p) => `file:///lib/${p}`,
  };
  return { fs, files };
}
