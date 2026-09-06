export type HousingKind = 'offer' | 'request';
export type HousingRoomType = 'bed_shared' | 'room_private' | 'flat';

export const HOUSING_KINDS: readonly HousingKind[] = ['offer', 'request'];
export const HOUSING_ROOM_TYPES: readonly HousingRoomType[] = ['bed_shared', 'room_private', 'flat'];
export const HOUSING_LIMITS = { district: 60, note: 500, contact: 120 } as const;

/** What the student types. Dates are ISO `YYYY-MM-DD`. */
export interface HousingDraft {
  kind: HousingKind;
  roomType: HousingRoomType;
  district: string;
  priceCzk: number | null;
  freeFrom: string;
  freeUntil: string | null;
  note: string;
  contact: string;
}

/** A live post as every reIS user sees it. */
export interface HousingPost extends HousingDraft {
  id: string;
  /** Poster's IS login, shown on the card. Attached after consent. */
  isLogin: string;
  /** Poster's IS person id, opens the person sheet. Attached after consent. */
  personId: string;
  createdAt: string;
  expiresAt: string;
}
