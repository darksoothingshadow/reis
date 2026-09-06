import type { AppSlice } from '../types';
import { listAllHousingPosts, setHousingHidden, deleteHousingPost, type HousingAdminRow } from '../../api/housingAdmin';

export interface HousingAdminSlice {
  adminHousing: HousingAdminRow[];
  adminHousingLoading: boolean;
  loadAdminHousing: () => Promise<void>;
  hideAdminHousing: (id: string, hidden: boolean) => Promise<void>;
  deleteAdminHousing: (id: string) => Promise<void>;
}

export const createHousingAdminSlice: AppSlice<HousingAdminSlice> = (set, get) => ({
  adminHousing: [],
  adminHousingLoading: false,
  loadAdminHousing: async () => {
    set({ adminHousingLoading: true });
    const rows = await listAllHousingPosts();
    set({ adminHousingLoading: false, ...(rows ? { adminHousing: rows } : {}) });
  },
  hideAdminHousing: async (id, hidden) => {
    if (!(await setHousingHidden(id, hidden))) return;
    set({ adminHousing: get().adminHousing.map((r) => (r.id === id ? { ...r, hidden_by_admin: hidden } : r)) });
  },
  deleteAdminHousing: async (id) => {
    if (!(await deleteHousingPost(id))) return;
    set({ adminHousing: get().adminHousing.filter((r) => r.id !== id) });
  },
});
