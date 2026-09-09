import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchEduroamCertMaterial, fetchEduroamPassword } from '../../api/eduroam';
import { generateEduroamMobileconfig } from '../../services/eduroam/mobileconfig';
import { generateEapConfig } from '../../services/eduroam/eapConfig';
import { configureEduroam, type EduroamConfigOutcome } from '../../mobile/configureEduroam';
import { canConfigureEduroamNatively, nativeEduroamDeps } from '../../mobile/eduroamNative';
import { deliverEduroamProfile, buildProfileDelivery } from '../../mobile/eduroamProfile';
import { logError } from '../../utils/reportError';

export type EduroamStatus = 'idle' | 'working' | 'done' | 'error';
/** Which device the student is setting up — not necessarily the desktop's OS. */
export type EduroamTarget = 'mac' | 'ios' | 'android' | 'windows';

export const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent);

// macOS deep link straight to the Profiles / Device Management pane.
const PROFILES_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preferences.configurationprofiles';

/**
 * @param autoSelectTarget When provided (the eduroam sheet's platform, resolved
 * synchronously with no device picker), runs the same `selectTarget` flow the
 * desktop drawer only fires on user click — once, on mount — so the password
 * prefetch (`fetchEduroamPassword`) runs immediately and a returning student
 * sees their password chip instead of the placeholder.
 */
export function useEduroamSetup(autoSelectTarget?: EduroamTarget) {
  const [status, setStatus] = useState<EduroamStatus>('idle');
  const [target, setTarget] = useState<EduroamTarget>(autoSelectTarget ?? (isMac ? 'mac' : 'ios'));
  const [password, setPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Native-path only: what Android did with the network. Null on file paths. */
  const [outcome, setOutcome] = useState<EduroamConfigOutcome | null>(null);

  // The .p12 password is NEVER embedded: the macOS path prompts at install, and
  // the iOS transfer path must keep the profile from being a standalone credential.
  const run = useCallback(async (t: EduroamTarget) => {
    setStatus('working');
    setError(null);
    setPassword(null);
    setOutcome(null);
    try {
      const material = await fetchEduroamCertMaterial();
      const { rootCaDer, clientP12, password: extractionPw } = material;

      // On the phone itself the OS configures eduroam directly — no profile
      // file and nothing to hand over. Everything below this branch runs on the
      // machine reIS is open on.
      if (canConfigureEduroamNatively(t)) {
        const result = await configureEduroam(material, nativeEduroamDeps);
        setOutcome(result);
        setPassword(extractionPw);
        // Dismissing Android's dialog is a choice, not a fault: go back to idle
        // so the button is simply offered again, with no error banner.
        // `stale-association` joins `failed` in the error state (#261): iOS
        // installed nothing, so it must not land on the done branch — that is
        // the bug. The copy differs, driven off `outcome`, not off status.
        setStatus(
          result === 'cancelled'
            ? 'idle'
            : result === 'failed' || result === 'stale-association'
              ? 'error'
              : 'done'
        );
        return;
      }

      // A phone that reached here has no native path, and there is no longer a
      // desktop→phone transfer to fall back to. Fail loudly rather than hand it
      // a file meant for a laptop: before this guard, an Android phone whose
      // plugin was unavailable silently downloaded an Apple .mobileconfig.
      if (t === 'ios' || t === 'android') {
        throw new Error('eduroam on a phone is set up by the reIS app, not from a browser');
      }

      const xml = generateEduroamMobileconfig({ rootCaDer, clientP12 });

      // Not `saveAs`. In a browser it is the same anchor download it always
      // was, but the Mac target is now also reached from INSIDE the app — reIS
      // on a Mac is the iOS app, where NEHotspotConfiguration is unavailable
      // and a blob download is a silent no-op. deliverEduroamProfile writes the
      // file natively and hands it to the share sheet there.
      const delivery = buildProfileDelivery();
      if (t === 'windows') {
        // Windows: same .eap-config as Android, but reIS runs on this PC, so we
        // save it straight to disk. geteduroam (Windows) opens it on double-click.
        const eap = generateEapConfig({ rootCaDer, clientP12 });
        await deliverEduroamProfile(
          new Blob([eap], { type: 'application/eap-config' }),
          'eduroam-reis.eap-config',
          delivery
        );
      } else {
        await deliverEduroamProfile(
          new Blob([xml], { type: 'application/x-apple-aspen-config' }),
          'eduroam-reis.mobileconfig',
          delivery
        );
      }

      setPassword(extractionPw);
      setStatus('done');
    } catch (e) {
      logError('useEduroamSetup.run', e);
      setError((e as Error).message);
      setStatus('error');
    }
  }, []);

  const selectTarget = useCallback((t: EduroamTarget) => {
    setTarget(t);
    setStatus('idle');
    setError(null);
    setPassword(null);
    setOutcome(null);
    // Prefetch the extraction password so the chip can show it before Download.
    // Only populates when a cert already exists; first-time users get it from
    // run(). Never overwrites a value run() may have already set.
    void fetchEduroamPassword()
      .then((pw) => {
        if (pw) setPassword((prev) => prev ?? pw);
      })
      .catch((e) => logError('useEduroamSetup.prefetchPassword', e));
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setPassword(null);
    setOutcome(null);
  }, []);

  // Fires selectTarget exactly once, only when a caller (the sheet) hands us a
  // pre-resolved target. The desktop drawer never passes autoSelectTarget, so
  // this is a no-op there — selection stays a user click.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (autoSelectTarget && !didAutoSelect.current) {
      didAutoSelect.current = true;
      selectTarget(autoSelectTarget);
    }
  }, [autoSelectTarget, selectTarget]);

  // Custom-scheme link: hand off to the OS without navigating the iframe.
  const openProfilesSettings = useCallback(() => {
    const a = document.createElement('a');
    a.href = PROFILES_SETTINGS_URL;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return {
    status,
    target,
    selectTarget,
    password,
    error,
    outcome,
    run,
    reset,
    openProfilesSettings,
  };
}
