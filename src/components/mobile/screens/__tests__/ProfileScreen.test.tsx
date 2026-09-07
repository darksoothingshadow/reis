import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileScreen } from '../ProfileScreen';
import { BottomNav } from '../../nav/BottomNav';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The profile is a TAB, not a sheet.
 *
 * It carries a lot the student actually goes looking for — theme, language,
 * eduroam, study documents, subscribed societies, hidden items, sign-out — and
 * as a sheet behind the header avatar all of it was one tap deep on one screen
 * and invisible from the rest. The tab slot freed by moving search into the
 * header goes back to it.
 *
 * The header avatar goes with it: a tab and an icon that open the same screen
 * is two doors to one room, and on a 320px header the fourth 40px target was
 * already squeezing the title.
 */
describe('the profile tab', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileTab: 'profile',
      mobileSheets: [],
      keyboardOpen: false,
      fullName: 'Jana Nováková',
      studentId: '123456',
      hiddenItems: { events: [], courses: [] },
      studyPlanDual: null,
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('is offered in the bottom nav', () => {
    render(<BottomNav />);
    expect(screen.getByRole('button', { name: 'Profil' })).toBeInTheDocument();
  });

  it('switches to it on tap', () => {
    useAppStore.setState({ mobileTab: 'calendar' } as never);
    render(<BottomNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Profil' }));
    expect(useAppStore.getState().mobileTab).toBe('profile');
  });

  it('renders as a screen, with the settings that were in the sheet', () => {
    render(<ProfileScreen />);
    expect(screen.getByTestId('profile-screen')).toBeInTheDocument();
    expect(screen.getByText('Tmavý režim')).toBeInTheDocument();
    expect(screen.getByText('Eduroam')).toBeInTheDocument();
    expect(screen.getByText('Dokumenty')).toBeInTheDocument();
    expect(screen.getByText('Odhlásit se')).toBeInTheDocument();
  });

  it('shows whose profile it is', () => {
    render(<ProfileScreen />);
    expect(screen.getByText('Jana Nováková')).toBeInTheDocument();
  });

  it('still opens eduroam and documents as sheets over itself', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Eduroam'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'eduroam' }]);
  });

  it('is no longer a header action, since the tab is the way in', () => {
    useAppStore.setState({
      mobileTab: 'calendar',
      mobileSelectedDayIso: '2026-04-20',
      schedule: { data: [], status: 'success' } as never,
      firstSyncSettled: true,
      syncLoaded: { schedule: true },
    } as never);
    render(<CalendarScreen />);
    expect(screen.queryByLabelText('Profil')).not.toBeInTheDocument();
    // The other three stay.
    expect(screen.getByLabelText('Rozbalit vývěsku')).toBeInTheDocument();
    expect(screen.getByLabelText('Hledat')).toBeInTheDocument();
    expect(screen.getByLabelText('Oznámení')).toBeInTheDocument();
  });

  it('renders five nav buttons again', () => {
    render(<BottomNav />);
    expect(screen.getAllByRole('button')).toHaveLength(5);
  });
});
