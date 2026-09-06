import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminStatsPanel } from '../AdminStatsPanel';

describe('AdminStatsPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz', adminStatsLoading: false,
      adminStats: { today: 12, d7: 40, d30: 90, byFaculty: [{ key: 'PEF', installs: 50 }, { key: 'LDF', installs: -1 }], byPlatform: [{ key: 'extension', installs: 70 }], weekly: [{ weekStart: '2026-08-31', installs: 40 }] },
    } as never);
  });

  it('shows the three totals, renders suppressed groups as "under 5", and says it counts installs', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('méně než 5')).toBeInTheDocument();
    expect(screen.getByText(/Počítáme instalace, ne lidi/)).toBeInTheDocument();
  });

  // Same low-contrast bug as StatsBars' suppressed groups (see StatsBars.test.tsx):
  // the weekly chart drew a suppressed week with the same green-at-30%-opacity
  // rect, measured at 1.77:1 (dark) / 1.27:1 (light) against its backdrop —
  // both under the 3:1 WCAG non-text-contrast floor, and unreachable by any
  // opacity of this green in the light theme (2.29:1 fully opaque).
  // verify-ui measured this alert-warning by hand (again, SVG/colour-token
  // math the automated probe's text check DOES cover here, but flagged as a
  // warn not a blocker): DaisyUI's default white alert-warning-content on the
  // amber background is 2.15:1 in BOTH themes (the token pair is
  // theme-invariant, like HousingModerationPanel's "Smazat?" button — see
  // that fix). text-black clears it: 8.26:1.
  it('keeps the load-failed alert readable — no white-on-amber', () => {
    useAppStore.setState({ adminStats: null, adminStatsLoading: false } as never);
    render(<AdminStatsPanel />);
    expect(screen.getByText('Statistiky se nepodařilo načíst.').className).toContain('text-black');
  });

  it('paints a suppressed week in the weekly chart with a base-content fill, not the low-contrast primary-at-0.3', () => {
    useAppStore.setState({
      adminStats: {
        today: 1, d7: 1, d30: 1, byFaculty: [], byPlatform: [],
        weekly: [{ weekStart: '2026-08-31', installs: -1 }],
      },
    } as never);
    const { container } = render(<AdminStatsPanel />);
    const rect = container.querySelector('svg[aria-label] rect')!;
    expect(rect.getAttribute('class') ?? '').toContain('fill-base-content/50');
    expect(rect.getAttribute('fill')).not.toBe('currentColor');
  });
});
