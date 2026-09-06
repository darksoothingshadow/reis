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

  // `btn-outline btn-error` colours BOTH the border and the label text with
  // DaisyUI's error token — text-error (#ef4444) on base-100 measures 3.90:1
  // in the mendelu (light) theme, below the 4.5:1 AA floor, and no font
  // weight at this size rescues it (documented in the verify-ui skill). The
  // danger cue moves to a small icon instead — an SVG has no text node, so it
  // is outside what the WCAG text-contrast check (or a screen reader's label)
  // evaluates — while the button's own label stays full-opacity base-content.
  it('keeps the unarmed delete label at full-opacity text, colouring only its icon red', () => {
    render(<HousingModerationPanel />);
    const del = screen.getByRole('button', { name: 'Smazat' });
    expect(del.className).not.toMatch(/text-error/);
    expect(del.querySelector('svg')?.getAttribute('class')).toMatch(/text-error/);
  });

  // DaisyUI's error-content (white) on --color-error (#ef4444) is 3.76:1 in
  // BOTH themes (the token pair is identical light/dark) — below the 4.5:1
  // AA floor a small btn-xs label needs, and unlike the outline case above
  // there is no icon to carry the colour instead: "Smazat?" IS the confirm
  // action's whole readable content. Black text on the same red is 5.58:1.
  it('gives the armed confirm button readable text on its red fill', () => {
    render(<HousingModerationPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Smazat' }));
    expect(screen.getByRole('button', { name: 'Smazat?' }).className).toMatch(/text-black/);
  });

  // bg-base-200 on this row card sits directly on the console's bg-base-100
  // wrapper (desktop aside and MobileAdminConsole's housing pane both) —
  // 1.03:1 in the light theme, the same documented case as the tabs-box and
  // MyHousingPosts fixes elsewhere in this branch.
  it('gives each row card a hairline border so it reads against its backdrop', () => {
    render(<HousingModerationPanel />);
    expect(screen.getByText(/Královo Pole/).closest('.card')?.className).toMatch(/border-base-content\/10/);
  });
});
