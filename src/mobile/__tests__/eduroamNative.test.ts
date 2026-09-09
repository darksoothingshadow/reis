import { describe, it, expect, vi, beforeEach } from 'vitest';

// registerPlugin must not touch a real bridge; Capacitor.getPlatform is what
// the target resolver reads.
const isAvailable = vi.fn(async () => ({ available: true }));
vi.mock('@capacitor/core', () => ({
  registerPlugin: vi.fn(() => ({ configure: vi.fn(), isAvailable: () => isAvailable() })),
  Capacitor: { getPlatform: vi.fn(() => 'web') },
}));

vi.mock('../../platform', () => ({
  getPlatform: vi.fn(() => ({ kind: 'web' })),
}));

import { Capacitor } from '@capacitor/core';
import { getPlatform } from '../../platform';
import {
  canConfigureEduroamNatively,
  nativeEduroamTarget,
  resolveNativeEduroamSupport,
  __setNativeEduroamSupportForTests,
} from '../eduroamNative';

function host(kind: 'extension' | 'capacitor' | 'web', os: 'ios' | 'android' | 'web' = 'web') {
  vi.mocked(getPlatform).mockReturnValue({ kind } as never);
  vi.mocked(Capacitor.getPlatform).mockReturnValue(os);
}

beforeEach(() => {
  vi.clearAllMocks();
  isAvailable.mockResolvedValue({ available: true });
  __setNativeEduroamSupportForTests(null);
});

describe('canConfigureEduroamNatively', () => {
  it('admits both phone OSes inside the Capacitor app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('ios')).toBe(true);
    host('capacitor', 'android');
    expect(canConfigureEduroamNatively('android')).toBe(true);
  });

  it('never admits a desktop target, even inside the app', () => {
    host('capacitor', 'ios');
    expect(canConfigureEduroamNatively('mac')).toBe(false);
    expect(canConfigureEduroamNatively('windows')).toBe(false);
  });

  it('keeps the desktop→phone transfer in a browser: a phone target off Capacitor is a QR', () => {
    host('extension');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
    expect(canConfigureEduroamNatively('android')).toBe(false);
    host('web');
    expect(canConfigureEduroamNatively('ios')).toBe(false);
  });
});

describe('nativeEduroamTarget', () => {
  it('reports the OS Capacitor is running on', () => {
    host('capacitor', 'ios');
    expect(nativeEduroamTarget()).toBe('ios');
    host('capacitor', 'android');
    expect(nativeEduroamTarget()).toBe('android');
  });

  it('is null off Capacitor, so callers fall back to the browser guess', () => {
    host('extension', 'ios');
    expect(nativeEduroamTarget()).toBeNull();
    host('web');
    expect(nativeEduroamTarget()).toBeNull();
  });

  it('is null when Capacitor itself says web (the dev shell)', () => {
    host('capacitor', 'web');
    expect(nativeEduroamTarget()).toBeNull();
  });
});

describe('the dev-webapp gate override', () => {
  /**
   * The card is the one part of the first-run flow a browser cannot reach, so
   * the dev host forces the gate with `?eduroam=ios`. These tests run with
   * `import.meta.env.DEV` true, which is the only condition under which the
   * override exists at all — a production bundle strips it.
   */
  function search(query: string) {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, search: query },
    });
  }

  it('names the forced OS in a browser, where there would otherwise be none', () => {
    host('web');
    search('?welcome=1&eduroam=ios');
    expect(nativeEduroamTarget()).toBe('ios');
    expect(canConfigureEduroamNatively('ios')).toBe(true);
  });

  it('accepts android too, and nothing else', () => {
    host('web');
    search('?eduroam=android');
    expect(nativeEduroamTarget()).toBe('android');
    search('?eduroam=mac');
    expect(nativeEduroamTarget()).toBeNull();
    search('?eduroam=1');
    expect(nativeEduroamTarget()).toBeNull();
  });

  it('leaves a plain browser alone when the param is absent', () => {
    host('web');
    search('');
    expect(nativeEduroamTarget()).toBeNull();
    expect(canConfigureEduroamNatively('ios')).toBe(false);
  });

  it('still refuses a desktop target — the override forces the host, not the OS', () => {
    host('web');
    search('?eduroam=ios');
    expect(canConfigureEduroamNatively('mac')).toBe(false);
    expect(canConfigureEduroamNatively('windows')).toBe(false);
  });
});


/**
 * reIS on a Mac is the iOS app under "Designed for iPad", so Capacitor answers
 * `ios` and every gate here used to admit the one-tap path. It cannot work:
 * NEHotspotConfiguration is `API_UNAVAILABLE(macos)` in the iOS SDK, and while
 * the classes do resolve in the iOS-on-Mac runtime the system refuses the
 * configuration — measured as a red error banner on a Mac against a build that
 * works on an iPhone. Only the plugin can tell us (ProcessInfo.isiOSAppOnMac);
 * a user-agent guess is the thing this module already refuses to do.
 */
describe('the iOS app running on a Mac', () => {
  // The dev-override describe above rewrites window.location and never puts it
  // back, so without this the last `?eduroam=ios` it set still forces the gate
  // here and these cases pass or fail for the wrong reason.
  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, search: '' },
    });
  });

  it('reports no native target, so the sheet falls through to the mac profile', async () => {
    host('capacitor', 'ios');
    isAvailable.mockResolvedValue({ available: false });
    await resolveNativeEduroamSupport();
    expect(nativeEduroamTarget()).toBeNull();
  });

  it('refuses the native path for every target', async () => {
    host('capacitor', 'ios');
    isAvailable.mockResolvedValue({ available: false });
    await resolveNativeEduroamSupport();
    expect(canConfigureEduroamNatively('ios')).toBe(false);
    expect(canConfigureEduroamNatively('android')).toBe(false);
  });

  it('leaves a real phone untouched', async () => {
    host('capacitor', 'ios');
    await resolveNativeEduroamSupport();
    expect(nativeEduroamTarget()).toBe('ios');
    expect(canConfigureEduroamNatively('ios')).toBe(true);
  });

  /**
   * Failing OPEN, not closed. An unanswerable plugin call must not take the
   * one-tap path away from the phones it already works on — the worst case then
   * is a Mac that behaves as it does today, not an iPhone that regresses.
   */
  it('keeps the native path when the plugin cannot answer', async () => {
    host('capacitor', 'ios');
    isAvailable.mockRejectedValue(new Error('not implemented'));
    await resolveNativeEduroamSupport();
    expect(canConfigureEduroamNatively('ios')).toBe(true);
  });

  it('asks nothing outside the app', async () => {
    host('web');
    await resolveNativeEduroamSupport();
    expect(isAvailable).not.toHaveBeenCalled();
  });
});
