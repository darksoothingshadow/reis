import type { AppSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { readIndex } from '../../mobile/pdfCache';
import { capacitorPdfCacheFs, isPdfInkAvailable } from '../../mobile/pdfInkNative';
import { listablePdfs, visibleRecentPdfs, type RecentPdf } from '../../utils/mobile/recentPdfs';

export interface RecentPdfsSlice {
  /** Every cached PDF the device can list and reopen, newest open first. */
  cachedPdfs: RecentPdf[];
  /** What the calendar's strip shows: `cachedPdfs` minus dismissals, capped. */
  recentPdfs: RecentPdf[];
  /** key → when it was dismissed. A later open outranks it (see visibleRecentPdfs). */
  dismissedRecentPdfs: Record<string, number>;
  refreshRecentPdfs: () => Promise<void>;
  dismissRecentPdf: (key: string) => Promise<void>;
}

const DISMISSED_KEY = 'recent_pdfs_dismissed';

function mergeDismissed(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const out = { ...b };
  for (const [key, at] of Object.entries(a)) out[key] = Math.max(out[key] ?? 0, at);
  return out;
}

function isDismissedRecord(v: unknown): v is Record<string, number> {
  return (
    !!v &&
    typeof v === 'object' &&
    !Array.isArray(v) &&
    Object.values(v as object).every((n) => typeof n === 'number')
  );
}

/**
 * The "recently opened" strip's state. Reads the iPad reader's cache index —
 * the same `index.json` the reader writes — rather than keeping a second log,
 * so nothing here can disagree with what the reader knows. Refreshed at boot,
 * after every reader open, and whenever the calendar tab is shown.
 *
 * Native-only by construction: every refresh starts with `isPdfInkAvailable()`,
 * which is false on web, iPhone and Android, where there is neither an index
 * nor a reader to reopen a row.
 */
export const createRecentPdfsSlice: AppSlice<RecentPdfsSlice> = (set, get) => {
  // Boot, the calendar tab and a closed reader can all refresh at once, and
  // the index read is async: an OLDER snapshot resolving last used to
  // overwrite the newer list, and a just-reopened file vanished from the strip
  // until the next refresh. Only the most recently started refresh may commit.
  let generation = 0;

  return {
    cachedPdfs: [],
    recentPdfs: [],
    dismissedRecentPdfs: {},

    refreshRecentPdfs: async () => {
      const mine = ++generation;
      try {
        if (!(await isPdfInkAvailable())) return;
        const [index, stored] = await Promise.all([
          readIndex(capacitorPdfCacheFs),
          IndexedDBService.get('meta', DISMISSED_KEY),
        ]);
        if (mine !== generation) return; // a newer refresh has the newer index
        // Merge, newest timestamp wins: a dismissal made while this read was in
        // flight is only in memory, and taking the stored map alone would undo
        // it until the next refresh.
        const dismissed = mergeDismissed(
          get().dismissedRecentPdfs,
          isDismissedRecord(stored) ? stored : {}
        );
        const cachedPdfs = listablePdfs(index);
        set({
          cachedPdfs,
          dismissedRecentPdfs: dismissed,
          recentPdfs: visibleRecentPdfs(cachedPdfs, dismissed),
        });
      } catch (error) {
        logError('RecentPdfsSlice.refreshRecentPdfs', error);
      }
    },

    dismissRecentPdf: async (key) => {
      const dismissed = { ...get().dismissedRecentPdfs, [key]: Date.now() };
      set({
        dismissedRecentPdfs: dismissed,
        recentPdfs: visibleRecentPdfs(get().cachedPdfs, dismissed),
      });
      try {
        await IndexedDBService.set('meta', DISMISSED_KEY, dismissed);
      } catch (error) {
        logError('RecentPdfsSlice.dismissRecentPdf', error);
      }
    },
  };
};
