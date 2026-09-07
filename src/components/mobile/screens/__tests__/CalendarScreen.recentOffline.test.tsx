import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The recent-files shelf is a device-only thing: it needs no schedule and no
 * IS. So the state in which the schedule fetch FAILED — offline, on the tram —
 * is exactly the state in which it earns its place, and the screen used to
 * return `ScreenError` before ever reaching it.
 */
describe('CalendarScreen — recent files when the schedule failed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: null,
      mobileSheets: [],
      schedule: { data: [], status: 'error' } as never,
      firstSyncSettled: true,
      syncLoaded: {},
      syncStatus: {
        isSyncing: false,
        lastSync: null,
        error: 'offline',
        handshakeDone: true,
        handshakeTimedOut: false,
      },
      recentPdfs: [
        {
          key: 'k1',
          courseCode: 'EBC-AP',
          link: 'https://is/1',
          name: 'Přednáška 09',
          date: 'd',
          lastOpenedAt: 1,
        },
      ],
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('still shows the shelf under the error', () => {
    render(<CalendarScreen />);
    expect(screen.getByTestId('calendar-error')).toBeInTheDocument();
    expect(screen.getByTestId('recent-files')).toBeInTheDocument();
  });
});
