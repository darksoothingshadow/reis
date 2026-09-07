import { useCallback } from 'react';
import { useTranslation } from '../useTranslation';
import type { PdfInkStrings } from '../../mobile/pdfInk';

/**
 * The copy the native iPad reader shows, translated here and handed over on
 * `open`. One place, because two hooks open the reader now — the file drawer's
 * `usePdfPreview` and the calendar strip's `useRecentPdfOpen` — and the
 * `mobileKeys` guard only helps if both ask for the same keys.
 */
export function usePdfInkStrings(): () => PdfInkStrings {
  const { t } = useTranslation();
  return useCallback(
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
      search: t('mobile.pdfInk.search'),
      page: t('mobile.pdfInk.page'),
      noMatches: t('mobile.pdfInk.noMatches'),
      removePage: t('mobile.pdfInk.removePage'),
      cancel: t('common.cancel'),
    }),
    [t]
  );
}
