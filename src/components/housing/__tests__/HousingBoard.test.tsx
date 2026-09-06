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
});
