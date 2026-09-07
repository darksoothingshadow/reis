import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { useFileActions } from './useFileActions';
import { usePdfInkStrings } from './usePdfInkStrings';
import { useTranslation } from '../useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { logError } from '../../utils/reportError';
import { openPdfWithInk } from '../../mobile/pdfInk';
import { nativePdfInkDeps } from '../../mobile/pdfInkNative';
import type { RecentPdf } from '../../utils/mobile/recentPdfs';

/**
 * Reopens a "recently opened" row in the iPad reader, from the device alone.
 *
 * The drawer's `usePdfPreview` needs the subject's IS file listing for the
 * sidebar; the calendar has none. What it has is the cache index, so the
 * sidebar is every cached file of the same subject — which is exactly the set
 * the device can show without IS. Offline is the existing stale-if-error path.
 *
 * There is no web viewer here: a copy PDFKit rejects, or a link IS now serves as
 * a viewer page, is reported and left to the drawer route, which has one.
 */
export function useRecentPdfOpen() {
  const { fetchPdfBlob } = useFileActions();
  const { t } = useTranslation();
  const strings = usePdfInkStrings();
  const [isOpening, setIsOpening] = useState(false);

  const openRecentPdf = useCallback(
    async (row: RecentPdf) => {
      if (isOpening) return;
      setIsOpening(true);
      try {
        const { subjects, cachedPdfs, refreshRecentPdfs } = useAppStore.getState();
        const files = cachedPdfs
          .filter((f) => f.courseCode === row.courseCode)
          .map(({ link, name, date }) => ({ link, name, date }));
        const result = await openPdfWithInk(nativePdfInkDeps, {
          courseCode: row.courseCode,
          courseTitle: subjects?.data[row.courseCode]?.displayName ?? row.courseCode,
          fileLink: row.link,
          name: row.name,
          date: row.date,
          files,
          strings: strings(),
          fetchPdf: (target) => fetchPdfBlob(target),
        });
        if (result.kind === 'failed') logError('useRecentPdfOpen', result.error);
        if (result.kind !== 'shown') toast.error(t('course.file.openFailed'));
        await refreshRecentPdfs();
      } finally {
        setIsOpening(false);
      }
    },
    [isOpening, strings, fetchPdfBlob, t]
  );

  return { openRecentPdf, isOpening };
}
