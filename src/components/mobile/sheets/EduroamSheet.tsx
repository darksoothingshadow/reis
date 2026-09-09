import { Download, Loader2, AlertTriangle, Wifi, CheckCircle2 } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { PasswordChip } from '../../Eduroam/PasswordChip';
import { useEduroamSetup, type EduroamTarget } from '../../../hooks/data/useEduroamSetup';
import { useTranslation } from '../../../hooks/useTranslation';
import { isMac, isMobile } from '../../../utils/platform';
import { canConfigureEduroamNatively, nativeEduroamTarget } from '../../../mobile/eduroamNative';
import { getPlatform } from '../../../platform';
import { isEduroamConfigured } from '../../../mobile/configureEduroam';

export interface EduroamSheetProps {
  onClose: () => void;
}

/** Which eduroam profile to hand the student — there's no device picker here
 *  (unlike the desktop drawer): the device running this sheet *is* the device
 *  being set up. Inside the app Capacitor says which OS that is; the user-agent
 *  guess is only for a browser, where a WKWebView could otherwise read as a Mac. */
function detectTarget(): EduroamTarget {
  const native = nativeEduroamTarget();
  if (native) return native;
  if (isMobile()) return isMac() ? 'ios' : 'android';
  return isMac() ? 'mac' : 'windows';
}

function NumberBadge({ n }: { n: number }) {
  return (
    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-base font-bold text-primary">
      {n}
    </span>
  );
}

/**
 * Container sheet for the eduroam flow (prototype lines 535-544): numbered rows
 * — certificate password, one-tap download for the detected device, and the
 * install/connect hint. All certificate/profile generation logic stays in
 * `useEduroamSetup` (shared with the desktop `EduroamDrawer`) — this sheet only
 * auto-picks the target and lays out the result.
 *
 * Inside the app (Android or iOS) the first row disappears: the OS saves the
 * network itself, so nothing is downloaded and no password is ever typed by a
 * human. Two steps instead of three.
 */
export function EduroamSheet({ onClose }: EduroamSheetProps) {
  const { t } = useTranslation();
  const target = detectTarget();
  const { status, password, error, outcome, run } = useEduroamSetup(target);
  const working = status === 'working';

  // On the phone itself Android saves the network directly, so there is no
  // profile to download, no QR to scan, and no password for anyone to type.
  // That collapses the flow from three steps to two.
  const native = canConfigureEduroamNatively(target);
  /**
   * reIS on a Mac: inside the app, but with no OS that will take the
   * configuration (see resolveNativeEduroamSupport). The student gets the same
   * profile a desktop browser would download, except it arrives through the
   * share sheet — so the flow gains a step the browser never needed, saying
   * what to do with the file once it is saved.
   */
  const macInApp = !native && target === 'mac' && getPlatform().kind === 'capacitor';

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('eduroam.heroTitle')}
        subtitle={t('eduroam.subtitle')}
        onClose={onClose}
      />
      <div className="flex flex-col gap-3.5 px-4 pb-6">
        {status === 'error' && (
          // A stale association is a warning, not an error: nothing broke, the
          // student has one thing to do (#261). Everything else here failed.
          <div
            className={`alert text-base ${
              outcome === 'stale-association' ? 'alert-warning' : 'alert-error'
            }`}
          >
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {/* On the native path nothing is prepared or downloaded, so the
                  profile wording would describe a step that never happens —
                  including when the throw lands before Android is ever reached
                  (a lapsed IS session, a blip fetching the certificate) and
                  outcome is therefore still null. */}
              {native
                ? outcome === 'stale-association'
                  ? t('eduroam.native.staleAssociation')
                  : outcome === 'failed'
                    ? t('eduroam.native.failed')
                    : `${t('eduroam.native.error')}${error ? `: ${error}` : ''}`
                : `${t('eduroam.error')}${error ? `: ${error}` : ''}`}
            </span>
          </div>
        )}

        {native && outcome === 'cancelled' && (
          <div className="alert alert-info text-base">
            <span>{t('eduroam.native.cancelled')}</span>
          </div>
        )}

        {status === 'done' && native && isEduroamConfigured(outcome) && (
          /* items-start, not the alert's default centring: this block is two
             lines of different weight now, and a centred icon floats against
             the middle of the paragraph instead of sitting with the headline
             it belongs to. */
          <div className="alert alert-success items-start text-base">
            <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex min-w-0 flex-col gap-1">
              <span className="font-semibold">
                {outcome === 'already-configured'
                  ? t('eduroam.native.already')
                  : t('eduroam.native.saved')}
              </span>
              {/* The note is why this block has a hierarchy at all.
                  `apply` SAVES and ASSOCIATES in one call, and out of range iOS
                  raises its OWN "Unable to join the network eduroam" alert —
                  seen on the device over this very banner. No API suppresses
                  it: there is no save-without-join. And it cannot be predicted
                  from the outcome either, because the device that showed it
                  reported plain `saved` with no error at all.
                  So the note is shown for every fresh save, hedged with "může"
                  so it stays true on campus, where the alert never appears. Not
                  for `already-configured`: nothing was applied, so iOS says
                  nothing. */}
              {outcome !== 'already-configured' && (
                <span className="text-sm opacity-90">{t('eduroam.native.savedNote')}</span>
              )}
            </div>
          </div>
        )}

        {!native && (
          <div className="flex items-center gap-3">
            <NumberBadge n={1} />
            <div className="min-w-0 flex-1">
              {password ? (
                <PasswordChip password={password} />
              ) : (
                <span className="text-base text-base-content/60">{t('eduroam.pwdLabel')}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <NumberBadge n={native ? 1 : 2} />
          <button
            type="button"
            onClick={() => run(target)}
            disabled={working}
            className="btn btn-primary flex-1 gap-2"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : native ? (
              <Wifi className="h-4 w-4" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {working
              ? native
                ? t('eduroam.native.working')
                : t('eduroam.preparing')
              : native
                ? t('eduroam.native.button')
                : macInApp
                  ? t('eduroam.macApp.button')
                  : t('eduroam.download')}
          </button>
        </div>

        {macInApp && (
          <div className="flex items-center gap-3">
            <NumberBadge n={3} />
            <span className="flex-1 text-sm text-base-content/70">
              {t('eduroam.macApp.installStep')}
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          <NumberBadge n={native ? 2 : macInApp ? 4 : 3} />
          <span className="flex-1 text-sm text-base-content/70">{t('eduroam.connectStep')}</span>
        </div>

        {native && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.privacyNote')}</p>
        )}
        {/* iOS only: a network added through NEHotspotConfiguration is removed
            with the app. Android's saved network is the student's own and
            survives, so the sentence would be false there. */}
        {native && target === 'ios' && (
          <p className="ml-9 text-sm text-base-content/60">{t('eduroam.native.iosLifetime')}</p>
        )}
      </div>
    </Sheet>
  );
}
