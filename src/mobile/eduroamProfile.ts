import { buildSaveDeps } from './saveDeps';
import { logError } from '../utils/reportError';

/**
 * How the eduroam profile reaches the student, as data so the rules above it
 * are testable without a plugin.
 *
 * The first four members are `SaveDeps`; `share` is the part a profile needs
 * and a downloaded document does not — see `deliverEduroamProfile`.
 */
export interface ProfileDelivery {
  kind: 'extension' | 'capacitor' | 'web';
  anchorSave(blob: Blob, filename: string): void;
  nativeSave(blob: Blob, filename: string): Promise<string>;
  assertExists(uri: string): Promise<boolean>;
  share(uri: string): Promise<void>;
}

/**
 * Puts the eduroam `.mobileconfig` where the student can open it.
 *
 * In a browser this is the download it has always been. Inside the app it is
 * not: a blob URL with `a[download]` does nothing in a WKWebView (measured, and
 * the reason `saveDocument.ts` exists), so the profile has to be written by the
 * app and then handed over.
 *
 * **Both halves are required.** `Directory.Documents` is inside the app's
 * container and `UIFileSharingEnabled` is absent from `Info.plist`, so a file
 * written and not shared is a file no student can reach — a worse outcome than
 * the error this replaces, because it looks like it worked. The share sheet is
 * what turns it into a real file on their Mac, and opening a `.mobileconfig` is
 * what starts the install in System Settings.
 *
 * Why a Mac gets a profile at all rather than the one-tap path: see
 * `resolveNativeEduroamSupport` in `eduroamNative.ts`.
 */
export async function deliverEduroamProfile(
  blob: Blob,
  filename: string,
  deps: ProfileDelivery
): Promise<void> {
  if (deps.kind !== 'capacitor') {
    deps.anchorSave(blob, filename);
    return;
  }

  const uri = await deps.nativeSave(blob, filename);
  // Before sharing, not after: sharing a path that holds nothing hands the
  // student an empty file and calls it success.
  if (!(await deps.assertExists(uri))) {
    throw new Error(`eduroam profile was not saved: ${filename}`);
  }

  try {
    await deps.share(uri);
  } catch (e) {
    // Dismissing the sheet rejects here, and that is a choice rather than a
    // fault: the file is on disk and the sheet's own instructions still hold.
    // Failing the flow for it would show an error for a deliberate tap.
    logError('Eduroam.shareProfile', e);
  }
}

/** The real wiring. Lazy plugin import, for the reason `saveDeps` gives. */
export function buildProfileDelivery(): ProfileDelivery {
  const save = buildSaveDeps();
  return {
    ...save,
    async share(uri) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ url: uri });
    },
  };
}
