import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Session } from '@supabase/supabase-js';
import { useAppStore } from '../../../store/useAppStore';
import { AdminConsole } from '../AdminConsole';

// The console mounts a real MapCanvas on desktop. Leaflet needs a laid-out DOM
// that jsdom does not provide, and none of these assertions are about the map,
// so stub the pane out.
vi.mock('../AdminConsoleMap', () => ({ AdminConsoleMap: () => <div data-testid="console-map" /> }));

const SESSION = { user: { email: 'admin@supef.cz' } } as unknown as Session;

const loggedIn = (over: Partial<ReturnType<typeof useAppStore.getState>> = {}) =>
  useAppStore.setState({
    language: 'cz',
    adminConsoleOpen: true,
    adminSession: SESSION,
    adminRole: 'association',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    societyMapEvents: [],
    composerOpen: false,
    isTouch: false,
    isNarrow: false,
    ...over,
  });

describe('AdminConsole', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      adminSession: null,
      adminRole: null,
      adminAssociationId: null,
      adminActiveAssociationId: null,
      adminConsoleOpen: true,
      societyMapEvents: [],
      composerOpen: false,
      isTouch: false,
      isNarrow: false,
      devPhoneOverride: null,
    });
  });

  it('shows the login screen when there is no admin session', () => {
    render(<AdminConsole />);
    expect(screen.getByLabelText('Název spolku')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-console')).toBeNull();
  });

  // A student who clicks the button out of curiosity must not be trapped behind
  // a credentials prompt.
  it('lets you leave from the login screen without signing in', () => {
    const closeSocietyAdmin = vi.fn();
    useAppStore.setState({ closeSocietyAdmin });
    render(<AdminConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět do reIS' }));
    expect(closeSocietyAdmin).toHaveBeenCalledTimes(1);
  });

  it('shows the console once a session exists', () => {
    loggedIn();
    render(<AdminConsole />);
    expect(screen.getByTestId('admin-console')).toBeInTheDocument();
    expect(screen.queryByLabelText('Název spolku')).toBeNull();
  });

  it('shows a fixed society chip for an association, with no picker', () => {
    loggedIn();
    render(<AdminConsole />);
    expect(screen.getByText('SU PEF')).toBeInTheDocument();
    expect(screen.queryByLabelText('Vyberte spolek')).toBeNull();
  });

  it('gives a reIS admin a society picker instead', () => {
    loggedIn({ adminRole: 'reis_admin', adminAssociationId: null, adminActiveAssociationId: null });
    render(<AdminConsole />);
    expect(screen.getByLabelText('Vyberte spolek')).toBeInTheDocument();
  });

  it('switching society in the picker sets the active association', () => {
    const setActiveAssociation = vi.fn();
    loggedIn({
      adminRole: 'reis_admin',
      adminAssociationId: null,
      adminActiveAssociationId: null,
      setActiveAssociation,
    });
    render(<AdminConsole />);
    fireEvent.change(screen.getByLabelText('Vyberte spolek'), { target: { value: 'esn' } });
    expect(setActiveAssociation).toHaveBeenCalledWith('esn');
  });

  it('"Zpět do reIS" leaves the console and logout is a separate action', () => {
    const closeSocietyAdmin = vi.fn();
    const adminLogout = vi.fn(async () => {});
    loggedIn({ closeSocietyAdmin, adminLogout });
    render(<AdminConsole />);
    fireEvent.click(screen.getByRole('button', { name: 'Zpět do reIS' }));
    expect(closeSocietyAdmin).toHaveBeenCalledTimes(1);
    expect(adminLogout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Odhlásit' }));
    expect(adminLogout).toHaveBeenCalledTimes(1);
  });

  it('renders the phone stack on a narrow touch viewport', () => {
    loggedIn({ isTouch: true, isNarrow: true });
    render(<AdminConsole />);
    expect(screen.getByTestId('admin-console-mobile')).toBeInTheDocument();
    expect(screen.queryByTestId('admin-console')).toBeNull();
  });
  it('gives the reIS admin a suggestions tab, with the unread count on it', () => {
    // The inbox is reIS-wide, so it must not appear for a society login — a
    // society has no business reading another society's students.
    loggedIn({
      adminRole: 'reis_admin',
      suggestions: [
        {
          id: 1,
          type: 'bug',
          title: 'Rozvrh se nenacita',
          body: 'Po prihlaseni je kalendar prazdny.',
          contact: null,
          screen: 'calendar',
          status: 'new',
          created_at: '2026-08-16T10:00:00Z',
          ext_version: '5.0.6',
          browser_name: 'Chrome',
          browser_version: '140',
          viewport: '1280x800',
        },
      ],
      suggestionsUnread: 1,
    });
    render(<AdminConsole />);

    const tab = screen.getByRole('tab', { name: /Návrhy/ });
    expect(screen.getByTestId('suggestions-badge')).toHaveTextContent('1');
    fireEvent.click(tab);
    expect(screen.getByText('Rozvrh se nenacita')).toBeInTheDocument();
  });

  it('shows no suggestions tab for a society login', () => {
    loggedIn({ adminRole: 'association', suggestionsUnread: 3 });
    render(<AdminConsole />);
    expect(screen.queryByRole('tab', { name: /Návrhy/ })).toBeNull();
    expect(screen.queryByTestId('suggestions-badge')).toBeNull();
  });

  // Same bug as MobileAdminConsole's tab bar (see MobileAdminConsole.test.tsx):
  // DaisyUI's inactive-.tab default (base-content at 60% opacity) measured
  // 3.37:1 by hand, below the 4.5:1 WCAG AA floor.
  it('keeps the desktop pane-switcher inactive tab text at full opacity for AA contrast', () => {
    loggedIn();
    render(<AdminConsole />);
    const inactive = screen.getByRole('tab', { name: /Účty/ });
    expect(inactive.className).toContain('text-base-content');
  });
});
