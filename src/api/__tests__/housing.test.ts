import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
const demo = vi.fn(() => false);
vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => demo() }));
vi.mock('../../services/identity/installId', () => ({ getInstallId: async () => 'install-1' }));

import { fetchHousingPosts, submitHousingPost, closeHousingPost } from '../housing';

const row = {
  id: 'p1',
  kind: 'offer',
  room_type: 'room_private',
  district: 'Královo Pole',
  price_czk: 7500,
  free_from: '2026-09-15',
  free_until: null,
  note: 'Klidný pokoj',
  contact: 'ja@example.com',
  is_login: 'xnovak',
  is_person_id: '123456',
  created_at: '2026-09-06T10:00:00Z',
  expires_at: '2026-09-20T10:00:00Z',
};

describe('housing api', () => {
  beforeEach(() => {
    rpc.mockReset();
    demo.mockReset().mockReturnValue(false);
  });

  it('maps rows to camelCase posts and drops malformed rows', async () => {
    rpc.mockResolvedValue({ data: [row, { id: 'bad' }], error: null });
    const res = await fetchHousingPosts();
    expect(rpc).toHaveBeenCalledWith('list_housing_posts');
    expect(res.ok).toBe(true);
    expect(res.posts).toEqual([
      {
        id: 'p1',
        kind: 'offer',
        roomType: 'room_private',
        district: 'Královo Pole',
        priceCzk: 7500,
        freeFrom: '2026-09-15',
        freeUntil: null,
        note: 'Klidný pokoj',
        contact: 'ja@example.com',
        isLogin: 'xnovak',
        personId: '123456',
        createdAt: '2026-09-06T10:00:00Z',
        expiresAt: '2026-09-20T10:00:00Z',
      },
    ]);
  });

  it('reports a failed load as ok:false with no posts', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchHousingPosts()).toEqual({ posts: [], ok: false });
  });

  it('submits the draft with the poster identity and install id, returning the id', async () => {
    rpc.mockResolvedValue({ data: 'new-id', error: null });
    const id = await submitHousingPost(
      {
        kind: 'request',
        roomType: 'bed_shared',
        district: 'Brno',
        priceCzk: null,
        freeFrom: '2026-09-10',
        freeUntil: null,
        note: '',
        contact: 'tel 777',
      },
      { isLogin: 'xtest', personId: '42' }
    );
    expect(id).toBe('new-id');
    expect(rpc).toHaveBeenCalledWith('submit_housing_post', {
      p_kind: 'request',
      p_room_type: 'bed_shared',
      p_district: 'Brno',
      p_price_czk: null,
      p_free_from: '2026-09-10',
      p_free_until: null,
      p_note: '',
      p_contact: 'tel 777',
      p_is_login: 'xtest',
      p_is_person_id: '42',
      p_install_id: 'install-1',
    });
  });

  it('returns null when the server refuses (rate limit or validation)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const id = await submitHousingPost(
      {
        kind: 'offer',
        roomType: 'flat',
        district: 'Brno',
        priceCzk: 1,
        freeFrom: '2026-09-10',
        freeUntil: null,
        note: '',
        contact: 'x',
      },
      { isLogin: 'x', personId: '1' }
    );
    expect(id).toBeNull();
  });

  it('closes with the install id and reports the boolean', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await closeHousingPost('p1')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('close_housing_post', {
      p_id: 'p1',
      p_install_id: 'install-1',
    });
  });

  it('does not close anything in demo mode', async () => {
    demo.mockReturnValue(true);
    expect(await closeHousingPost('p1')).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
});
