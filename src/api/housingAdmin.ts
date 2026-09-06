import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

/** Raw row as the admin sees it. install_id is deliberately not selected. */
export interface HousingAdminRow {
  id: string;
  kind: 'offer' | 'request';
  room_type: 'bed_shared' | 'room_private' | 'flat';
  district: string;
  price_czk: number | null;
  free_from: string;
  free_until: string | null;
  note: string;
  contact: string;
  is_login: string;
  is_person_id: string;
  hidden_by_admin: boolean;
  created_at: string;
  expires_at: string;
}

const COLUMNS =
  'id, kind, room_type, district, price_czk, free_from, free_until, note, contact, is_login, is_person_id, hidden_by_admin, created_at, expires_at';

// Reads run under the admin session; RLS ("Admin read housing_posts") is the
// gate. In dev:web the seeded session cannot satisfy RLS, so return an empty
// board rather than an error toast on every open.
export async function listAllHousingPosts(): Promise<HousingAdminRow[] | null> {
  if (DEV_SOCIETY) return [];
  const { data, error } = await adminAuthClient
    .from('housing_posts')
    .select(COLUMNS)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    logError('Api.listAllHousingPosts', error);
    return null;
  }
  return (data ?? []) as unknown as HousingAdminRow[];
}

// .select('id') is load-bearing: PostgREST reports no error for an UPDATE that
// matched zero rows, so an empty result is the only signal nothing was written.
export async function setHousingHidden(id: string, hidden: boolean): Promise<boolean> {
  if (DEV_SOCIETY) return true;
  const { data, error } = await adminAuthClient
    .from('housing_posts')
    .update({ hidden_by_admin: hidden })
    .eq('id', id)
    .select('id');
  if (error) {
    logError('Api.setHousingHidden', error);
    return false;
  }
  return !!data && data.length > 0;
}

export async function deleteHousingPost(id: string): Promise<boolean> {
  if (DEV_SOCIETY) return true;
  const { data, error } = await adminAuthClient.from('housing_posts').delete().eq('id', id).select('id');
  if (error) {
    logError('Api.deleteHousingPost', error);
    return false;
  }
  return !!data && data.length > 0;
}
