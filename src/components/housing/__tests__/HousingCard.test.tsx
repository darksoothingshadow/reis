import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingCard } from '../HousingCard';
import type { HousingPost } from '../../../types/housing';

const post: HousingPost = {
  id: 'o1', kind: 'offer', roomType: 'room_private', district: 'Královo Pole', priceCzk: 7500,
  freeFrom: '2026-09-15', freeUntil: null, note: 'Klidný pokoj', contact: 'ja@example.com',
  isLogin: 'xnovak', personId: '123456', createdAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-20T10:00:00Z',
};

describe('HousingCard', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('shows the thank-you and disables the button when onReport resolves true', async () => {
    const onReport = vi.fn<(p: HousingPost) => Promise<boolean>>(async () => true);
    render(<HousingCard post={post} onVerify={() => {}} onReport={onReport} />);
    fireEvent.click(screen.getByRole('button', { name: /Nahlásit/ }));
    await screen.findByText(/Díky, podíváme se na to\./);
    expect(screen.getByRole('button', { name: /Díky, podíváme se na to\./ })).toBeDisabled();
  });

  it('shows a failure message and keeps the button enabled when onReport resolves false', async () => {
    const onReport = vi.fn<(p: HousingPost) => Promise<boolean>>(async () => false);
    render(<HousingCard post={post} onVerify={() => {}} onReport={onReport} />);
    fireEvent.click(screen.getByRole('button', { name: /Nahlásit/ }));
    await screen.findByText(/Odeslání se nepovedlo\. Zkus to znovu\./);
    expect(screen.getByRole('button', { name: /Odeslání se nepovedlo\. Zkus to znovu\./ })).toBeEnabled();
  });

  it('calls onVerify with the post when the login button is clicked', () => {
    const onVerify = vi.fn();
    render(<HousingCard post={post} onVerify={onVerify} onReport={async () => true} />);
    fireEvent.click(screen.getByRole('button', { name: /xnovak/ }));
    expect(onVerify).toHaveBeenCalledWith(post);
  });
});
