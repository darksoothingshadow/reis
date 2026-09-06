import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { NotificationsSheet } from '../NotificationsSheet';
import { useAppStore } from '../../../../store/useAppStore';
import { openExternal } from '../../../../mobile/openExternal';
import type { SpolekNotification } from '../../../../services/spolky';

// Only the click counter is faked: the rest of the module backs the feed's own
// faculty filter, and a real RPC here would reach Supabase from a unit test.
vi.mock('../../../../services/spolky', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../services/spolky')>()),
  trackNotificationClick: vi.fn(),
}));

// The linked branch would otherwise hand the URL to the system browser; a
// housing notification must never reach this, since `reis://housing` is not a
// real URL openExternal could do anything sensible with.
vi.mock('../../../../mobile/openExternal', () => ({ openExternal: vi.fn() }));

// 'admin' bypasses the spolky-subscription filter (always shown), keeping this
// independent of useSpolkySettings' async IDB-backed state.
const notification: SpolekNotification = {
  id: 'n1',
  associationId: 'admin',
  title: 'Hledáš bydlení?',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  link: 'reis://housing',
} as SpolekNotification;

beforeEach(() => {
  vi.mocked(openExternal).mockClear();
  useAppStore.setState({
    language: 'cz',
    exams: { data: [] },
    odevzdavarny: [],
    cvicneTests: [],
    now: new Date(),
    notifications: {
      data: [notification],
      status: 'success',
      readIds: new Set(),
      viewedIds: new Set(),
      seenDeadlineAlertIds: new Set(),
    },
    mapEvents: [],
    mapEventsLoaded: true,
    mapSelection: null,
    mobileTab: 'calendar',
    adminConsoleOpen: false,
    mobileSheets: [],
  } as never);
});

describe('NotificationsSheet housing notifications', () => {
  it('a notification whose link is reis://housing opens the housing sheet instead of a browser', () => {
    const onClose = vi.fn();
    render(<NotificationsSheet onClose={onClose} />);
    fireEvent.click(screen.getByText('Hledáš bydlení?'));
    expect(openExternal).not.toHaveBeenCalled();
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({ kind: 'housing' });
    expect(onClose).toHaveBeenCalled();
  });
});
