import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({
  adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchUsageStats } from '../usageStats';

describe('fetchUsageStats', () => {
  it('maps the json to camelCase and keeps -1 as the suppression marker', async () => {
    rpc.mockResolvedValue({
      data: {
        today: 12,
        d7: 40,
        d30: 90,
        by_faculty: [
          { key: 'PEF', installs: 50 },
          { key: 'LDF', installs: -1 },
        ],
        by_platform: [{ key: 'extension', installs: 70 }],
        weekly: [{ week_start: '2026-08-31', installs: 40 }],
      },
      error: null,
    });
    expect(await fetchUsageStats(30)).toEqual({
      today: 12,
      d7: 40,
      d30: 90,
      byFaculty: [
        { key: 'PEF', installs: 50 },
        { key: 'LDF', installs: -1 },
      ],
      byPlatform: [{ key: 'extension', installs: 70 }],
      weekly: [{ weekStart: '2026-08-31', installs: 40 }],
    });
    expect(rpc).toHaveBeenCalledWith('usage_stats', { p_days: 30 });
  });

  it('returns null on error or malformed json', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
    expect(await fetchUsageStats(30)).toBeNull();
    rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
    expect(await fetchUsageStats(30)).toBeNull();
  });
});
