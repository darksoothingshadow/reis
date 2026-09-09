import { describe, it, expect, vi } from 'vitest';
import { deliverEduroamProfile, type ProfileDelivery } from '../eduroamProfile';

function deps(over: Partial<ProfileDelivery> = {}): ProfileDelivery {
  return {
    kind: 'capacitor',
    anchorSave: vi.fn(),
    nativeSave: vi.fn(async () => 'file:///c/Documents/eduroam-reis.mobileconfig'),
    assertExists: vi.fn(async () => true),
    share: vi.fn(async () => {}),
    ...over,
  };
}

const blob = () => new Blob(['<plist/>'], { type: 'application/x-apple-aspen-config' });

describe('deliverEduroamProfile', () => {
  it('downloads through the anchor off Capacitor, where a[download] works', async () => {
    const d = deps({ kind: 'web' });
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.anchorSave).toHaveBeenCalled();
    expect(d.nativeSave).not.toHaveBeenCalled();
    expect(d.share).not.toHaveBeenCalled();
  });

  /**
   * A blob URL and `a[download]` do NOTHING inside a WKWebView — the same
   * measured fact `saveDocument.ts` exists for. On a Mac that was the whole
   * feature failing silently, so the app writes the file itself.
   */
  it('writes the file natively inside the app', async () => {
    const d = deps();
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.nativeSave).toHaveBeenCalledWith(expect.any(Blob), 'eduroam-reis.mobileconfig');
    expect(d.anchorSave).not.toHaveBeenCalled();
  });

  /**
   * The app's Documents directory is NOT exposed to Files: `UIFileSharingEnabled`
   * is absent from Info.plist, so a profile written there sits in a container
   * path no student will ever open. Handing it to the share sheet is what makes
   * it reachable — and on macOS, opening the saved .mobileconfig is what starts
   * the install in System Settings. Writing without sharing would be a worse
   * outcome than the error banner it replaces.
   */
  it('hands the saved file to the share sheet, or the student cannot reach it', async () => {
    const d = deps();
    await deliverEduroamProfile(blob(), 'eduroam-reis.mobileconfig', d);
    expect(d.share).toHaveBeenCalledWith('file:///c/Documents/eduroam-reis.mobileconfig');
  });

  it('shares only after the write is confirmed', async () => {
    const order: string[] = [];
    const d = deps({
      nativeSave: vi.fn(async () => {
        order.push('save');
        return 'file:///c/x';
      }),
      assertExists: vi.fn(async () => {
        order.push('assert');
        return true;
      }),
      share: vi.fn(async () => {
        order.push('share');
      }),
    });
    await deliverEduroamProfile(blob(), 'x.mobileconfig', d);
    expect(order).toEqual(['save', 'assert', 'share']);
  });

  /** Same reason saveBlob asserts: a silent no-op is the failure that ships. */
  it('throws when the file did not land, rather than sharing nothing', async () => {
    const d = deps({ assertExists: vi.fn(async () => false) });
    await expect(deliverEduroamProfile(blob(), 'x.mobileconfig', d)).rejects.toThrow(
      /x\.mobileconfig/
    );
    expect(d.share).not.toHaveBeenCalled();
  });

  /**
   * A dismissed share sheet is a choice, not a fault. The file is already on
   * disk and the sheet's instructions still apply, so swallowing this keeps the
   * flow on its success branch instead of showing an error for a tap the
   * student deliberately made.
   */
  it('treats a dismissed share sheet as done, not as a failure', async () => {
    const d = deps({ share: vi.fn(async () => Promise.reject(new Error('canceled'))) });
    await expect(deliverEduroamProfile(blob(), 'x.mobileconfig', d)).resolves.toBeUndefined();
  });
});
