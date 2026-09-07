import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarScreen } from '../CalendarScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * A way back to today. The week arrows and the day chips move you AWAY from
 * today one step at a time; nothing brought you back except stepping the same
 * way — noticed on the device after paging through a fortnight. The pill sits
 * in the header's `below` slot (the screen's own control, like Exams' count)
 * and exists only when the selected day is not today, so today's screen is
 * exactly what it was.
 */
describe('CalendarScreen — back to today', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-20T10:00:00'));
    useAppStore.setState({
      language: 'cz',
      mobileSelectedDayIso: null,
      mobileSheets: [],
      schedule: { data: [], status: 'loading' } as never,
      firstSyncSettled: false,
      syncLoaded: {},
      syncStatus: {
        isSyncing: true,
        lastSync: null,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });
  afterEach(() => vi.useRealTimers());

  it('offers no Today button while today is shown', () => {
    render(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: 'Dnes' })).toBeNull();
  });

  it('offers a Today button on any other day, and it goes back to today', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-28' } as never);
    render(<CalendarScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));

    // null is "today" in the store, so the day re-derives itself at midnight.
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
  });
});
