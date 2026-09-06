/**
 * A society post whose `url` is this token opens the housing board inside reIS
 * instead of a browser tab. It is checked BEFORE openExternal, which would
 * (correctly) refuse a non-http URL.
 */
export const HOUSING_LINK = 'reis://housing';

export function isHousingLink(link: string | null | undefined): boolean {
  return typeof link === 'string' && link.trim().toLowerCase() === HOUSING_LINK;
}
