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
    useAppStore.setState({ language: 'cz', publishHousing, housingPosterLogin: 'xnovak' } as never);
  });

  it("renders the poster's own IS login instead of a static placeholder", () => {
    render(<HousingForm onDone={() => {}} />);
    expect(screen.getByText('xnovak')).toBeInTheDocument();
  });

  it('keeps Publish disabled until required fields and consent are set', async () => {
    render(<HousingForm onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit' });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Královo Pole' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), {
      target: { value: 'ja@example.com' },
    });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(publishHousing).toHaveBeenCalledTimes(1));
    expect(publishHousing.mock.calls[0]![0]).toMatchObject({
      kind: 'offer',
      roomType: 'room_private',
      district: 'Královo Pole',
      freeFrom: '2026-09-15',
      contact: 'ja@example.com',
      priceCzk: null,
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

  // Same tabs-box pattern as HousingBoard's offer/request tabs: DaisyUI's
  // faded (60%-opacity) inactive-tab text measures 3.37:1 against base-200
  // in the light theme, below the 4.5:1 AA floor. Caught by scripts/shot.ts
  // on the form's consent-unticked/-ticked screens, light theme.
  it('gives the inactive kind tab full-opacity text, not the faded DaisyUI default', () => {
    render(<HousingForm onDone={() => {}} />);
    const inactive = screen.getByRole('tab', { name: 'Hledám' });
    expect(inactive.className).toMatch(/(^|\s)text-base-content(\s|$)/);
  });

  it('gives the kind tablist a hairline border so it reads against its backdrop', () => {
    render(<HousingForm onDone={() => {}} />);
    expect(screen.getByRole('tablist').className).toMatch(/border-base-content\/10/);
  });

  // `form-control` was DaisyUI 4 — daisyui@5.7.22 (this project's version) does
  // not define it at all, so it is a no-op class name. Without an explicit
  // column layout the label's <span> and its input sit on the label element's
  // default `display: inline` line box together: on screen the district
  // input's border runs straight through the "Čtvrť" label text instead of
  // sitting below it. Caught by eyeballing the verify-ui screenshot — the
  // automated probe's collision check compares only text-bearing elements,
  // and an <input>'s placeholder is not a DOM text node, so it never fired.
  it('stacks each field label above its control instead of relying on the removed form-control class', () => {
    render(<HousingForm onDone={() => {}} />);
    const districtLabel = screen.getByLabelText('Čtvrť').closest('label');
    expect(districtLabel?.className).toMatch(/(^|\s)flex(\s|$)/);
    expect(districtLabel?.className).toMatch(/flex-col/);
  });
});
