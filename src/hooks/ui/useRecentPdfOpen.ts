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
import { groupAndSortFiles } from '../../components/SubjectFileDrawer/utils/groupFiles';
import { listSubjectPdfs } from '../../components/SubjectFileDrawer/utils/listSubjectPdfs';

/**
 * Reopens a "recently opened" row in the iPad reader, from the device alone.
 *
 * The sidebar is the SUBJECT's file listing, in the drawer's own order — the
 * same `groupAndSortFiles` → `listSubjectPdfs` the drawer feeds the reader —
 * read from the files slice, which is synced in the background and persisted,
 * so it is there offline too. Only when the store has no listing for the
 * subject at all does the sidebar fall back to the cached copies: the header
 * names the whole subject, and a list of nine files under a subject that has
 * seventeen was the first thing found on the device.
 *
 * There is no web viewer here: a copy PDFKit rejects, or a link IS now serves as
 * a viewer page, is reported and left to the drawer route, which has one.
 */
export function useRecentPdfOpen() {
  const { fetchPdfBlob } = useFileActions();
  const { t } = useTranslation();
  const subjectFiles = useAppStore((s) => s.files);
  const strings = usePdfInkStrings();
  const [isOpening, setIsOpening] = useState(false);

  const openRecentPdf = useCallback(
    async (row: RecentPdf) => {
      if (isOpening) return;
      setIsOpening(true);
      try {
        const { subjects, cachedPdfs, refreshRecentPdfs } = useAppStore.getState();
        const listing = listSubjectPdfs(
          groupAndSortFiles(subjectFiles[row.courseCode] ?? null, row.courseCode, t).flatMap(
            (g) => g.files
          )
        );
        const files = listing.length
          ? listing
          : cachedPdfs
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
    [isOpening, strings, fetchPdfBlob, t, subjectFiles]
  );

  return { openRecentPdf, isOpening };
}
