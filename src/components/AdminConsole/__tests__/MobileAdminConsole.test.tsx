import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MobileAdminConsole } from '../MobileAdminConsole';

// Leaflet needs a laid-out DOM jsdom does not provide. These assertions are
// about which surface is mounted, not about tiles, so stub the pane and mark it.
vi.mock('../AdminConsoleMap', () => ({
  AdminConsoleMap: () => <div data-testid="console-map" />,
}));

// The accounts panel talks to Supabase and the society-accounts edge function;
// these assertions are about which surface the MOBILE console mounts.
vi.mock('../../../api/societyAccounts', () => ({
  listSocietyAccounts: vi.fn().mockResolvedValue([]),
  resetSocietyPassword: vi.fn(),
  createSocietyAccount: vi.fn(),
}));

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    adminConsoleOpen: true,
    adminRole: 'association',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    societyMapEvents: [],
    composerOpen: false,
    editEventId: null,
    placingEvent: false,
    draftCoord: null,
  });
});

describe('MobileAdminConsole', () => {
  it('starts on the list, with the map one tap away', () => {
    render(<MobileAdminConsole />);
    expect(screen.getByRole('button', { name: 'Vytvořit akci' })).toBeInTheDocument();
    expect(screen.queryByTestId('console-map')).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Mapa' }));
    expect(screen.getByTestId('console-map')).toBeInTheDocument();
  });

  it('shows the map automatically while placing a pin, and hides the toggle', () => {
    useAppStore.setState({ placingEvent: true });
    render(<MobileAdminConsole />);
    expect(screen.getByTestId('console-map')).toBeInTheDocument();
    // The placing flow has its own banner and Cancel; a second way out is
    // ambiguous, so the list/map toggle is suppressed.
    expect(screen.queryByRole('tab', { name: 'Mapa' })).toBeNull();
  });

  // The bug this guards: EventComposer keeps the entire form in local useState.
  // Swapping the list out for the map unmounted it, so tapping "pick on the map"
  // silently wiped everything typed and returned an empty form.
  it('keeps the composer mounted (and its typed input) while the map is shown', () => {
    useAppStore.setState({ composerOpen: true, closeComposer: vi.fn() });
    render(<MobileAdminConsole />);

    const title = screen.getByPlaceholderText('Název akce') as HTMLInputElement;
    fireEvent.change(title, { target: { value: 'Spring Party' } });
    expect(title.value).toBe('Spring Party');

    // Go to the map — via the placing flow, which is exactly how the composer
    // asks for an off-campus coordinate. act() so the store change is flushed
    // to the tree before the assertion reads it.
    act(() => useAppStore.setState({ placingEvent: true }));
    expect(screen.getByTestId('console-map')).toBeInTheDocument();

    // …and come back. The field must still hold what was typed.
    act(() => useAppStore.setState({ placingEvent: false }));
    expect((screen.getByPlaceholderText('Název akce') as HTMLInputElement).value).toBe(
      'Spring Party'
    );
  });
});

/**
 * Sprint 08: a society could not check where an event would land before
 * publishing. On a phone the map is behind a tab, so "Ukázat na mapě" has to
 * bring that tab forward as well as move the camera.
 */
describe('MobileAdminConsole — previewing the draft location', () => {
  it('brings the map forward when the composer asks to show the draft', () => {
    useAppStore.setState({ composerOpen: true, draftCoord: [16.61, 49.21] });
    render(<MobileAdminConsole />);
    expect(screen.queryByTestId('console-map')).toBeNull();

    act(() => useAppStore.getState().previewDraftOnMap());

    expect(screen.getByTestId('console-map')).toBeInTheDocument();
  });

  it('leaves the tab alone when nothing has asked for a preview', () => {
    useAppStore.setState({ composerOpen: true, draftCoord: [16.61, 49.21] });
    render(<MobileAdminConsole />);
    expect(screen.queryByTestId('console-map')).toBeNull();
  });
});

describe('MobileAdminConsole — the preview request is per-session', () => {
  it('does not reopen onto the map because of a preview from an earlier visit', () => {
    // The counter lives in the app store and outlives the console.
    useAppStore.setState({ composerOpen: true, draftCoord: [16.61, 49.21], draftFocusRequest: 7 });
    render(<MobileAdminConsole />);
    expect(screen.queryByTestId('console-map')).toBeNull();
  });
});

// The desktop console had the accounts tab while the mobile one did not, so the
// password UI was invisible in the app the phone tree actually renders — and
// every test still passed. These pin the tab to the surface users see.
describe('MobileAdminConsole — accounts tab', () => {
  it('offers the accounts tab to a plain society, for its own password', () => {
    render(<MobileAdminConsole />);
    fireEvent.click(screen.getByRole('tab', { name: 'Účty' }));

    expect(screen.getByRole('button', { name: 'Změnit heslo' })).toBeInTheDocument();
    // No reset panel: resetting other societies is reis_admin only.
    expect(screen.queryByRole('button', { name: 'Vytvořit účet' })).not.toBeInTheDocument();
  });

  it('additionally offers create and reset to a reIS admin', () => {
    act(() => {
      useAppStore.setState({ adminRole: 'reis_admin' });
    });
    render(<MobileAdminConsole />);
    fireEvent.click(screen.getByRole('tab', { name: 'Účty' }));

    expect(screen.getByRole('button', { name: 'Vytvořit účet' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Změnit heslo' })).toBeInTheDocument();
  });
});

describe('MobileAdminConsole — tab bar at phone width', () => {
  // A reIS admin gets six tabs (Akce/Mapa/Návrhy/Bydlení/Statistiky/Účty) in one
  // flex-nowrap row. verify-ui measured this at 320px and found the row itself
  // 39px wider than the viewport with no overflow-x-auto on the tablist, so
  // "Účty" was clipped by the console's own overflow-hidden shell — not
  // scrollable, just unreachable. overflow-x-auto turns that into a swipeable
  // row instead (uiFindings.ts's own rule: clipped is worse than scrolled).
  it('lets the six reis_admin tabs scroll horizontally instead of clipping', () => {
    act(() => {
      useAppStore.setState({ adminRole: 'reis_admin' });
    });
    render(<MobileAdminConsole />);
    expect(screen.getByRole('tablist').className).toContain('overflow-x-auto');
  });

  // verify-ui measured the inactive-tab default (DaisyUI's base-content at 60%
  // opacity) by hand at 3.37:1 in the light theme — below the 4.5:1 WCAG AA
  // floor. Same bug, same fix already landed for HousingBoard/HousingForm's
  // tabs-box (see those components): full-opacity text-base-content on the
  // inactive branch.
  it('keeps inactive tab text at full opacity for AA contrast', () => {
    render(<MobileAdminConsole />);
    const inactive = screen.getByRole('tab', { name: 'Mapa' });
    expect(inactive.className).toContain('text-base-content');
  });
});
