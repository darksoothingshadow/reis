import { X } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useRecentPdfOpen } from '../../../../hooks/ui/useRecentPdfOpen';

/**
 * The files last opened in the iPad reader, one tap from the calendar.
 *
 * Both routes to a PDF (calendar → lesson → subject → file, Subjects → subject
 * → file) make the student walk the subject again to reopen the file they were
 * reading ten minutes ago. This is the way back.
 *
 * On every day, not only today. It started today-only, reasoning that the
 * cache knows one `lastOpenedAt` per file and cannot say what was opened on a
 * given day — true, but the heading says "recently opened", a shelf and not a
 * fact about the day, and a student paging to Thursday watched it vanish with
 * no idea why. The shelf follows the student; the agenda follows the day.
 *
 * Under the agenda, inside its scroller: on a full teaching day it must not
 * push the 8am lecture off the screen. Renders nothing when empty (the slice
 * is empty wherever there is no native reader).
 */
export function RecentFilesStrip() {
  const { t } = useTranslation();
  const recent = useAppStore((s) => s.recentPdfs);
  const subjects = useAppStore((s) => s.subjects);
  const dismissRecentPdf = useAppStore((s) => s.dismissRecentPdf);
  const { openRecentPdf, isOpening } = useRecentPdfOpen();

  if (recent.length === 0) return null;

  return (
    // Same card as MenuCard: a hairline on the base-200 backdrop, because a
    // base-100 surface alone is invisible there in the light theme.
    <div data-testid="recent-files" className="mt-3 flex-shrink-0 px-4">
      <div className="rounded-2xl border border-base-content/10 bg-base-100 pb-1">
        <div className="px-3.5 pt-2.5 text-xs font-bold uppercase tracking-wide text-base-content/70">
          {t('mobile.calendar.recentFiles')}
        </div>
        <ul>
          {recent.map((row) => (
            <li key={row.key} className="flex items-stretch">
              <button
                type="button"
                disabled={isOpening}
                onClick={() => void openRecentPdf(row)}
                className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1.5 pl-3.5 text-left"
              >
                <span className="truncate text-md font-semibold text-base-content">{row.name}</span>
                <span className="truncate text-2sm text-base-content/70">
                  {subjects?.data[row.courseCode]?.displayName ?? row.courseCode}
                </span>
              </button>
              <button
                type="button"
                aria-label={t('common.close')}
                onClick={(e) => {
                  e.stopPropagation();
                  void dismissRecentPdf(row.key);
                }}
                className="flex min-h-11 min-w-11 flex-shrink-0 items-center justify-center text-base-content/70"
              >
                <X size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
