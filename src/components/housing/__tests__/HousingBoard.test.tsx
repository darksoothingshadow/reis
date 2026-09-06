import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingBoard } from '../HousingBoard';

const offer = { id: 'o1', kind: 'offer', roomType: 'room_private', district: 'Královo Pole', priceCzk: 7500, freeFrom: '2026-09-15', freeUntil: null, note: 'Klidný pokoj', contact: 'ja@example.com', isLogin: 'xnovak', personId: '123456', createdAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-20T10:00:00Z' } as const;
const request = { ...offer, id: 'r1', kind: 'request', isLogin: 'xhleda', personId: '7', district: 'Bystrc' } as const;

describe('HousingBoard', () => {
  const loadHousing = vi.fn(async () => {});
  beforeEach(() => {
    loadHousing.mockClear();
    useAppStore.setState({
      language: 'cz', housingPosts: [offer, request], housingLoaded: true, housingLoading: false,
      housingMineIds: [], loadHousing,
    } as never);
  });

  it('loads on mount and filters by tab', () => {
    render(<HousingBoard onVerify={() => {}} />);
    expect(loadHousing).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Královo Pole')).toBeInTheDocument();
    expect(screen.queryByText('Bystrc')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Hledám' }));
    expect(screen.getByText('Bystrc')).toBeInTheDocument();
    expect(screen.queryByText('Královo Pole')).toBeNull();
  });

  it('shows the login and hands the post to onVerify', () => {
    const onVerify = vi.fn();
    render(<HousingBoard onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: /xnovak/ }));
    expect(onVerify).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1', personId: '123456' }));
  });

  it('shows the empty state for an empty tab', () => {
    useAppStore.setState({ housingPosts: [offer] } as never);
    render(<HousingBoard onVerify={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hledám' }));
    expect(screen.getByText('Zatím tu nic není. Buď první.')).toBeInTheDocument();
  });

  // DaisyUI's default inactive-tab colour is base-content at 60% opacity,
  // which measures 3.37:1 against tabs-box's base-200 background in the
  // mendelu (light) theme — below the 4.5:1 AA floor. Full-opacity text
  // clears it comfortably. Caught by scripts/shot.ts (contrast-text) on the
  // housing sheet, light theme, all three phone widths.
  it('gives the inactive tab full-opacity text, not the faded DaisyUI default', () => {
    render(<HousingBoard onVerify={() => {}} />);
    const inactive = screen.getByRole('tab', { name: 'Hledám' });
    expect(inactive.className).toMatch(/(^|\s)text-base-content(\s|$)/);
  });

  // tabs-box's own background (base-200) sits directly on the sheet's
  // base-100 backdrop — 1.03:1, effectively invisible (the exact case
  // documented for the light theme in the verify-ui skill). A hairline
  // border keeps the control legible without depending on the tone.
  it('gives the tablist a hairline border so it reads against its backdrop', () => {
    render(<HousingBoard onVerify={() => {}} />);
    expect(screen.getByRole('tablist').className).toMatch(/border-base-content\/10/);
  });
});
