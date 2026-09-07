import { describe, it, expect } from 'vitest';
import { usagePlatform } from '../usagePlatform';

describe('usagePlatform', () => {
  it('passes extension and web through', () => {
    expect(usagePlatform('extension', () => 'web')).toBe('extension');
    expect(usagePlatform('web', () => 'web')).toBe('web');
  });
  it('splits capacitor into ios and android, anything else is android', () => {
    expect(usagePlatform('capacitor', () => 'ios')).toBe('ios');
    expect(usagePlatform('capacitor', () => 'android')).toBe('android');
    expect(usagePlatform('capacitor', () => 'web')).toBe('android');
  });
});
