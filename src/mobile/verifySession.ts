import { isPlausibleToken } from '../platform/sessionToken';

/** Long enough for a slow mobile connection, short enough not to own the splash. */
const DEFAULT_PROBE_TIMEOUT_MS = 8000;

/**
 * What boot learned about the token it found on disk.
 *
 * `unverified` is deliberately not a failure: it means the question could not
 * be answered, and the token is kept.
 */
export type SessionVerdict = 'no-token' | 'live' | 'discarded' | 'unverified';

export interface VerifySessionDeps {
  /** The stored token, or anything falsy/implausible when there is none. */
  getStored(): Promise<unknown>;
  /** One authenticated IS request. Rejects with `sessionExpired` when dead. */
  probe(): Promise<unknown>;
  /** Removes the stored token, so the next `ensureSession` presents login. */
  clear(): Promise<void>;
  /** How long to wait for IS before giving up and keeping the token. */
  timeoutMs?: number;
}

/**
 * A cold start must not trust a stored token just because it looks like one.
 *
 * On iOS the token outlives the app: it sits in a shared keychain group, so
 * deleting reIS and installing it again hands the next launch a credential IS
 * stopped honouring long ago. `ensureSession` only checks the SHAPE of that
 * value (`isPlausibleToken`), so it short-circuited, login was never presented,
 * and the student landed on the first-run welcome screen — whose one-tap
 * eduroam card immediately 401s, because it is the first thing in the app to
 * actually talk to IS. Tapping through then produced "sign in?" AFTER the
 * failure, which is the order the student reported.
 *
 * So: ask IS once, before `ensureSession` gets to decide.
 *
 * **Only an authentication failure discards the token.** A timeout, an outage
 * or no signal must keep it — a student on a train would otherwise be pushed
 * into a login WebView that cannot load, losing a session that was still fine
 * and the cached data behind it. The two cases are distinguishable because the
 * transport tags exactly one of them (`err.sessionExpired`); everything else,
 * including an unknown error, keeps the token.
 *
 * Never throws. It runs before the React root exists, where a rejection is a
 * blank screen with a string on it.
 */
export async function discardDeadSession(deps: VerifySessionDeps): Promise<SessionVerdict> {
  let stored: unknown;
  try {
    stored = await deps.getStored();
  } catch {
    return 'no-token';
  }
  if (!isPlausibleToken(stored)) return 'no-token';

  // Bounded, because this sits between the splash screen and the first frame.
  // CapacitorHttp's own read timeout is the platform default and can be
  // minutes; waiting that long to answer a question whose fallback is "keep
  // the token" would strand the student on the splash for no gain.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((resolve) => {
    timer = setTimeout(() => resolve('timeout'), deps.timeoutMs ?? DEFAULT_PROBE_TIMEOUT_MS);
  });

  try {
    const outcome = await Promise.race([deps.probe().then(() => 'ok' as const), timeout]);
    return outcome === 'ok' ? 'live' : 'unverified';
  } catch (e) {
    if ((e as { sessionExpired?: boolean } | null)?.sessionExpired !== true) return 'unverified';
    try {
      await deps.clear();
      return 'discarded';
    } catch {
      // The token is dead and we could not remove it. Reporting `unverified`
      // rather than `discarded` keeps the verdict honest: the next step still
      // finds the same dead token and the student still lands on the old
      // path — but nothing here pretends otherwise.
      return 'unverified';
    }
  } finally {
    clearTimeout(timer);
  }
}

