/**
 * useFileActions - Hook for file operations (open, download ZIP).
 */

import { useState, useCallback } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { normalizeFileUrl } from '../../utils/fileUrl';
import { createLogger } from '../../utils/logger';
import { requestQueue } from '../../utils/requestQueue';
import { isNativeHost } from '../../mobile/openIsFile';
import { openNativeFile } from './openNativeFile';
import { useTranslation } from '../useTranslation';
import { DemoModeError, isDemoMode } from '../../errors/demoMode';
import { logError } from '../../utils/reportError';

const log = createLogger('useFileActions');

/**
 * Demo mode exists only on Capacitor today, and every branch below already
 * sits behind `isNativeHost()`, which routes Capacitor through
 * `openNativeFile` instead — so this can never trip in production. It stays
 * here as defence in depth, not a live bug fix: if demo mode ever reaches a
 * non-native host, these credentialed fetches must not become the way a
 * reviewer's tap reaches a real IS session.
 */
function assertNotDemo(): void {
  if (isDemoMode()) throw new DemoModeError();
}

interface DownloadProgress {
  completed: number;
  total: number;
}

interface UseFileActionsResult {
  isDownloading: boolean;
  downloadProgress: DownloadProgress | null;
  openFile: (link: string) => Promise<void>;
  /** The bytes of an IS PDF, or null when IS served a viewer page instead. */
  fetchPdfBlob: (link: string) => Promise<Blob | null>;
  openPdfInline: (link: string) => Promise<string | null>;
  downloadSingle: (link: string) => Promise<void>;
  downloadZip: (fileLinks: string[], zipFileName: string) => Promise<void>;
}

export function useFileActions(): UseFileActionsResult {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const { t } = useTranslation();

  const openFile = useCallback(
    async (link: string) => {
      const fullUrl = normalizeFileUrl(link);

      // Capacitor: IS denies CORS to every origin, so the browser fetch below
      // always fails here — and its window.open fallback hands the URL to the
      // SYSTEM BROWSER, which has no IS session. Fetch natively instead.
      if (isNativeHost()) {
        await openNativeFile(fullUrl, 'useFileActions.openFile', t);
        return;
      }

      try {
        assertNotDemo();
        const response = await fetch(fullUrl, { credentials: 'include' });

        if (!response.ok) {
          log.warn('Fetch failed, falling back to direct link');
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
          return;
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        window.open(blobUrl, '_blank', 'noopener,noreferrer');

        // Clean up after 5 minutes
        setTimeout(() => URL.revokeObjectURL(blobUrl), 5 * 60 * 1000);
      } catch (e) {
        // A demo block must not fall through to the direct link: window.open
        // would hand the real IS URL to the browser and step straight over the
        // boundary assertNotDemo exists to hold. logError shows the demo toast
        // and reports nothing, so the student gets told instead.
        if (e instanceof DemoModeError) {
          logError('useFileActions.openFile', e);
          return;
        }
        log.error('Failed to fetch file as blob, falling back to direct link', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [t]
  );

  const fetchPdfBlob = useCallback(async (link: string): Promise<Blob | null> => {
    const fullUrl = normalizeFileUrl(link);
    try {
      // Capacitor: fetch natively — no window.open, so no escape to Chrome.
      if (isNativeHost()) {
        const { fetchIsBinary } = await import('../../api/capacitorBinary');
        const { loadStoredToken } = await import('../../platform/tokenStore');
        const { Capacitor, CapacitorHttp, CapacitorCookies } = await import('@capacitor/core');
        const result = await fetchIsBinary(fullUrl, await loadStoredToken(), {
          platform: Capacitor.getPlatform() as 'ios' | 'android' | 'web',
          setCookie: (o) => CapacitorCookies.setCookie(o),
          httpGet: (o) => CapacitorHttp.get(o),
        });
        // A viewer page is not a PDF — null lets the caller fall back to its
        // normal "can't preview" path.
        return result.kind === 'binary' ? result.blob : null;
      }
      assertNotDemo();
      const response = await fetch(fullUrl, { credentials: 'include' });
      if (!response.ok) return null;
      return await response.blob();
    } catch (e) {
      log.error('Failed to fetch PDF inline', e);
      return null;
    }
  }, []);

  // The web viewer's input. The iPad reader (usePdfPreview → openPdfWithInk)
  // takes fetchPdfBlob directly, so both consume ONE fetch and a fallback from
  // one to the other never refetches.
  const openPdfInline = useCallback(
    async (link: string): Promise<string | null> => {
      const blob = await fetchPdfBlob(link);
      return blob ? URL.createObjectURL(blob) : null;
    },
    [fetchPdfBlob]
  );

  const downloadSingle = useCallback(
    async (link: string) => {
      const fullUrl = normalizeFileUrl(link);
      // See openFile: the browser fetch and its window.open fallback are both
      // dead ends on Capacitor.
      if (isNativeHost()) {
        await openNativeFile(fullUrl, 'useFileActions.downloadSingle', t);
        return;
      }
      try {
        assertNotDemo();
        const response = await fetch(fullUrl, { credentials: 'include' });
        if (!response.ok) {
          window.open(fullUrl, '_blank', 'noopener,noreferrer');
          return;
        }
        const blob = await response.blob();
        const cd = response.headers.get('content-disposition');
        const match = cd?.match(/filename="?([^"]+)"?/);
        const filename = match?.[1] || link.split('/').pop() || 'download';
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      } catch (e) {
        // See openFile: the direct-link fallback would bypass the demo guard.
        if (e instanceof DemoModeError) {
          logError('useFileActions.downloadSingle', e);
          return;
        }
        log.error('Failed to download file', e);
        window.open(fullUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [t]
  );

  const downloadZip = useCallback(async (fileLinks: string[], zipFileName: string) => {
    if (fileLinks.length < 2) return;

    // Checked once, before the workers spawn, rather than relying on the
    // per-worker assertNotDemo below: that one throws inside each queued task,
    // whose catch only logs and ticks progress, so a demo user watched a
    // progress bar run to completion and produce an empty zip with no
    // explanation. One toast for the action, not one per file — and the
    // per-worker guard stays as the actual network boundary.
    if (isDemoMode()) {
      logError('useFileActions.downloadZip', new DemoModeError());
      return;
    }

    setIsDownloading(true);
    setDownloadProgress({ completed: 0, total: fileLinks.length });

    const zip = new JSZip();

    try {
      const downloadPromises = fileLinks.map(async (link) => {
        return requestQueue.add(async () => {
          try {
            const fullUrl = normalizeFileUrl(link);
            assertNotDemo();

            // Basic retry logic (1 retry)
            let response = await fetch(fullUrl, { credentials: 'include' });
            if (!response.ok && response.status >= 500) {
              response = await fetch(fullUrl, { credentials: 'include' });
            }

            if (!response.ok) {
              setDownloadProgress((prev) =>
                prev ? { ...prev, completed: prev.completed + 1 } : null
              );
              return;
            }

            const blob = await response.blob();

            const cd = response.headers.get('content-disposition');
            let filename = 'file';
            if (cd) {
              const match = cd.match(/filename="?([^"]+)"?/);
              if (match?.[1]) filename = match[1];
            }

            if (filename === 'file') {
              filename = link.split('/').pop() || `file_${Math.random().toString(36).substr(2, 9)}`;
            }

            filename = filename.replace(/[\\/:*?"<>|]/g, '_');
            zip.file(filename, blob);

            // Update progress after successful download and processing
            setDownloadProgress((prev) =>
              prev ? { ...prev, completed: prev.completed + 1 } : null
            );
          } catch (e) {
            log.error(`Failed to add file ${link} to zip`, e);
            setDownloadProgress((prev) =>
              prev ? { ...prev, completed: prev.completed + 1 } : null
            );
          }
        });
      });

      await Promise.all(downloadPromises);

      const entries = Object.keys(zip.files);
      if (entries.length === 0) return;

      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, zipFileName);
    } catch (e) {
      log.error('Failed to generate/save ZIP', e);
    } finally {
      setIsDownloading(false);
      setDownloadProgress(null);
    }
  }, []);

  return {
    isDownloading,
    downloadProgress,
    openFile,
    fetchPdfBlob,
    openPdfInline,
    downloadSingle,
    downloadZip,
  };
}
