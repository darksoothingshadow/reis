import { describe, it, expect, vi, beforeEach } from 'vitest';

const chain = { select: vi.fn(), order: vi.fn(), limit: vi.fn(), update: vi.fn(), eq: vi.fn(), delete: vi.fn() };
const from = vi.fn((...args: unknown[]) => {
  void args;
  return chain;
});
vi.mock('@/services/admin/authClient', () => ({ adminAuthClient: { from: (...a: unknown[]) => from(...a) } }));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));

import { listAllHousingPosts, setHousingHidden, deleteHousingPost } from '../housingAdmin';

describe('housingAdmin api', () => {
  beforeEach(() => {
    Object.values(chain).forEach((f) => f.mockReset().mockReturnValue(chain));
    from.mockClear();
  });

  it('lists every post including hidden ones, newest first', async () => {
    chain.limit.mockResolvedValue({ data: [{ id: 'a', hidden_by_admin: true }], error: null });
    const rows = await listAllHousingPosts();
    expect(from).toHaveBeenCalledWith('housing_posts');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(rows).toEqual([{ id: 'a', hidden_by_admin: true }]);
  });

  it('returns null on a failed read', async () => {
    chain.limit.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await listAllHousingPosts()).toBeNull();
  });

  it('hide reports false when no row was updated', async () => {
    chain.select.mockResolvedValue({ data: [], error: null });
    expect(await setHousingHidden('a', true)).toBe(false);
    expect(chain.update).toHaveBeenCalledWith({ hidden_by_admin: true });
  });

  it('delete reports true when a row went', async () => {
    chain.select.mockResolvedValue({ data: [{ id: 'a' }], error: null });
    expect(await deleteHousingPost('a')).toBe(true);
  });
});
