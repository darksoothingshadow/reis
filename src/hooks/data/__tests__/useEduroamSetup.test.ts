import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { deliverEduroamProfile } from '../../../mobile/eduroamProfile';
import { useEduroamSetup } from '../useEduroamSetup';

vi.mock('../../../api/eduroam', () => ({
  fetchEduroamCertMaterial: vi.fn().mockResolvedValue({
    rootCaDer: new Uint8Array(),
    clientP12: new Uint8Array(),
    password: 'pw123',
  }),
  fetchEduroamPassword: vi.fn().mockResolvedValue('pw123'),
}));

vi.mock('../../../services/eduroam/mobileconfig', () => ({
  generateEduroamMobileconfig: vi.fn().mockReturnValue('<xml/>'),
}));

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,zz'),
  },
}));

// The delivery moved off file-saver: a blob download is a silent no-op inside
// the app, and the Mac target is now reached from there too. See
// src/mobile/eduroamProfile.ts.
vi.mock('../../../mobile/eduroamProfile', () => ({
  deliverEduroamProfile: vi.fn(async () => {}),
  buildProfileDelivery: vi.fn(() => ({ kind: 'web' })),
}));

vi.mock('../../../services/eduroam/eapConfig', () => ({
  generateEapConfig: vi.fn().mockReturnValue('<eap-config/>'),
}));

// Only the native wiring is stubbed; configureEduroam itself runs for real, so
// these tests cover the result-code mapping the student actually sees.
vi.mock('../../../mobile/eduroamNative', () => ({
  canConfigureEduroamNatively: vi.fn().mockReturnValue(false),
  nativeEduroamDeps: { configure: vi.fn() },
}));

/** Put the hook on the phone, with the plugin answering `perNetwork`. */
async function onPhone(perNetwork: string, resultCode = -1) {
  const native = await import('../../../mobile/eduroamNative');
  vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(true);
  vi.mocked(native.nativeEduroamDeps.configure).mockResolvedValue({ resultCode, perNetwork });
  return native;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('useEduroamSetup', () => {
  it('reset() clears generated state (status, password) after a successful run', async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('mac');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.password).toBe('pw123');

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.password).toBeNull();
  });

  it('autoSelectTarget prefetches the password for the given target exactly once on mount', async () => {
    const { fetchEduroamPassword } = await import('../../../api/eduroam');
    const { result } = renderHook(({ target }) => useEduroamSetup(target), {
      initialProps: { target: 'ios' as const },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchEduroamPassword).toHaveBeenCalledTimes(1);
    expect(result.current.password).toBe('pw123');
  });

  it("run('windows') saves a .eap-config file directly", async () => {
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('windows');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.password).toBe('pw123');
    expect(deliverEduroamProfile).toHaveBeenCalledWith(
      expect.any(Blob),
      'eduroam-reis.eap-config',
      expect.anything()
    );
  });

  it('configures the network natively on the phone', async () => {
    await onPhone('0');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('saved');
  });

  // Regression: with the desktop→phone transfer gone, a phone target that
  // cannot configure natively used to fall through to the file branch and
  // download a profile built for a laptop — an Apple .mobileconfig, even on
  // Android. It must fail instead.
  it.each(['ios', 'android'] as const)(
    'refuses to hand %s a desktop profile when the native path is unavailable',
    async (phone) => {
      const native = await import('../../../mobile/eduroamNative');
      vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(false);
      const { result } = renderHook(() => useEduroamSetup());

      await act(async () => {
        await result.current.run(phone);
      });

      expect(result.current.status).toBe('error');
      expect(deliverEduroamProfile).not.toHaveBeenCalled();
    }
  );

  it('treats an eduroam network that already exists as success', async () => {
    await onPhone('2');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('already-configured');
  });

  it('returns to idle when the student dismisses the system dialog', async () => {
    // RESULT_CANCELED revokes nothing, so the honest state is "not done yet" —
    // an error banner here would scold someone for changing their mind.
    await onPhone('(none)', 0);
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('idle');
    expect(result.current.outcome).toBe('cancelled');
    expect(result.current.error).toBeNull();
  });

  it('surfaces a genuine add failure as an error', async () => {
    await onPhone('1');
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('android');
    });

    expect(result.current.status).toBe('error');
    expect(result.current.outcome).toBe('failed');
  });

  it('configures natively on iOS too, reading the outcome the Swift plugin resolved', async () => {
    const native = await import('../../../mobile/eduroamNative');
    vi.mocked(native.canConfigureEduroamNatively).mockReturnValue(true);
    vi.mocked(native.nativeEduroamDeps.configure).mockResolvedValue({ outcome: 'saved' });
    const { result } = renderHook(() => useEduroamSetup());

    await act(async () => {
      await result.current.run('mac');
    });

    expect(result.current.status).toBe('done');
    expect(result.current.outcome).toBe('saved');
  });
});
