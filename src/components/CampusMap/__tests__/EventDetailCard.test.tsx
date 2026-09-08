import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventDetailCard } from '../EventDetailCard';
import type { MapEvent } from '../../../types/events';

const ev: MapEvent = {
  id: 'e1',
  title: 'Mine',
  url: '',
  date: '2026-07-10',
  endDate: null,
  time: null,
  location: null,
  imageUrl: null,
  organizerKey: 'pef',
  societyId: 'supef',
  coord: [16.6, 49.2],
  roomCode: null,
  venueKind: 'offcampus',
  category: 'party',
};
describe('EventDetailCard', () => {
  beforeEach(() => {
    useAppStore.setState({
      adminConsoleOpen: false,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
      language: 'en',
    });
    vi.clearAllMocks();
  });

  // The card is a read-only preview: a society edits/deletes from the "Moje
  // akce" panel, never here (management stays in one place). Guard that no
  // authoring control leaks into the card, even for the society's own event.
  it('never renders edit/delete controls, even for an own event in the admin console', () => {
    useAppStore.setState({
      adminConsoleOpen: true,
      adminAssociationId: 'supef',
      adminActiveAssociationId: 'supef',
    });
    render(<EventDetailCard event={ev} />);
    expect(screen.queryByRole('button', { name: /delete|smazat/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /edit|upravit/i })).toBeNull();
  });

  it('links an off-campus venue to Google Maps at its coordinates (lat,lng)', () => {
    const offEvent: MapEvent = {
      ...ev,
      location: 'Bar, který neexistuje',
      coord: [16.6097, 49.1959],
    };
    render(<EventDetailCard event={offEvent} />);
    const link = screen.getByRole('link', { name: /Bar, který neexistuje/ });
    // Google Maps expects lat,lng; coord is stored [lng, lat].
    expect(link).toHaveAttribute(
      'href',
      'https://www.google.com/maps/search/?api=1&query=49.1959,16.6097'
    );
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('shows the human-readable room name, not the raw IS room code', () => {
    // Campus events persist only the IS-internal code ("BA39N1009"); the
    // hall name ("Q01") lives in rooms-index.json. The card must resolve it.
    const campusEvent: MapEvent = { ...ev, roomCode: 'BA39N1009', venueKind: 'campus' };
    render(<EventDetailCard event={campusEvent} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });

  // A society post's `url` is data from Supabase, not something the app
  // typed. A `javascript:` scheme handed straight to an <a href> would run
  // in the page the moment a student tapped "More info".
  it('renders no More-info link for a javascript: url', () => {
    const unsafeEvent: MapEvent = { ...ev, url: 'javascript:alert(1)' };
    render(<EventDetailCard event={unsafeEvent} />);
    expect(screen.queryByRole('link', { name: /more info/i })).toBeNull();
  });

  it('still renders the More-info link for a plain https url', () => {
    const safeEvent: MapEvent = { ...ev, url: 'https://example.com/event' };
    render(<EventDetailCard event={safeEvent} />);
    expect(screen.getByRole('link', { name: /more info/i })).toHaveAttribute(
      'href',
      'https://example.com/event'
    );
  });
});
