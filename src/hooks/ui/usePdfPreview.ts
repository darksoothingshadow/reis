import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useFileActions } from './useFileActions';
import { useTranslation } from '../useTranslation';
import { logError } from '../../utils/reportError';
import { openPdfWithInk, type PdfInkStrings } from '../../mobile/pdfInk';
import type { SubjectPdfInput } from '../../mobile/pdfInkFiles';
import { isPdfInkAvailable, nativePdfInkDeps } from '../../mobile/pdfInkNative';

export interface PdfPreviewFile {
  link: string;
  name: string;
}

/** What a file row passes along with the link; both are optional for callers that lack them. */
export interface PdfPreviewMeta {
  name?: string;
  date?: string;
}

/** The subject the reader's sidebar lists: its display title and every PDF it has. */
export interface PdfPreviewSubject {
  title: string;
  files: SubjectPdfInput[];
}

/**
 * "Tap to look, press to save" for a file row.
 *
 * Two readers sit behind `viewPdf`:
 *
 * - On an iPad with the PdfInk plugin (native/capacitor-pdf-ink) and a known
 *   course, the PDF opens in the native PencilKit reader, with the subject's
 *   other PDFs in its sidebar. Ink and the PDF bytes persist on the device;
 *   nothing here needs state while it is up, because it covers the whole
 *   screen. `courseCode` is what keys the ink and the cache, so without one the
 *   web viewer is used.
 * - Everywhere else — desktop, iPhone, Android, a PDF PDFKit rejects — the blob
 *   goes to the inline pdf.js viewer exactly as before. A fallback from the
 *   native path reuses the bytes it already fetched.
 *
 * A file that turns out not to be a real PDF (IS serves viewer pages under the
 * same anchors) falls back to the download rather than opening an empty viewer.
 */
export function usePdfPreview(courseCode?: string, subject?: PdfPreviewSubject) {
  const { openFile, openPdfInline, fetchPdfBlob, downloadSingle, isDownloading, downloadProgress } =
    useFileActions();
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PdfPreviewFile | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  // Blob URLs are held by the document until revoked; a drawer opened and
  // closed a dozen times would otherwise pin every PDF it ever showed in memory.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // The cleanup above only ever sees a URL that reached state. Close the drawer
  // while the fetch is still running and the URL lands on a dead hook: no state
  // update, no cleanup, and the blob is pinned for the life of the document.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const inkStrings = useCallback(
    (): PdfInkStrings => ({
      saveFailedTitle: t('mobile.pdfInk.saveFailedTitle'),
      saveFailedMessage: t('mobile.pdfInk.saveFailedMessage'),
      keepEditing: t('mobile.pdfInk.keepEditing'),
      discard: t('mobile.pdfInk.discard'),
      openFailed: t('mobile.pdfInk.openFailed'),
      addPage: t('mobile.pdfInk.addPage'),
      export: t('mobile.pdfInk.export'),
      exportFailed: t('mobile.pdfInk.exportFailed'),
      close: t('common.close'),
      pages: t('mobile.pdfInk.pages'),
    }),
    [t]
  );

  /**
   * Native reader first. `handled` means the tap is done (shown, or failed and
   * told); `viewer` hands the web viewer a blob URL, or null to fall back to the
   * download (IS served a viewer page).
   */
  const tryNativeReader = useCallback(
    async (
      link: string,
      name: string,
      meta?: PdfPreviewMeta
    ): Promise<{ kind: 'handled' } | { kind: 'viewer'; blobUrl: string | null }> => {
      const result = await openPdfWithInk(nativePdfInkDeps, {
        courseCode: courseCode ?? '',
        courseTitle: subject?.title ?? courseCode ?? '',
        fileLink: link,
        name,
        date: meta?.date ?? '',
        files: subject?.files ?? [],
        strings: inkStrings(),
        fetchPdf: (target) => fetchPdfBlob(target),
      });
      if (result.kind === 'shown') return { kind: 'handled' };
      if (result.kind === 'unreadable') {
        return { kind: 'viewer', blobUrl: URL.createObjectURL(result.blob) };
      }
      if (result.kind === 'failed') {
        logError('usePdfPreview.nativeReader', result.error);
        toast.error(t('course.file.openFailed'));
        return { kind: 'handled' };
      }
      return { kind: 'viewer', blobUrl: null };
    },
    [courseCode, subject, inkStrings, fetchPdfBlob, t]
  );

  const viewPdf = useCallback(
    async (link: string, meta?: PdfPreviewMeta) => {
      if (isPreviewLoading) return;
      setIsPreviewLoading(true);
      const name = meta?.name ?? 'PDF';
      try {
        let blobUrl: string | null;
        if (courseCode && (await isPdfInkAvailable())) {
          const outcome = await tryNativeReader(link, name, meta);
          if (outcome.kind === 'handled') return;
          blobUrl = outcome.blobUrl;
        } else {
          blobUrl = await openPdfInline(link);
        }
        if (!alive.current) {
          // Nobody is left to show it to, and nobody is left to revoke it.
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          return;
        }
        if (blobUrl) {
          setPreviewUrl(blobUrl);
          setPreviewFile({ link, name });
        } else {
          await openFile(link);
        }
      } finally {
        if (alive.current) setIsPreviewLoading(false);
      }
    },
    [courseCode, tryNativeReader, openPdfInline, openFile, isPreviewLoading]
  );

  const closePreview = useCallback(() => {
    setPreviewUrl(null);
    setPreviewFile(null);
  }, []);

  return {
    previewUrl,
    previewFile,
    isPreviewLoading,
    viewPdf,
    closePreview,
    openFile,
    downloadSingle,
    isDownloading,
    downloadProgress,
  };
}
