import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { getInstallId } from '../services/identity/installId';
import type { HousingDraft, HousingPost } from '../types/housing';

/**
 * The housing board is the second thing reIS sends that a student composed
 * (the first is the suggestion form). What leaves the device is exactly the
 * form the student filled in, plus their IS login and IS person id — attached
 * ONLY after the consent tick on the form, shown to every reIS user so a
 * reader can verify the poster in IS, and deleted with the post. Reads carry
 * no identity at all. The install id is the random per-install UUID from
 * services/identity; it lets this device close its own post and is never
 * returned by the list RPC.
 */
const RowSchema = z.object({
  id: z.string(),
  kind: z.enum(['offer', 'request']),
  room_type: z.enum(['bed_shared', 'room_private', 'flat']),
  district: z.string(),
  price_czk: z.number().nullable(),
  free_from: z.string(),
  free_until: z.string().nullable(),
  note: z.string(),
  contact: z.string(),
  is_login: z.string(),
  is_person_id: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});

function toPost(r: z.infer<typeof RowSchema>): HousingPost {
  return {
    id: r.id, kind: r.kind, roomType: r.room_type, district: r.district, priceCzk: r.price_czk,
    freeFrom: r.free_from, freeUntil: r.free_until, note: r.note, contact: r.contact,
    isLogin: r.is_login, personId: r.is_person_id, createdAt: r.created_at, expiresAt: r.expires_at,
  };
}

export async function fetchHousingPosts(): Promise<{ posts: HousingPost[]; ok: boolean }> {
  try {
    const { data, error } = await supabase.rpc('list_housing_posts');
    if (error) {
      logError('Api.fetchHousingPosts', new Error(error.message));
      return { posts: [], ok: false };
    }
    const posts: HousingPost[] = [];
    for (const row of (data ?? []) as unknown[]) {
      const parsed = RowSchema.safeParse(row);
      // A malformed row is dropped, not coerced: a card with "undefined" on it
      // is worse than one card fewer.
      if (parsed.success) posts.push(toPost(parsed.data));
    }
    return { posts, ok: true };
  } catch (err) {
    logError('Api.fetchHousingPosts', err);
    return { posts: [], ok: false };
  }
}

/** Returns the new post id, or null when the server refused (cap, flood, validation). */
export async function submitHousingPost(
  draft: HousingDraft,
  poster: { isLogin: string; personId: string }
): Promise<string | null> {
  if (isDemoMode()) return null;
  try {
    const { data, error } = await supabase.rpc('submit_housing_post', {
      p_kind: draft.kind,
      p_room_type: draft.roomType,
      p_district: draft.district,
      p_price_czk: draft.priceCzk,
      p_free_from: draft.freeFrom,
      p_free_until: draft.freeUntil,
      p_note: draft.note,
      p_contact: draft.contact,
      p_is_login: poster.isLogin,
      p_is_person_id: poster.personId,
      p_install_id: await getInstallId(),
    });
    if (error) {
      logError('Api.submitHousingPost', new Error(error.message));
      return null;
    }
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch (err) {
    logError('Api.submitHousingPost', err);
    return null;
  }
}

export async function closeHousingPost(id: string): Promise<boolean> {
  if (isDemoMode()) return false;
  try {
    const { data, error } = await supabase.rpc('close_housing_post', {
      p_id: id,
      p_install_id: await getInstallId(),
    });
    if (error) {
      logError('Api.closeHousingPost', new Error(error.message));
      return false;
    }
    return data === true;
  } catch (err) {
    logError('Api.closeHousingPost', err);
    return false;
  }
}
