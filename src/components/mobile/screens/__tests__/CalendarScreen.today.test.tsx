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

  it('offers no Today button while today is shown, but keeps its row so the date does not jump', () => {
    render(<CalendarScreen />);
    expect(screen.queryByRole('button', { name: 'Dnes' })).toBeNull();
    expect(screen.getByTestId('today-pill-spacer')).toBeInTheDocument();
  });

  // Above the date, in the eyebrow row, not beside or under it: beside never
  // fit on a phone, and under it made the calendar header one line taller
  // than every other tab's.
  it('puts the Today button above the date, in the eyebrow row', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-28' } as never);
    render(<CalendarScreen />);
    const pill = screen.getByRole('button', { name: 'Dnes' });
    const title = screen.getByText('Úterý 28. dubna');
    expect(pill.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(pill.parentElement).toBe(title.parentElement);
  });

  it('offers a Today button on any other day, and it goes back to today', () => {
    useAppStore.setState({ mobileSelectedDayIso: '2026-04-28' } as never);
    render(<CalendarScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Dnes' }));

    // null is "today" in the store, so the day re-derives itself at midnight.
    expect(useAppStore.getState().mobileSelectedDayIso).toBeNull();
  });
});
