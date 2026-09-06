import { useState } from 'react';
import { toast } from 'sonner';
import { CalendarPlus, Check, MapPin, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { createPost, updatePost, type PostInput } from '../../api/societyPosts';
import { isScheduledEvent, goLiveDate } from './eventWindow';
import { isHousingLink } from '../../utils/housingLink';
import { validateExternalUrl } from '../../mobile/openExternal';
import { MiniCalendar } from './MiniCalendar';
import { ComposerRoomSearch } from './ComposerRoomSearch';
import { ComposerPlaceSearch } from './ComposerPlaceSearch';
import { ComposerTimeField } from './ComposerTimeField';
import { roomCodeToName } from './mapHelpers';
import roomsIndexJson from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import type { EventCategory } from '../../types/events';
import { EVENT_CATEGORIES, CATEGORY_ICON } from '../../data/eventCategories';

const INDEX = roomsIndexJson as RoomIndexEntry[];

// Create/edit a society event. No <form> submit (sandboxed iframe blocks it);
// Publish/Save is a button. Venue is either a free-placed off-campus point
// (draftCoord, captured by clicking the map) or a searched campus room
// (ComposerRoomSearch, which resolves its own coord). Editing preserves the
// event's venue_kind/room_code/category instead of overwriting them — the old
// version hardcoded venueKind:'offcampus' on every save, silently rewriting
// campus events back to a free point (CodeRabbit Critical).
export function EventComposer({ onDone }: { onDone: () => void }) {
  // The society being authored, not the account's own — a reIS admin belongs to
  // no society and picks one in the console header. RLS accepts either.
  const associationId = useAppStore((s) => s.adminActiveAssociationId);
  const email = useAppStore((s) => s.adminSession?.user.email ?? '');
  const draftCoord = useAppStore((s) => s.draftCoord);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const placeDraftCoord = useAppStore((s) => s.placeDraftCoord);
  const clearDraftCoord = useAppStore((s) => s.clearDraftCoord);
  const previewDraftOnMap = useAppStore((s) => s.previewDraftOnMap);
  const loadSocietyPosts = useAppStore((s) => s.loadSocietyPosts);
  const reloadMapEvents = useAppStore((s) => s.reloadMapEvents);
  const editId = useAppStore((s) => s.editEventId);
  const editing = useAppStore(
    (s) => s.societyMapEvents.find((e) => e.id === s.editEventId) ?? null
  );
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? '');
  const [time, setTime] = useState(editing?.time ?? '');
  const [url, setUrl] = useState(editing?.url ?? '');
  const [venue, setVenue] = useState<'offcampus' | 'campus'>(
    editing?.venueKind === 'campus' ? 'campus' : 'offcampus'
  );
  const [room, setRoom] = useState<{ code: string; name: string; coord: [number, number] } | null>(
    editing && editing.venueKind === 'campus' && editing.roomCode && editing.coord
      ? {
          code: editing.roomCode,
          // roomCode is the IS-internal code ("BA39N1009"); show the hall name
          // ("Q01") in the picked-room chip, same as the search results do.
          name: editing.location ?? roomCodeToName(editing.roomCode, INDEX),
          coord: editing.coord,
        }
      : null
  );
  const [category, setCategory] = useState<EventCategory>(editing?.category ?? 'party');
  // Display name for an off-campus venue (from the Photon place search). Null
  // when the point was dropped on the map by hand rather than searched.
  const [placeName, setPlaceName] = useState<string | null>(
    editing && editing.venueKind !== 'campus' ? (editing.location ?? null) : null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  // The room stays the source of truth for a campus venue; draftCoord is the
  // map's VIEW of it, kept in step by selectRoom/clearRoom below.
  const coord = venue === 'campus' ? (room?.coord ?? null) : draftCoord;
  // url is optional, but once something is typed it must be either the
  // housing token or a URL openExternal will actually open — the same rule
  // EventDetailCard enforces on the way OUT.
  const trimmedUrl = url.trim();
  const urlInvalid =
    trimmedUrl !== '' && !isHousingLink(trimmedUrl) && !validateExternalUrl(trimmedUrl);
  // Time is required, not optional. A `time: null` row has no start, so it has
  // no "two hours before" and silently got no reminder at all — and the
  // composer is the only place these rows come from (the map reads
  // spolky_events exclusively). Requiring it here is what makes "every event
  // gets a reminder" true, rather than inventing a default hour to notify at.
  const ready = !!title.trim() && !!date && !!time && !!coord && !urlInvalid;
  const scheduled = date ? isScheduledEvent(date) : false;

  const close = () => {
    clearDraftCoord();
    onDone();
  };

  const switchVenue = (v: 'offcampus' | 'campus') => {
    if (v === venue) return;
    setVenue(v);
    setRoom(null);
    setPlaceName(null);
    // Both directions, not just the switch TO campus. Once a campus room began
    // mirroring its coordinate into draftCoord (so the map can draw its pin),
    // switching AWAY from campus left that coordinate behind: the composer read
    // it as an off-campus venue already chosen, hid the place search, and would
    // have published an off-campus event sitting on a lecture hall with no
    // location name. Changing the venue KIND invalidates whatever point either
    // kind had picked.
    clearDraftCoord();
  };

  // A campus room used to keep its coordinate here and nowhere else, so the map
  // had nothing to draw and a society could not check a campus venue before
  // publishing. Mirroring it into the store is what puts the draft pin on the
  // map for BOTH venue kinds.
  const selectRoom = (sel: { code: string; name: string; coord: [number, number] }) => {
    setRoom(sel);
    placeDraftCoord(sel.coord);
  };
  const clearRoom = () => {
    setRoom(null);
    clearDraftCoord();
  };

  // A searched venue sets both the display name and the coordinate; clearing
  // resets both so the search box comes back.
  const selectPlace = ({ name, coord: c }: { name: string; coord: [number, number] }) => {
    setPlaceName(name);
    placeDraftCoord(c);
  };
  const clearPlace = () => {
    setPlaceName(null);
    clearDraftCoord();
  };

  const publish = async () => {
    if (!ready || busy || !associationId || !coord) return;
    setBusy(true);
    setError(false);
    const input: PostInput = {
      title: title.trim(),
      body: '',
      category,
      date,
      time: time || null,
      venueKind: venue,
      roomCode: venue === 'campus' ? (room?.code ?? null) : null,
      coordLng: coord[0],
      coordLat: coord[1],
      location: venue === 'campus' ? null : placeName,
      url: url.trim() || null,
    };
    try {
      const res = editId
        ? await updatePost(editId, {
            title: input.title,
            date: input.date,
            time: input.time ?? null,
            category: input.category,
            venue_kind: input.venueKind,
            room_code: input.roomCode ?? null,
            coord_lng: input.coordLng,
            coord_lat: input.coordLat,
            location: input.location ?? null,
            url: input.url ?? null,
          })
        : await createPost(input, associationId, email);
      if (res.error) {
        setError(true);
        return;
      }
      await loadSocietyPosts();
      void reloadMapEvents(); // surface the change on the public "Akce" feed too
      toast.success(
        editId ? t('map.toastSaved') : scheduled ? t('map.toastScheduled') : t('map.toastPublished')
      );
      close();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-base-300 bg-base-200/60 p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/20">
          <CalendarPlus size={14} className="text-primary" />
        </span>
        <span className="text-sm font-bold">
          {editId ? t('map.editEvent') : t('map.createEvent')}
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-xs ml-auto"
          aria-label={t('common.cancel')}
          onClick={close}
        >
          <X size={15} />
        </button>
      </div>

      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.eventName')}
      </label>
      <input
        className="input input-bordered w-full"
        placeholder={t('map.eventName')}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className="form-control w-full">
        <span className="label-text text-xs">{t('admin.urlLabel')}</span>
        <input
          className="input input-bordered input-sm"
          placeholder={t('admin.urlHint')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
      </label>
      {urlInvalid && <p className="mt-1 text-[11px] text-error">{t('admin.urlInvalid')}</p>}

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.eventDate')}
      </label>
      <MiniCalendar
        value={date || null}
        onChange={setDate}
        placeholder={t('map.selectDate')}
        t={t}
        locale={locale}
      />
      {scheduled && (
        <p className="mt-1.5 text-[11px] text-warning">
          {t('map.goesLive')}{' '}
          {goLiveDate(date).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}
        </p>
      )}

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.eventTime')}
      </label>
      <ComposerTimeField value={time} onChange={setTime} t={t} />

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.categoryLabel')}
      </label>
      <div className="flex flex-wrap gap-1.5">
        {EVENT_CATEGORIES.map((key) => {
          const Icon = CATEGORY_ICON[key];
          const label = t(`map.category.${key}`);
          return (
            <button
              key={key}
              type="button"
              aria-label={label}
              aria-pressed={category === key}
              className={`btn btn-xs gap-1 ${category === key ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
              onClick={() => setCategory(key)}
            >
              <Icon size={13} /> {label}
            </button>
          );
        })}
      </div>

      <label className="mb-1 mt-3 block text-[10px] font-bold uppercase tracking-wide text-base-content/60">
        {t('map.venueLabel')}
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          className={`btn btn-sm flex-1 gap-1 ${venue === 'offcampus' ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
          onClick={() => switchVenue('offcampus')}
        >
          <MapPin size={13} /> {t('map.venueOffcampus')}
        </button>
        <button
          type="button"
          className={`btn btn-sm flex-1 gap-1 ${venue === 'campus' ? 'btn-primary' : 'btn-ghost border border-base-content/15'}`}
          onClick={() => switchVenue('campus')}
        >
          {t('map.venueCampus')}
        </button>
      </div>

      {venue === 'campus' ? (
        <ComposerRoomSearch
          selected={room ? { code: room.code, name: room.name } : null}
          onSelect={selectRoom}
          onClear={clearRoom}
          t={t}
        />
      ) : draftCoord ? (
        // A venue is chosen (searched or dropped on the map): one unified chip.
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm">
          <Check size={14} className="text-success" />
          <span className="min-w-0 flex-1 truncate">{placeName ?? t('map.mapPoint')}</span>
          <button type="button" className="btn btn-ghost btn-xs" onClick={clearPlace}>
            {t('map.changePlace')}
          </button>
        </div>
      ) : (
        <>
          <ComposerPlaceSearch selected={null} onSelect={selectPlace} onClear={clearPlace} t={t} />
          {/* Fallback for venues Photon doesn't know: drop the pin by hand. */}
          <button
            type="button"
            className="btn btn-ghost btn-xs mt-1 w-full gap-1.5 text-base-content/60"
            onClick={beginPlacing}
          >
            <MapPin size={13} /> {t('map.orPickOnMap')}
          </button>
        </>
      )}

      {/* Confirming the location is the whole point of the pin: without a way
          to get to it, a society publishes on trust. Shown for both venue kinds
          the moment a coordinate exists. */}
      {coord && (
        <button
          type="button"
          className="btn btn-ghost btn-xs mt-1.5 w-full gap-1.5 text-base-content/70"
          onClick={previewDraftOnMap}
        >
          <MapPin size={13} /> {t('map.showOnMap')}
        </button>
      )}

      {error && <p className="mt-2 text-[11px] text-error">{t('admin.saveError')}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={close}>
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!ready || busy}
          onClick={publish}
        >
          {editId ? t('map.saveChanges') : t('map.publish')}
        </button>
      </div>
    </div>
  );
}
