import { useCallback, useEffect, useRef, useState } from 'react';
import { useFileActions } from './useFileActions';

export interface PdfPreviewFile {
  link: string;
  name: string;
}

/** What a file row passes along with the link; both are optional for callers that lack them. */
export interface PdfPreviewMeta {
  name?: string;
  date?: string;
}

/**
 * "Tap to look, press to save" for a file row.
 *
 * The phone/tablet drawer used to hand every tap straight to `openFile`, which
 * on Capacitor means fetch → write → the iOS share sheet: the student had to
 * export a document out of the app before they could read a single page of it.
 * The inline path already existed for desktop, so this packages the state it
 * needs — the blob URL, which file it belongs to, and the revoke — for reuse.
 *
 * A file that turns out not to be a real PDF (IS serves viewer pages under the
 * same anchors) falls back to the download rather than opening an empty viewer.
 */
export function usePdfPreview() {
  const { openFile, openPdfInline, downloadSingle, isDownloading, downloadProgress } =
    useFileActions();
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

  const viewPdf = useCallback(
    async (link: string, meta?: PdfPreviewMeta) => {
      if (isPreviewLoading) return;
      setIsPreviewLoading(true);
      const name = meta?.name ?? 'PDF';
      try {
        const blobUrl = await openPdfInline(link);
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
    [openPdfInline, openFile, isPreviewLoading]
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
