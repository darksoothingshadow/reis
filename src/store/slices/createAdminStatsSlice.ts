import type { AppSlice } from '../types';
import { fetchUsageStats, type UsageStats } from '../../api/usageStats';

export interface AdminStatsSlice {
  adminStats: UsageStats | null;
  adminStatsLoading: boolean;
  loadAdminStats: () => Promise<void>;
}

export const createAdminStatsSlice: AppSlice<AdminStatsSlice> = (set) => ({
  adminStats: null,
  adminStatsLoading: false,
  loadAdminStats: async () => {
    set({ adminStatsLoading: true });
    const stats = await fetchUsageStats(30);
    set({ adminStatsLoading: false, ...(stats ? { adminStats: stats } : {}) });
  },
});
