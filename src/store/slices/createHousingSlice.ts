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
  /** This device's own IS login, read via getUserParams — shown on the form so
   * the poster sees what will be published, not a static placeholder string. */
  housingPosterLogin: string | null;
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

/** Union two id lists, preserving the order of `a` then any new ids from `b`. */
function unionIds(a: string[], b: string[]): string[] {
  const merged = [...a];
  for (const id of b) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

// Dedup: while a load is in flight, later calls share its promise instead of
// no-oping — a no-op call could otherwise resolve *before* the in-flight
// fetch and let a caller (e.g. publishHousing) move on believing state is
// current when it isn't yet.
let inflight: Promise<void> | null = null;

export const createHousingSlice: AppSlice<HousingSlice> = (set, get) => ({
  housingPosts: [],
  housingLoading: false,
  housingLoaded: false,
  housingMineIds: [],
  housingOpenRequest: 0,
  housingPosterLogin: null,

  loadHousing: async () => {
    if (inflight) return inflight;
    inflight = (async () => {
      set({ housingLoading: true });
      try {
        try {
          const p = await getUserParams();
          set({ housingPosterLogin: p?.username ?? null });
        } catch (err) {
          logError('HousingSlice.loadHousing.posterLogin', err);
          set({ housingPosterLogin: null });
        }
        const res = await fetchHousingPosts();
        // Read own-post ids only after the fetch settles, so a close() that
        // completes while this load was in flight (server delete, state
        // filter, IDB write) is reflected here instead of being undone by a
        // snapshot taken back when the load started. Union with whatever is
        // current in state, since another caller may have published in the
        // meantime and already merged its new id into housingMineIds.
        const mine = await readMine();
        set({
          housingMineIds: unionIds(get().housingMineIds, mine),
          ...(res.ok ? { housingPosts: res.posts, housingLoaded: true } : {}),
        });
      } finally {
        set({ housingLoading: false });
      }
    })();
    try {
      return await inflight;
    } finally {
      inflight = null;
    }
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
