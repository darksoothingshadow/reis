import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sidebar } from '../Sidebar';

// Sidebar renders ProfilePopup, which calls useSpolkySettings and its async
// IndexedDB load. These tests are about logo/nav routing, so the hook is
// stubbed to keep them off real storage entirely.
vi.mock('../../hooks/useSpolkySettings', () => ({
  useSpolkySettings: () => ({
    subscribedAssociations: [],
    toggleAssociation: vi.fn(),
    isSubscribed: () => false,
    isLoading: false,
  }),
}));

describe('Sidebar', () => {
  it('clicking the logo goes to calendar', () => {
    const onViewChange = vi.fn();
    render(
      <Sidebar
        currentView="exams"
        onViewChange={onViewChange}
        items={[{ id: 'dashboard', label: 'Přehled', icon: <span /> }]}
      />
    );
    const logoButton = screen.getAllByRole('button')[0]!;
    fireEvent.click(logoButton);
    expect(onViewChange).toHaveBeenCalledWith('calendar');
  });
});
