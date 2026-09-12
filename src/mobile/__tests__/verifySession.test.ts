import { describe, it, expect, vi } from 'vitest';
import { discardDeadSession, type VerifySessionDeps } from '../verifySession';

const TOKEN = 'a'.repeat(24);

function authError(): Error & { sessionExpired?: boolean } {
  const e = new Error('Authenticated request returned an unauthenticated page') as Error & {
    sessionExpired?: boolean;
  };
  e.sessionExpired = true;
  return e;
}

function deps(over: Partial<VerifySessionDeps> = {}): VerifySessionDeps {
  return {
    getStored: () => Promise.resolve(TOKEN),
    probe: () => Promise.resolve(),
    clear: () => Promise.resolve(),
    ...over,
  };
}

describe('discardDeadSession', () => {
  it('does not probe when nothing is stored', async () => {
    const probe = vi.fn();
    const verdict = await discardDeadSession(
      deps({ getStored: () => Promise.resolve(undefined), probe })
    );
    expect(verdict).toBe('no-token');
    expect(probe).not.toHaveBeenCalled();
  });

  it('does not probe a stored value that is not a plausible token', async () => {
    const probe = vi.fn();
    const verdict = await discardDeadSession(deps({ getStored: () => Promise.resolve('nope'), probe }));
    expect(verdict).toBe('no-token');
    expect(probe).not.toHaveBeenCalled();
  });

  it('keeps a token the probe answers as authenticated', async () => {
    const clear = vi.fn(() => Promise.resolve());
    const verdict = await discardDeadSession(deps({ clear }));
    expect(verdict).toBe('live');
    expect(clear).not.toHaveBeenCalled();
  });

  it('discards a token IS no longer accepts, so boot presents login', async () => {
    const clear = vi.fn(() => Promise.resolve());
    const verdict = await discardDeadSession(
      deps({ probe: () => Promise.reject(authError()), clear })
    );
    expect(verdict).toBe('discarded');
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('keeps the token when the probe fails for any reason other than auth', async () => {
    const clear = vi.fn(() => Promise.resolve());
    const verdict = await discardDeadSession(
      deps({ probe: () => Promise.reject(new Error('Network request failed')), clear })
    );
    expect(verdict).toBe('unverified');
    expect(clear).not.toHaveBeenCalled();
  });

  it('keeps the token when the probe does not answer in time', async () => {
    const clear = vi.fn(() => Promise.resolve());
    const verdict = await discardDeadSession(
      deps({ probe: () => new Promise(() => {}), clear, timeoutMs: 10 })
    );
    expect(verdict).toBe('unverified');
    expect(clear).not.toHaveBeenCalled();
  });

  it('keeps the token when clearing it fails, and never throws at boot', async () => {
    const verdict = await discardDeadSession(
      deps({ probe: () => Promise.reject(authError()), clear: () => Promise.reject(new Error('keychain')) })
    );
    expect(verdict).toBe('unverified');
  });
});
