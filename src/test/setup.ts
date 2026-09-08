import 'fake-indexeddb/auto';
import { vi, expect } from 'vitest';

// happy-dom 20.12 grew `Element.animate()`. motion feature-detects it and takes
// the Web Animations path, and on unmount `Animation.cancel()` rejects a
// `finished` promise nobody awaits — every run then ends in
// "Unhandled Rejection: AbortError: The animation was canceled" although all
// tests pass (happy-dom 20.14 / motion 13.2, 2026-09-07). Before 20.12 there
// was no `animate` and motion used its JS fallback; removing it puts the tests
// back on exactly that path, and lets happy-dom keep updating.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (Element.prototype as any).animate;
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Partial mock of chrome.storage
const storageMock = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  sync: {
    // Keep sync mocked even if we don't use it, to prevent crashes
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
  },
  onChanged: {
    addListener: vi.fn(),
    removeListener: vi.fn(),
  },
};

// Partial mock of chrome.runtime
const runtimeMock = {
  id: 'test-extension-id',
  getManifest: vi.fn(() => ({ version: '1.0.0' })),
  getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
};

// Stub the global chrome object
vi.stubGlobal('chrome', {
  storage: storageMock,
  runtime: runtimeMock,
});

// Clean up mocks after each test if needed (optional, depending on preference)
// beforeEach(() => {
//   vi.clearAllMocks();
// });

/**
 * happy-dom opens a 1024×768 window, which in this app's terms is a TABLET.
 *
 * That is the wrong default for the mobile tree. `useWideViewport` flips the
 * map's event panel from a bottom sheet to a right-hand rail at 768px, so
 * every phone-shell test silently began exercising the rail — no drag handle,
 * no peek row, no detents — and seventeen of them failed on markup that was
 * working exactly as designed at the width they were unknowingly asking for.
 *
 * A phone is the honest default here: the tests that mount `MobileApp` are
 * phone tests. A test that wants the tablet says so, by widening the viewport
 * itself.
 */
(
  window as unknown as { happyDOM?: { setViewport(v: { width: number; height: number }): void } }
).happyDOM?.setViewport({ width: 390, height: 844 });
