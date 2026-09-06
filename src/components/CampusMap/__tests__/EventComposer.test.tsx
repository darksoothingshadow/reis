import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { EventComposer } from '../EventComposer';
import type { PostInput } from '../../../api/societyPosts';

const createPost = vi.fn<
  (
    input: PostInput,
    associationId: string,
    createdBy: string
  ) => Promise<{ id?: string; error?: string }>
>(async () => ({ id: 'new' }));
const updatePost = vi.fn<
  (id: string, patch: Record<string, unknown>) => Promise<{ error?: string }>
>(async () => ({}));
vi.mock('../../../api/societyPosts', () => ({
  createPost: (...a: Parameters<typeof createPost>) => createPost(...a),
  updatePost: (...a: Parameters<typeof updatePost>) => updatePost(...a),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import { toast } from 'sonner';

beforeEach(() => {
  createPost.mockClear();
  updatePost.mockClear();
  useAppStore.setState({
    language: 'cz',
    adminAssociationId: 'supef',
    adminActiveAssociationId: 'supef',
    adminSession: { user: { email: 'admin@supef.cz' } } as never,
    draftCoord: null,
    editEventId: null,
    composerOpen: true,
    societyMapEvents: [],
    loadSocietyPosts: vi.fn(async () => {}),
    reloadMapEvents: vi.fn(async () => {}),
  });
});

describe('EventComposer publish', () => {
  it('creates an offcampus event with the placed coord', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    // language: 'cs' in beforeEach → labels resolve through the real cs.json
    // translations (not raw keys), so queries below match the rendered Czech text.
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    // choose date through MiniCalendar
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('offcampus');
    expect(input.coordLng).toBe(16.61);
    // Published under the society being authored, and stamped with the signed-in
    // account's email as created_by.
    expect(createPost.mock.calls[0][1]).toBe('supef');
    expect(createPost.mock.calls[0][2]).toBe('admin@supef.cz');
    // Publishing a live event must refresh the public feed so it shows on the
    // student "Akce" tab without a full reload (stale load-once cache fix).
    expect(useAppStore.getState().reloadMapEvents).toHaveBeenCalled();
    // And the society gets a clear confirmation it worked.
    expect(toast.success).toHaveBeenCalled();
  });

  // A reIS admin authors for a society other than its own. In production that
  // account carries association_id 'reis' (checked against spolky_accounts), so
  // it starts pinned there and the header's picker moves it elsewhere.
  // Publishing must follow the picker, not the account — reading the account
  // field would file every event under 'reis' no matter what was selected.
  it('publishes under the picked society when a reIS admin is signed in', async () => {
    useAppStore.setState({
      adminRole: 'reis_admin',
      // Its own society, as production has it — and deliberately NOT the one
      // being authored, so sending this instead of the picked id is a failure.
      adminAssociationId: 'reis',
      adminActiveAssociationId: 'esn',
      adminSession: { user: { email: 'reis.mendelu@gmail.com' } } as never,
      draftCoord: [16.61, 49.21],
    });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'ESN párty' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][1]).toBe('esn');
  });

  it('keeps publish disabled until every field is filled, then enables it', async () => {
    render(<EventComposer onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit akci' });
    expect(publish).toBeDisabled();

    // Completing every field enables publish.
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    await waitFor(() => expect(publish).not.toBeDisabled());
  });

  it('publishes with the chosen start time', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Party' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // Time: type into the reIS-native combobox — "1930" masks to 19:30.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].time).toBe('19:30');
  });

  it('publishes with the category chosen in the picker (not hardcoded party)', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), {
      target: { value: 'Kvíz večer' },
    });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    // Pick the "Kvíz" (quiz) category instead of leaving the default party.
    fireEvent.click(screen.getByRole('button', { name: 'Kvíz' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));
    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].category).toBe('quiz');
  });

  it('preserves venue_kind=campus and room_code when editing a campus event', async () => {
    useAppStore.setState({
      editEventId: 'c1',
      societyMapEvents: [
        {
          id: 'c1',
          title: 'Deskovky',
          url: '',
          date: '2026-07-08',
          endDate: null,
          time: null,
          location: 'Q6.06',
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N6006',
          venueKind: 'campus',
          category: 'boardgames',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    // This fixture is a legacy row with time: null. Saving it now requires a
    // start time — that is the point: editing an old event backfills the one
    // field its reminder needs.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Uložit změny' }));
    await waitFor(() => expect(updatePost).toHaveBeenCalledTimes(1));
    const patch = updatePost.mock.calls[0][1];
    expect(patch.time).toBe('19:30');
    expect(patch.venue_kind).toBe('campus');
    expect(patch.room_code).toBe('BA39N6006');
    expect(patch.category).toBe('boardgames');
  });

  it('shows the hall name (not the IS code) in the picked-room chip when editing', () => {
    // Campus events save only room_code and a null location, so the chip must
    // resolve BA39N1009 → "Q01" rather than echoing the raw code.
    useAppStore.setState({
      editEventId: 'c2',
      societyMapEvents: [
        {
          id: 'c2',
          title: 'Zootopia',
          url: '',
          date: '2026-07-14',
          endDate: null,
          time: null,
          location: null,
          imageUrl: null,
          organizerKey: 'pef',
          societyId: 'supef',
          coord: [16.614, 49.209],
          roomCode: 'BA39N1009',
          venueKind: 'campus',
          category: 'party',
        },
      ],
    });
    render(<EventComposer onDone={() => {}} />);
    expect(screen.getByText('Q01')).toBeTruthy();
    expect(screen.queryByText('BA39N1009')).toBeNull();
  });
});

/**
 * Sprint 08: "Spolky se nemůžou podívat, kde plánují akci na mapě před
 * publikem." The draft pin was never the problem — EventLayer has always drawn
 * one from `draftCoord`. A CAMPUS venue simply never wrote its coordinate
 * there: the room lived in the composer's own useState and the map had nothing
 * to draw, so the only venue kind you could check before publishing was the
 * off-campus one.
 */
describe('EventComposer — seeing the planned location before publishing', () => {
  const pickRoom = () => {
    fireEvent.click(screen.getByRole('button', { name: /Kampus/ }));
    fireEvent.change(screen.getByPlaceholderText('Hledat místnost nebo budovu…'), {
      target: { value: 'Q01' },
    });
    const firstMatch = screen.getAllByRole('button').find((b) => /Q01/.test(b.textContent ?? ''));
    fireEvent.click(firstMatch as HTMLElement);
  };

  it('puts a picked campus room on the map as the draft pin', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(useAppStore.getState().draftCoord).toBeNull();

    pickRoom();

    const coord = useAppStore.getState().draftCoord;
    expect(coord).not.toBeNull();
    expect(coord?.[0]).toBeGreaterThan(16);
    expect(coord?.[1]).toBeGreaterThan(49);
  });

  it('takes the pin off the map when the room is cleared', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    expect(useAppStore.getState().draftCoord).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Změnit místo' }));
    expect(useAppStore.getState().draftCoord).toBeNull();
  });

  it('offers a way to look at the pin once a campus room is chosen', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    const before = useAppStore.getState().draftFocusRequest;

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));
    expect(useAppStore.getState().draftFocusRequest).toBe(before + 1);
  });

  it('offers the same look at an off-campus point', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    const before = useAppStore.getState().draftFocusRequest;

    fireEvent.click(screen.getByRole('button', { name: 'Ukázat na mapě' }));
    expect(useAppStore.getState().draftFocusRequest).toBe(before + 1);
  });

  it('has nothing to show before a venue is chosen', () => {
    render(<EventComposer onDone={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Ukázat na mapě' })).not.toBeInTheDocument();
  });

  // Publishing still has to carry the room's own coordinate, not whatever the
  // store happens to hold — the draft pin is a view of it, not the source.
  it('publishes the room coordinate for a campus event', async () => {
    render(<EventComposer onDone={() => {}} />);
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Přednáška' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    // A start time is required now, so every publish path sets one.
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    pickRoom();
    // Read the mirrored coord before publishing: closing the composer clears it.
    const pinned = useAppStore.getState().draftCoord;
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    const input = createPost.mock.calls[0][0];
    expect(input.venueKind).toBe('campus');
    expect(input.roomCode).toBeTruthy();
    expect(input.coordLng).toBe(pinned?.[0]);
    expect(input.coordLat).toBe(pinned?.[1]);
  });
});

/**
 * Regression, caught by driving the composer rather than by reading it.
 *
 * Mirroring a campus room into `draftCoord` (so the map can draw its pin) gave
 * `switchVenue` a stale value it never used to have: it clears the draft when
 * you switch TO campus, but not when you switch AWAY from it. So picking room
 * Q01 and then changing your mind to "Ve městě" left the room's coordinate in
 * the store — the composer showed a venue as already chosen instead of the
 * place search, and Publish would have posted an OFF-CAMPUS event sitting on a
 * lecture hall, with no location name.
 */
describe('EventComposer — changing your mind about the venue kind', () => {
  const pickRoom = () => {
    fireEvent.click(screen.getByRole('button', { name: /Kampus/ }));
    fireEvent.change(screen.getByPlaceholderText('Hledat místnost nebo budovu…'), {
      target: { value: 'Q01' },
    });
    const match = screen.getAllByRole('button').find((b) => /Q01/.test(b.textContent ?? ''));
    fireEvent.click(match as HTMLElement);
  };

  it('drops the campus coordinate when switching to an off-campus venue', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    expect(useAppStore.getState().draftCoord).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Ve městě/ }));

    expect(useAppStore.getState().draftCoord).toBeNull();
  });

  it('offers the place search again rather than a venue already chosen', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    fireEvent.click(screen.getByRole('button', { name: /Ve městě/ }));

    expect(screen.getByPlaceholderText('Hledat místo (bar, klub, park…)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Změnit místo' })).not.toBeInTheDocument();
  });

  it('drops an off-campus point when switching to campus, as it always did', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Kampus/ }));
    expect(useAppStore.getState().draftCoord).toBeNull();
  });

  // With no venue of either kind, there is nothing to preview.
  it('takes the show-on-map button away with the venue', () => {
    render(<EventComposer onDone={() => {}} />);
    pickRoom();
    expect(screen.getByRole('button', { name: 'Ukázat na mapě' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ve městě/ }));
    expect(screen.queryByRole('button', { name: 'Ukázat na mapě' })).not.toBeInTheDocument();
  });
});

/**
 * Every event gets a start time.
 *
 * Time used to be optional, which left `time: null` rows in spolky_events —
 * and an event with no start has no "two hours before", so it silently got no
 * reminder at all. Rather than inventing a default hour to notify at, the
 * composer now requires the time, which is the only source these rows have
 * (mapEvents reads spolky_events exclusively).
 */
describe('EventComposer — a start time is required', () => {
  const fillTitleAndDate = () => {
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Kvíz' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
  };

  it('keeps publish disabled until a time is given', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillTitleAndDate();

    // Title, date and venue are all present — only the time is missing.
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeDisabled();
  });

  it('enables publish once the time is set', () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillTitleAndDate();
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });

    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();
  });

  it('publishes the time rather than a null', async () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    render(<EventComposer onDone={() => {}} />);
    fillTitleAndDate();
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit akci' }));

    await waitFor(() => expect(createPost).toHaveBeenCalledTimes(1));
    expect(createPost.mock.calls[0][0].time).toBe('19:30');
  });
});


/**
 * `url` is optional, but when it's filled in it becomes an <a href> in
 * EventDetailCard and openExternal — a `javascript:` scheme there would run
 * in the page. Same rule housing links get: reis://housing is the one
 * non-http scheme allowed through.
 */
describe('EventComposer — url validation', () => {
  const fillRequired = () => {
    useAppStore.setState({ draftCoord: [16.61, 49.21] });
    fireEvent.change(screen.getByPlaceholderText('Název akce'), { target: { value: 'Kvíz' } });
    fireEvent.click(screen.getByText('Vyberte datum'));
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Čas' }), { target: { value: '1930' } });
  };

  it('disables publish and shows an inline error for a javascript: url', () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();

    fireEvent.change(screen.getByPlaceholderText('https://… nebo reis://housing pro otevření nástěnky bydlení'), {
      target: { value: 'javascript:alert(1)' },
    });

    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeDisabled();
    expect(screen.getByText('Zadej odkaz https:// nebo reis://housing')).toBeInTheDocument();
  });

  it('allows the reis://housing token through, with no error and publish enabled', () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();

    fireEvent.change(screen.getByPlaceholderText('https://… nebo reis://housing pro otevření nástěnky bydlení'), {
      target: { value: 'reis://housing' },
    });

    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();
    expect(screen.queryByText('Zadej odkaz https:// nebo reis://housing')).toBeNull();
  });

  it('leaves publish enabled when the url field is left empty', () => {
    render(<EventComposer onDone={() => {}} />);
    fillRequired();
    expect(screen.getByRole('button', { name: 'Zveřejnit akci' })).toBeEnabled();
  });
});
