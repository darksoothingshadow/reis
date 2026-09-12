import { isPlausibleToken } from '../platform/sessionToken';

/** Long enough for a slow mobile connection, short enough not to own the splash. */
const DEFAULT_PROBE_TIMEOUT_MS = 8000;

/**
 * What boot learned about the token it found on disk.
 *
 * `unverified` is deliberately not a failure: it means the question could not
 * be answered, and the token is kept.
 */
export type SessionVerdict = 'no-token' | 'skipped' | 'live' | 'discarded' | 'unverified';

export interface VerifySessionDeps {
  /** The stored token, or anything falsy/implausible when there is none. */
  getStored(): Promise<unknown>;
  /** One authenticated IS request. Rejects with `sessionExpired` when dead. */
  probe(): Promise<unknown>;
  /** Removes the stored token, so the next `ensureSession` presents login. */
  clear(): Promise<void>;
  /**
   * Whether this launch is worth a blocking request at all. Absent means yes.
   *
   * Defaults to yes because a caller that cannot answer must not silently opt
   * out of the check that presents login.
   */
  shouldVerify?(): Promise<boolean>;
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

  // This sits in front of the splash screen, so it must not become a network
  // round-trip every returning student pays to open the app — on bad campus
  // wi-fi that is seconds of splash where a timetable used to be, a visible
  // regression traded for a bug only a reinstall can hit.
  //
  // It does not have to be. The bug is an ASYMMETRY between two stores: the
  // token survives in the shared keychain group, while `welcome_dismissed`
  // lives in IndexedDB, inside the app container iOS deletes with the app. So
  // "a token, but no record of ever having got past the welcome screen" is the
  // signature of exactly the population with the bug, and everyone else keeps
  // the offline cold start they had. A dead token there still surfaces the way
  // it always has — `promptSessionRecovery`, with cached data on screen.
  //
  // Fails OPEN: an unanswerable question means probe, never skip.
  try {
    if ((await deps.shouldVerify?.()) === false) return 'skipped';
  } catch {
    // Probe.
  }

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

