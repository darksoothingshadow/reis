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
});
