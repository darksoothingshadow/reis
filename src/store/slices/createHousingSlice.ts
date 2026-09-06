import type { AppSlice } from '../types';
import { fetchHousingPosts, submitHousingPost, closeHousingPost } from '../../api/housing';
import { getUserParams } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import { getPlatform } from '../../platform';
import { resolvePhoneViewport } from '../../utils/resolvePhoneViewport';
import type { HousingDraft, HousingPost } from '../../types/housing';

export interface HousingSlice {
  housingPosts: HousingPost[];
  housingLoading: boolean;
  /** True only after a successful load, so an empty board is never shown for a failed one. */
  housingLoaded: boolean;
  /** Ids this install published. The server never tells us; the device remembers. */
  housingMineIds: string[];
  /** Bumped by openHousingBoard; the desktop shell switches view when it changes. */
  housingOpenRequest: number;
  loadHousing: () => Promise<void>;
  publishHousing: (draft: HousingDraft) => Promise<'ok' | 'refused' | 'failed'>;
  closeHousing: (id: string) => Promise<boolean>;
  openHousingBoard: () => void;
}

const MINE_KEY = 'housing_posts_mine';

async function readMine(): Promise<string[]> {
  try {
    const v = await IndexedDBService.get('meta', MINE_KEY);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const createHousingSlice: AppSlice<HousingSlice> = (set, get) => ({
  housingPosts: [],
  housingLoading: false,
  housingLoaded: false,
  housingMineIds: [],
  housingOpenRequest: 0,

  loadHousing: async () => {
    if (get().housingLoading) return;
    set({ housingLoading: true });
    const [res, mine] = await Promise.all([fetchHousingPosts(), readMine()]);
    set({
      housingLoading: false,
      housingMineIds: mine,
      ...(res.ok ? { housingPosts: res.posts, housingLoaded: true } : {}),
    });
  },

  publishHousing: async (draft) => {
    let poster: { isLogin: string; personId: string };
    try {
      const p = await getUserParams();
      if (!p?.username || !p.studentId) return 'failed';
      poster = { isLogin: p.username, personId: p.studentId };
    } catch (err) {
      logError('HousingSlice.publishHousing', err);
      return 'failed';
    }
    const id = await submitHousingPost(draft, poster);
    if (!id) return 'refused';
    const mine = [...get().housingMineIds, id];
    set({ housingMineIds: mine });
    try {
      await IndexedDBService.set('meta', MINE_KEY, mine);
    } catch (err) {
      logError('HousingSlice.publishHousing.persist', err);
    }
    await get().loadHousing();
    return 'ok';
  },

  closeHousing: async (id) => {
    const ok = await closeHousingPost(id);
    if (!ok) return false;
    const mine = get().housingMineIds.filter((x) => x !== id);
    set({ housingMineIds: mine, housingPosts: get().housingPosts.filter((p) => p.id !== id) });
    try {
      await IndexedDBService.set('meta', MINE_KEY, mine);
    } catch (err) {
      logError('HousingSlice.closeHousing.persist', err);
    }
    return true;
  },

  openHousingBoard: () => {
    set({ housingOpenRequest: get().housingOpenRequest + 1 });
    const s = get();
    const phone = resolvePhoneViewport({
      isTouch: s.isTouch,
      isNarrow: s.isNarrow,
      isNativeApp: getPlatform().kind === 'capacitor',
      override: s.devPhoneOverride,
    });
    if (phone) s.pushSheet({ kind: 'housing' });
  },
});
