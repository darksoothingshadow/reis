import { describe, it, expect } from 'vitest';
import { HOUSING_LINK, isHousingLink } from '../housingLink';

describe('isHousingLink', () => {
  it('recognises the token, case-insensitively and with whitespace', () => {
    expect(isHousingLink(HOUSING_LINK)).toBe(true);
    expect(isHousingLink(' REIS://housing ')).toBe(true);
  });
  it('rejects real URLs, empty and missing links', () => {
    expect(isHousingLink('https://is.mendelu.cz')).toBe(false);
    expect(isHousingLink('')).toBe(false);
    expect(isHousingLink(null)).toBe(false);
    expect(isHousingLink(undefined)).toBe(false);
  });
});
