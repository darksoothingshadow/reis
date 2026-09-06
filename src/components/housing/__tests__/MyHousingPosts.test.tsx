import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { MyHousingPosts } from '../MyHousingPosts';

const offer = {
  id: 'o1',
  kind: 'offer',
  roomType: 'room_private',
  district: 'Královo Pole',
  priceCzk: 7500,
  freeFrom: '2026-09-15',
  freeUntil: null,
  note: '',
  contact: 'x',
  isLogin: 'xnovak',
  personId: '1',
  createdAt: '2026-09-06T10:00:00Z',
  expiresAt: '2026-09-20T10:00:00Z',
} as const;

describe('MyHousingPosts', () => {
  it('renders nothing when the device has no live post', () => {
    useAppStore.setState({ housingMineIds: [], housingPosts: [], closeHousing: vi.fn() } as never);
    const { container } = render(<MyHousingPosts />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the one live post', () => {
    useAppStore.setState({
      housingMineIds: ['o1'],
      housingPosts: [offer],
      closeHousing: vi.fn(),
    } as never);
    render(<MyHousingPosts />);
    expect(screen.getByText('Královo Pole', { exact: false })).toBeInTheDocument();
  });

  // bg-base-200 (this box's fill) sits directly on the sheet's base-100
  // backdrop — 1.03:1 in the mendelu (light) theme, effectively invisible.
  // The exact case documented in the verify-ui skill for a surface that has
  // to read in both themes: a hairline border, not the tone.
  it('gives the "my posts" box a hairline border so it reads against its backdrop', () => {
    useAppStore.setState({
      housingMineIds: ['o1'],
      housingPosts: [offer],
      closeHousing: vi.fn(),
    } as never);
    render(<MyHousingPosts />);
    expect(
      screen.getByText('Královo Pole', { exact: false }).closest('.rounded-box')?.className
    ).toMatch(/border-base-content\/10/);
  });
});
