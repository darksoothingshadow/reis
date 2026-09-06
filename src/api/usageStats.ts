import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const Group = z.object({ key: z.string(), installs: z.number() });
const Schema = z.object({
  today: z.number(),
  d7: z.number(),
  d30: z.number(),
  by_faculty: z.array(Group),
  by_platform: z.array(Group),
  weekly: z.array(z.object({ week_start: z.string(), installs: z.number() })),
});

export interface UsageGroup {
  key: string;
  installs: number;
}

export interface UsageStats {
  today: number;
  d7: number;
  d30: number;
  byFaculty: UsageGroup[];
  byPlatform: UsageGroup[];
  weekly: { weekStart: string; installs: number }[];
}

/**
 * Admin-only aggregate read: counts of installs, never people. -1 means
 * "under 5" (the RPC's own suppression floor) and is passed through as-is —
 * never clamped or renamed — so the UI can render it as "< 5".
 */
export async function fetchUsageStats(days: number): Promise<UsageStats | null> {
  if (DEV_SOCIETY) return { today: 0, d7: 0, d30: 0, byFaculty: [], byPlatform: [], weekly: [] };
  const { data, error } = await adminAuthClient.rpc('usage_stats', { p_days: days });
  if (error) {
    logError('Api.fetchUsageStats', error);
    return null;
  }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) {
    logError('Api.fetchUsageStats', new Error('malformed usage_stats'));
    return null;
  }
  const d = parsed.data;
  return {
    today: d.today,
    d7: d.d7,
    d30: d.d30,
    byFaculty: d.by_faculty,
    byPlatform: d.by_platform,
    weekly: d.weekly.map((w) => ({ weekStart: w.week_start, installs: w.installs })),
  };
}
