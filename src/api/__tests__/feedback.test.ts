import { describe, it, expect, vi, afterEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

// Hoisted so the vi.mock factories below (which vitest hoists above these
// imports) can close over it without a temporal-dead-zone error.
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async (..._args: unknown[]) => ({ error: null })) }));

vi.mock('../../services/spolky/supabaseClient', () => ({
  supabase: { rpc: (...a: unknown[]) => rpc(...a) },
}));
vi.mock('../../services/identity/installId', () => ({
  getInstallId: async () => 'install-1',
}));
vi.mock('../../platform', () => ({
  getPlatform: () => ({ kind: 'extension' }),
}));
vi.mock('../../utils/userParams', () => ({
  getUserParams: async () => ({ facultyId: 'PEF' }),
}));

import { submitFeedback, trackDailyUsage } from '../feedback';

describe('feedback', () => {
  afterEach(() => {
    vi.clearAllMocks();
    useAppStore.setState({ demoMode: false });
  });

  // The demo student is fabricated, so a demo submission would pollute the real
  // feedback table — the same reasoning that already guards trackDailyUsage,
  // applied to the other write it shares a file with.
  it('does not submit feedback in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await expect(submitFeedback('nps', '9', 'ZS2026')).resolves.toBe(false);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('does not track usage in demo mode', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    useAppStore.setState({ demoMode: true });

    await trackDailyUsage();

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  // Faculty and platform are GROUP labels on the same random install id, never
  // student identity — see the file-level comment in feedback.ts.
  it('sends the install id with faculty and platform group labels', async () => {
    await trackDailyUsage();

    expect(rpc).toHaveBeenCalledWith('track_daily_usage', {
      p_student_id: 'install-1',
      p_faculty: 'PEF',
      p_platform: 'extension',
    });
  });
});

/**
 * These two writes are the last places student identity reached Supabase.
 * They now identify the DEVICE, so neither call should be able to see, take,
 * or transmit anything about the student.
 */
describe('feedback — no student identity leaves the device', () => {
  it('takes no student identifier as an argument at all', () => {
    // Arity is the guard: a caller cannot pass a student id even by mistake.
    expect(trackDailyUsage.length).toBe(0);
    // type, value, semester, reason — none of which identify the student.
    expect(submitFeedback.length).toBe(4);
  });
});
