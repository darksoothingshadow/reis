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

  // The contrast fix now lives in the theme tokens (index.css) —
  // --color-warning-content is #111827 (8.26:1 on --color-warning) in both
  // themes — so the component no longer needs a text-black override; the
  // semantic alert-warning class alone carries readable text.
  it('keeps the load-failed alert readable — no white-on-amber', () => {
    useAppStore.setState({ adminStats: null, adminStatsLoading: false } as never);
    render(<AdminStatsPanel />);
    expect(screen.getByText('Statistiky se nepodařilo načíst.').className).toContain('alert-warning');
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

  // The SVG's viewBox was a hardcoded "0 0 120 40" (room for 12 bars at 10
  // units each). The backing query can return 12 Monday-weeks PLUS whatever
  // partial week is in progress — 13 rows — clipping the 13th bar. Width
  // must track the data, not a guess at the query's row count.
  it('sizes the weekly chart viewBox from the data, so no bar clips', () => {
    const weekly = Array.from({ length: 13 }, (_, i) => ({
      weekStart: `2026-06-${String(i + 1).padStart(2, '0')}`,
      installs: 10 + i,
    }));
    useAppStore.setState({
      adminStats: { today: 1, d7: 1, d30: 1, byFaculty: [], byPlatform: [], weekly },
    } as never);
    const { container } = render(<AdminStatsPanel />);
    const svg = container.querySelector('svg[aria-label]')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 130 40');
    expect(container.querySelectorAll('svg[aria-label] rect').length).toBe(13);
  });

  // The refresh button's only content is the "↻" glyph, unreadable to a
  // screen reader without a real label.
  it('labels the refresh button for screen readers', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByRole('button', { name: 'Obnovit' })).toBeInTheDocument();
  });
});
