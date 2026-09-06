import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingForm } from '../HousingForm';
import type { HousingDraft } from '../../../types/housing';

describe('HousingForm', () => {
  // Typed via vi.fn's generic (vs. brief's bare `async () => 'ok'`):
  // otherwise TS infers a zero-arg mock and `mock.calls[0]![0]` below fails to
  // typecheck (indexing an empty tuple). Same assertions, same behaviour.
  const publishHousing = vi.fn<(draft: HousingDraft) => Promise<'ok'>>(async () => 'ok');
  beforeEach(() => {
    publishHousing.mockClear();
    useAppStore.setState({ language: 'cz', publishHousing } as never);
  });

  it('keeps Publish disabled until required fields and consent are set', async () => {
    render(<HousingForm onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit' });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Královo Pole' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), { target: { value: 'ja@example.com' } });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(publishHousing).toHaveBeenCalledTimes(1));
    expect(publishHousing.mock.calls[0]![0]).toMatchObject({
      kind: 'offer', roomType: 'room_private', district: 'Královo Pole', freeFrom: '2026-09-15', contact: 'ja@example.com', priceCzk: null,
    });
  });

  it('shows the refused message and stays open when the server refuses', async () => {
    publishHousing.mockResolvedValueOnce('refused' as never);
    const onDone = vi.fn();
    render(<HousingForm onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Brno' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit' }));
    await screen.findByText('Teď to nejde: nejvíc 3 aktivní inzeráty a 5 pokusů za hodinu.');
    expect(onDone).not.toHaveBeenCalled();
  });

  it('clamps an over-limit price and publishes null for a non-numeric price', async () => {
    render(<HousingForm onDone={() => {}} />);
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Brno' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.change(screen.getByLabelText('Cena (Kč/měsíc)'), { target: { value: '250000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit' }));
    await waitFor(() => expect(publishHousing).toHaveBeenCalledTimes(1));
    expect(publishHousing.mock.calls[0]![0]).toMatchObject({ priceCzk: 100000 });

    publishHousing.mockClear();
    fireEvent.change(screen.getByLabelText('Cena (Kč/měsíc)'), { target: { value: 'abc' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit' }));
    await waitFor(() => expect(publishHousing).toHaveBeenCalledTimes(1));
    expect(publishHousing.mock.calls[0]![0]).toMatchObject({ priceCzk: null });
  });
});
