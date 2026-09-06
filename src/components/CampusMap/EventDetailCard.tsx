import { MapPin, Navigation, ExternalLink, Clock } from 'lucide-react';
import { CATEGORY_EMOJI_SRC } from '../../data/eventCategories';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { societyById } from '../../data/societies';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { roomCodeToName } from './mapHelpers';
import type { RoomIndexEntry } from '../../types/campusMap';
import { parseEventDate } from './eventHelpers';
import { EventRsvp } from './EventRsvp';
import { openExternal, validateExternalUrl } from '../../mobile/openExternal';
import { getPlatform } from '../../platform';
import { openVenue } from '../../mobile/openVenue';
import { logError } from '../../utils/reportError';
import { venueMapUrl } from '../../utils/venueMapUrl';
import { isHousingLink } from '../../utils/housingLink';
import type { MapEvent } from '../../types/events';

const INDEX = roomsIndexJson as RoomIndexEntry[];

/**
 * On Capacitor a `target="_blank"` anchor hands the URL to the SYSTEM browser,
 * which holds none of the app's session — see src/mobile/openExternal.ts. This
 * card became reachable on mobile when the phone map gained event pins, so both
 * of its links needed routing through the in-app browser.
 *
 * Kept as an anchor with an onClick rather than converted to a button:
 * `openExternal` no-ops off Capacitor, so the href stays the real behaviour on
 * desktop, and middle-click / "open in new tab" keep working there.
 */
function openInApp(e: React.MouseEvent<HTMLAnchorElement>) {
  const href = e.currentTarget.href;
  if (getPlatform().kind !== 'capacitor') return;
  e.preventDefault();
  void openExternal(href);
}

// Bottom-left detail body for a selected event — a read-only preview shown to
// students and societies alike: a small society avatar + title + host, then the
// facts (when / what / where), the social block (attendance + RSVP), and More
// info. A society edits/deletes its own events from the "Moje akce" panel, so
// this card carries no authoring controls (keeps management in one place).
/**
 * `flush` drops the card's own frame.
 *
 * Inside the tablet rail the frame is a box drawn inside a box: the rail is
 * already a bordered, rounded panel, and a second one 16px in is the classic
 * nested-card look that stops a sidebar reading as native. The desktop's
 * floating DetailPanel and the phone's sheet both still want it — there the
 * card IS the surface.
 */
export function EventDetailCard({ event, flush = false }: { event: MapEvent; flush?: boolean }) {
  const focusRoom = useAppStore((s) => s.focusRoomByCode);
  const openHousingBoard = useAppStore((s) => s.openHousingBoard);
  const { t, language } = useTranslation();
  const soc = societyById(event.societyId);
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';
  const dateLabel = parseEventDate(event.date).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className={flush ? '' : 'overflow-hidden rounded-lg border border-base-300 bg-base-100'}>
      <div className="space-y-3 p-3">
        {/* identity: avatar + title + host */}
        <div className="flex items-center gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-base-300"
            style={{ backgroundColor: soc.color }}
          >
            {soc.logo ? (
              <img src={soc.logo} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-sm font-extrabold text-white">{soc.glyph}</span>
            )}
          </span>
          <div className="min-w-0">
            <h3 className="line-clamp-2 font-bold leading-tight text-base-content">
              {event.title}
            </h3>
            <span className="text-xs text-base-content/60">
              {t('map.hostedBy')} {soc.shortName}
            </span>
          </div>
        </div>

        {/* the facts */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <Clock size={13} className="shrink-0" />
            <span>
              {dateLabel}
              {event.time ? ` · ${event.time}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-base-content/70">
            <img src={CATEGORY_EMOJI_SRC[event.category]} alt="" className="h-4 w-4 shrink-0" />
            <span>{t(`map.category.${event.category}`)}</span>
          </div>
          {event.roomCode ? (
            <button
              className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              onClick={() => focusRoom(event.roomCode!)}
            >
              <MapPin size={13} className="shrink-0" /> {roomCodeToName(event.roomCode, INDEX)}
            </button>
          ) : event.location ? (
            event.coord ? (
              // Off-campus venue: open it in Google Maps so the student can
              // navigate there. coord is [lng, lat]; Maps wants lat,lng.
              <a
                // The href stays the WEB url so the desktop, a middle-click and
                // "copy link address" all keep working. The tap is intercepted
                // on Capacitor, where a native scheme is what actually reaches
                // the Maps app — see mobile/openVenue.
                href={venueMapUrl(event.coord, event.location ?? '', 'web')}
                target="_blank"
                rel="noopener noreferrer"
                // Tells the global external-link handler to keep its hands off:
                // it runs in the capture phase, so preventing the default below
                // is too late to stop it and the venue opened twice. See
                // `externalHrefFromClick`.
                data-native-open="true"
                onClick={(e) => {
                  if (getPlatform().kind !== 'capacitor') return;
                  e.preventDefault();
                  // The default is already suppressed, so a rejection here — a
                  // failed lazy `@capacitor/core` import is the realistic one —
                  // would leave the tap doing nothing at all. Fall back to the
                  // web URL, which is what the anchor would have done.
                  void openVenue(event.coord as [number, number], event.location ?? '').catch(
                    (err) => {
                      logError('EventDetailCard.openVenue', err);
                      void openExternal(venueMapUrl(event.coord!, event.location ?? '', 'web'));
                    }
                  );
                }}
                className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                <MapPin size={13} className="shrink-0" /> {event.location}
                {/* Navigation, not ExternalLink. The ↗ is the app's mark for
                    "this leaves for a web page", and it was promising exactly
                    the wrong thing on the one control whose job is to start a
                    journey. */}
                <Navigation size={11} className="shrink-0 opacity-60" />
              </a>
            ) : (
              <div className="flex items-center gap-1.5 text-sm text-base-content/70">
                <MapPin size={13} className="shrink-0" /> {event.location}
              </div>
            )
          ) : null}
        </div>

        <div className="border-t border-base-300 pt-3">
          <EventRsvp eventId={event.id} accent={soc.color} />
        </div>

        {isHousingLink(event.url) ? (
          <button
            type="button"
            className="btn btn-primary btn-sm btn-block"
            onClick={openHousingBoard}
          >
            {t('housing.title')}
          </button>
        ) : (
          // event.url is data from Supabase, not something the app typed —
          // a `javascript:` or other non-external scheme must never reach an
          // <a href>. Same validator openExternal itself uses before opening.
          event.url &&
          validateExternalUrl(event.url) && (
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={openInApp}
              className="btn btn-primary btn-sm btn-block"
            >
              {t('map.moreInfo')} <ExternalLink size={13} />
            </a>
          )
        )}
      </div>
    </div>
  );
}
