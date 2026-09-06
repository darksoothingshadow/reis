import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchHousingPosts = vi.fn();
const submitHousingPost = vi.fn();
const closeHousingPost = vi.fn();
vi.mock('../../../api/housing', () => ({
  fetchHousingPosts: (...a: unknown[]) => fetchHousingPosts(...a),
  submitHousingPost: (...a: unknown[]) => submitHousingPost(...a),
  closeHousingPost: (...a: unknown[]) => closeHousingPost(...a),
}));
vi.mock('../../../utils/userParams', () => ({
  getUserParams: async () => ({ username: 'xnovak', studentId: '123456' }),
}));
const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));
vi.mock('../../../platform', () => ({
  getPlatform: () => ({ kind: 'web' }),
}));

import { createHousingSlice, type HousingSlice } from '../createHousingSlice';
import type { HousingDraft } from '../../../types/housing';

const draft: HousingDraft = {
  kind: 'offer', roomType: 'room_private', district: 'Brno', priceCzk: 7000,
  freeFrom: '2026-09-15', freeUntil: null, note: '', contact: 'ja@example.com',
};
const post = { ...draft, id: 'p1', isLogin: 'xnovak', personId: '123456', createdAt: 'c', expiresAt: 'e' };

describe('createHousingSlice', () => {
  let state: HousingSlice & {
    pushSheet: ReturnType<typeof vi.fn>;
    isTouch: boolean;
    isNarrow: boolean;
    devPhoneOverride: boolean | null;
  };
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    idb.clear();
    fetchHousingPosts.mockReset().mockResolvedValue({ posts: [post], ok: true });
    submitHousingPost.mockReset().mockResolvedValue('p1');
    closeHousingPost.mockReset().mockResolvedValue(true);
    set = vi.fn((u) => { const p = typeof u === 'function' ? u(state) : u; state = { ...state, ...p }; });
    get = vi.fn(() => state);
    state = {
      ...createHousingSlice(set as never, get as never, {} as never),
      pushSheet: vi.fn(),
      isTouch: true,
      isNarrow: true,
      devPhoneOverride: null,
    } as never;
  });

  it('loads posts and this install\'s own ids from IDB', async () => {
    idb.set('housing_posts_mine', ['p1']);
    await state.loadHousing();
    expect(state.housingPosts).toEqual([post]);
    expect(state.housingLoaded).toBe(true);
    expect(state.housingMineIds).toEqual(['p1']);
  });

  it('keeps housingLoaded false when the load fails', async () => {
    fetchHousingPosts.mockResolvedValue({ posts: [], ok: false });
    await state.loadHousing();
    expect(state.housingLoaded).toBe(false);
    expect(state.housingLoading).toBe(false);
  });

  it('publishes with the IS identity, remembers the id, and reloads', async () => {
    const result = await state.publishHousing(draft);
    expect(result).toBe('ok');
    expect(submitHousingPost).toHaveBeenCalledWith(draft, { isLogin: 'xnovak', personId: '123456' });
    expect(state.housingMineIds).toEqual(['p1']);
    expect(idb.get('housing_posts_mine')).toEqual(['p1']);
    expect(fetchHousingPosts).toHaveBeenCalled();
  });

  it('reports refused when the server returns null', async () => {
    submitHousingPost.mockResolvedValue(null);
    expect(await state.publishHousing(draft)).toBe('refused');
  });

  it('closes a post, forgets the id, and drops it from the list', async () => {
    idb.set('housing_posts_mine', ['p1']);
    await state.loadHousing();
    expect(await state.closeHousing('p1')).toBe(true);
    expect(state.housingMineIds).toEqual([]);
    expect(state.housingPosts).toEqual([]);
  });

  it('openHousingBoard bumps the request counter and pushes the sheet on a phone', () => {
    state.isTouch = true;
    state.isNarrow = true;
    state.openHousingBoard();
    expect(state.housingOpenRequest).toBe(1);
    expect(state.pushSheet).toHaveBeenCalledWith({ kind: 'housing' });
  });

  it('openHousingBoard bumps the request counter but does not push a sheet on desktop', () => {
    state.isTouch = false;
    state.isNarrow = false;
    state.openHousingBoard();
    expect(state.housingOpenRequest).toBe(1);
    expect(state.pushSheet).not.toHaveBeenCalled();
  });
});
