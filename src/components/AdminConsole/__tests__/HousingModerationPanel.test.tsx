import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingModerationPanel } from '../HousingModerationPanel';
import type { HousingAdminRow } from '../../../api/housingAdmin';

const row: HousingAdminRow = {
  id: 'h1',
  kind: 'offer',
  room_type: 'room_private',
  district: 'Královo Pole',
  price_czk: 6000,
  free_from: '2026-09-01',
  free_until: null,
  note: 'Slunný pokoj',
  contact: 'student@mendelu.cz',
  is_login: 'xnovak1',
  is_person_id: '123456',
  hidden_by_admin: false,
  created_at: '2026-08-01T00:00:00.000Z',
  expires_at: '2026-09-15T00:00:00.000Z',
};

describe('HousingModerationPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      adminHousing: [row],
      adminHousingLoading: false,
      hideAdminHousing: vi.fn(),
      deleteAdminHousing: vi.fn(),
      loadAdminHousing: vi.fn(),
    } as never);
  });

  it('shows the row and hides it through the store', () => {
    render(<HousingModerationPanel />);
    expect(screen.getByText(/Královo Pole/)).toBeInTheDocument();
    expect(screen.getByText('xnovak1')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Skrýt' }));
    expect(useAppStore.getState().hideAdminHousing).toHaveBeenCalledWith('h1', true);
  });

  it('does not delete on the first click — it only arms the row', () => {
    render(<HousingModerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(useAppStore.getState().deleteAdminHousing).not.toHaveBeenCalled();
  });

  it('deletes on the second click, once the row is armed', () => {
    render(<HousingModerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Smazat?' }));
    expect(useAppStore.getState().deleteAdminHousing).toHaveBeenCalledWith('h1');
  });

  it('cancelling the armed state disarms it, so a fresh click still does not delete', () => {
    render(<HousingModerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zrušit' }));
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(useAppStore.getState().deleteAdminHousing).not.toHaveBeenCalled();
  });
});
