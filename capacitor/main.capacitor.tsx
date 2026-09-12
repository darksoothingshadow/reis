// MUST be first: installs the Capacitor host before anything reads it.
import './installCapacitorPlatform';

import { createRoot } from 'react-dom/client';
import { SplashScreen } from '@capacitor/splash-screen';
import { App as CapApp } from '@capacitor/app';
// Static on purpose, unlike the `@/entrypoints/main/main` import below: that
// module renders the React root on evaluation, which is why IT stays dynamic
// (see the comment in startApp). A stylesheet has no such side effect — it
// only affects paint — so importing it here up front is safe, and it is the
// only way LoginGate (rendered before startApp ever runs) gets styled at all.
// Keep this list identical to src/entrypoints/main/main.tsx lines 3-11; if
// that list changes, mirror it here too, or the gate silently regresses to
// unstyled again.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';
import '@/index.css';
import { ensureSession, LoginCancelledError } from '@/mobile/ensureSession';
import { buildInAppLoginDeps } from '@/mobile/inAppLoginDeps';
import { discardDeadSession } from '@/mobile/verifySession';
import { fetchWithAuth, BASE_URL } from '@/api/client';
import { handleBackPress } from '@/mobile/backButton';
import { resolveNativeEduroamSupport } from '@/mobile/eduroamNative';
import { installMobileActionHandler } from '@/mobile/actionHandler';
import { installExternalLinkHandler } from '@/mobile/openExternal';
import { promptSessionRecovery } from '@/mobile/sessionRecovery';
import { purgePlaintextToken, loadStoredToken, clearStoredToken } from '@/platform/tokenStore';
import { setSessionExpiredHandler } from '@/services/sessionExpiry';
import { setDemoErrorHandler } from '@/utils/reportError';
import { handleDemoError } from '@/mobile/demoToast';
import { useAppStore } from '@/store/useAppStore';
import { LoginGate } from '@/components/mobile/LoginGate';

/**
 * Android's hardware back unwinds the sheet stack, then the tab, before
 * exiting. Registered before boot so it works even while the login WebView is
 * up — no tab exists then, and handleBackPress falls through to exit.
 */
void CapApp.addListener('backButton', () => {
  const s = useAppStore.getState();
  const result = handleBackPress({
    sheetCount: s.mobileSheets.length,
    popSheet: s.popSheet,
    bulletinOpen: s.bulletinExpanded,
    closeBulletin: () => void s.setBulletinExpanded(false),
    tab: s.mobileTab,
    goToCalendar: () => s.setMobileTab('calendar'),
  });
  if (result === 'exit') {
    void CapApp.exitApp();
  }
});

async function boot(): Promise<void> {
  // BEFORE ensureSession, which is what reads the token and decides whether to
  // present login. Installs from before #172 hold a live UISAuth in plain
  // Preferences; it is deleted rather than migrated, so the student signs in
  // once and the plaintext copy is gone by deletion rather than by trusting a
  // copy step.
  await purgePlaintextToken();

  // BEFORE ensureSession too, and for a related reason: ensureSession accepts
  // the stored token on SHAPE alone, and on iOS that token outlives the app —
  // the shared keychain group hands a reinstall the credential the previous
  // install left behind. IS stopped honouring it long ago, so login was never
  // presented and the student landed on the first-run welcome screen, whose
  // one-tap eduroam card is the first thing in the app to actually talk to IS.
  // It 401'd, and the "sign in?" prompt arrived AFTER the failure.
  //
  // `studium.pl` rather than a fresh endpoint: schedule.ts already GETs it on
  // every mobile sync, so it is proven to come back as authenticated HTML
  // through this exact transport. Nothing here throws, and only a real
  // authentication failure discards anything — see discardDeadSession.
  await discardDeadSession({
    getStored: () => loadStoredToken().catch(() => undefined),
    probe: () => fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`),
    clear: () => clearStoredToken(),
  });

  // Same deps as re-login after a lapse (mobile/sessionRecovery), deliberately
  // shared: ensureSession's cookie-polling contract only holds if onPageLoaded
  // and readCookies come from the same WebView openLogin presented, and two
  // copies of that would drift.
  await ensureSession(await buildInAppLoginDeps());

  await startApp({ demo: false });
}

/**
 * Everything after a session exists — or after someone chose the demo.
 *
 * Extracted rather than duplicated for the demo path: the order below is
 * load-bearing and each step carries a comment saying why it sits where it
 * does. Two copies would drift on the first change.
 */
export async function startApp({ demo }: { demo: boolean }): Promise<void> {
  // Before the React root: the app posts REIS_ACTION as soon as it renders
  // (a watchdog exam refresh, a tapped download), and with no responder those
  // sit until the 30 s timeout. Installing first means none are missed.
  installMobileActionHandler();

  // Before the React root too: a target="_blank" link that slips through opens
  // in the SYSTEM BROWSER, which has no IS session, so the student lands on a
  // login page instead of their document. One document-level interceptor
  // covers every such link rather than an edit per call site — a list of these
  // has already gone stale three times in the plan.
  installExternalLinkHandler();

  // The sync reports a lapsed session through a registry it can depend on
  // without dragging this prompt into the extension's content script. Nothing
  // registers a handler there, so nothing happens there.
  setSessionExpiredHandler(promptSessionRecovery);

  // Same inversion, same reason: logError is called from everywhere including
  // the content script, so demoToast — and through it sonner — must not be
  // reachable from it by a static import. The extension itself never enters
  // demo mode, so it registering nothing costs it nothing. (Demo mode is no
  // longer Capacitor-only, though: the deployed web preview registers the
  // same handler early, in dev/earlyDemoMode.ts, for the same reason.)
  setDemoErrorHandler(handleDemoError);

  // Before the root renders, for the same reason as hydrateWelcome below: the
  // welcome screen's eduroam card and the eduroam sheet both read the answer
  // synchronously while rendering, and only the native half knows it. On a Mac
  // it is what turns the one-tap card into the profile download that macOS can
  // actually install. Never throws — see resolveNativeEduroamSupport.
  await resolveNativeEduroamSupport();

  // Before the root renders, so the first frame is already either the welcome
  // or the app — never the app with the welcome flashing over it a tick later.
  await useAppStore.getState().hydrateWelcome({ demo });

  // Dynamic import on purpose: this module renders the React root on
  // evaluation, so a static import would boot the app BEFORE a session exists
  // and every sync request would fail its auth check.
  await import('@/entrypoints/main/main');
  await SplashScreen.hide();

  // Demo data is seeded, static and complete. Syncing would only produce
  // failed IS requests, and fetchWithAuth throws DemoModeError anyway.
  if (demo) return;

  // In the extension the CONTENT SCRIPT drives this and posts results into the
  // iframe. Capacitor has neither, so the app drives its own sync; sendToIframe
  // loops the results back to this same window, where useAppLogic's existing
  // handler consumes them unchanged.
  // startSyncService fires an immediate boot sync and then sets the
  // SYNC_INTERVAL timer — no separate first call needed.
  const { requestSync, startSyncService } = await import('@/injector/syncGate');
  startSyncService();

  // IS's session is a sliding inactivity window, so a returning student is
  // usually still authenticated — refresh on resume rather than only at boot.
  //
  // Through the gate, not straight into syncAllData: unconditionally, this cost
  // a full ~120-request crawl every time the student tabbed away and back, even
  // for ten seconds. MIN_SYNC_GAP collapses those; a resume after a real
  // absence still syncs.
  void CapApp.addListener('resume', () => {
    void requestSync('resume');
  });
}

/** The sign-in gate, rendered without a session and without the app behind it. */
/**
 * The last-resort message.
 *
 * Shared by boot() and by the gate's own handlers rather than written twice:
 * once the gate has unmounted there is no React tree left, so a rejection with
 * no handler leaves a blank screen — which is the failure this whole screen
 * exists to remove.
 */
function showFatalError(e: unknown): void {
  document.getElementById('root')!.textContent = `reIS failed to start: ${String(e)}`;
}

// Exported for startApp.test.ts to verify the pre-render theme fix directly,
// the same reason startApp itself is exported below.
export async function showLoginGate(): Promise<void> {
  // Reused rather than re-reading IndexedDB here: createThemeSlice.loadTheme
  // already does exactly this (read 'reis_theme', validate, fall back to
  // DEFAULT_THEME, set data-theme) and every other theme-sync path in the app
  // (BroadcastChannel listeners, THEME_UPDATE) goes through the same action —
  // a second copy of the validation would drift the day DEFAULT_THEME changes.
  // Calling it here is safe because it is idempotent: it only reads storage
  // and re-applies the attribute, and startApp's own boot sequence calls it
  // again once the real app mounts. Awaited so the gate never paints one
  // frame in DaisyUI's unthemed default before the real theme lands.
  await useAppStore.getState().loadTheme();

  const root = createRoot(document.getElementById('root')!);
  root.render(
    <LoginGate
      onSignIn={() => {
        void (async () => {
          await ensureSession(await buildInAppLoginDeps());
          root.unmount();
          await startApp({ demo: false });
        })().catch((e: unknown) => {
          // The same judgement boot() makes below, and for the same reason:
          // dismissing login is a choice, not a failure. It needs repeating
          // here because this is the SECOND dismissal — someone who reached
          // the gate by backing out once, tried the button, and backed out
          // again — and showFatalError would wipe #root, leaving a dead
          // string where a mounted gate and its demo button already are.
          // Nothing to re-render: root.unmount() above runs only after
          // ensureSession resolves, so the gate is still on screen.
          if (e instanceof LoginCancelledError) return;
          showFatalError(e);
        });
      }}
      onDemoStarted={() => {
        root.unmount();
        void startApp({ demo: true }).catch(showFatalError);
      }}
    />
  );
}

void boot().catch(async (e) => {
  await SplashScreen.hide();

  // Backing out of login is not a failure — it is the only path someone
  // without a MENDELU account has, App Store reviewers included. Anything
  // else keeps the old error text.
  if (e instanceof LoginCancelledError) {
    await showLoginGate();
    return;
  }

  showFatalError(e);
});
