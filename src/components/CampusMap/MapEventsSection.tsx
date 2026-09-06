import { CalendarOff } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { ALL_SOCIETIES } from '../../data/societies';
import { readableTextColor } from '../../utils/readableTextColor';
import { effectiveFilter, filterEvents, weekSections } from './eventHelpers';
import { EventRow } from './EventRow';

// The events tab body shared by the desktop MapSidePanel and the mobile map
// sheet's Akce tab: an All / My-faculty filter and the upcoming events grouped
// into "This week" / "Next week", soonest first. Rows open the bottom-left
// detail card on desktop (off-campus rows open it too but don't move the map).
export interface MapEventsSectionProps {
  /**
   * The phone hides the society chips: nine of them scroll horizontally above a
   * list that is usually two or three events long, so the filter cost more room
   * than the thing it filtered. The desktop side panel keeps them, where the
   * row has space and the list is longer.
   */
  showFilter?: boolean;
}

export function MapEventsSection({ showFilter = true }: MapEventsSectionProps) {
  // This panel only ever renders on the student map — the admin console has its
  // own list — so the public feed is the only source.
  const events = useAppStore((s) => s.mapEvents);
  const filter = useAppStore((s) => s.eventFilter);
  const setFilter = useAppStore((s) => s.setEventFilter);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const { subscribedFaculties } = useEventsFacultySettings();
  const { t, language } = useTranslation();
  const locale = language === 'en' ? 'en-US' : 'cs-CZ';

  // 'all' when the chips are hidden, and not merely defaulted: `eventFilter` is
  // shared store state, so a filter set on the desktop would go on narrowing the
  // phone's list with no control left to clear it — events would just be
  // missing. Hiding the filter has to mean showing everything.
  const visible = filterEvents(events, effectiveFilter(filter, showFilter));
  const sections = weekSections(visible);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  // Society filter chips: "All" first, then the societies with the student's own
  // faculty spolek (e.g. SU PEF for a PEF student) always leading. Stable sort
  // keeps the remaining societies in their catalog order.
  const homeFaculty = subscribedFaculties.find((k) => k !== 'mendelu');
  const societies = [...ALL_SOCIETIES].sort(
    (a, b) => (a.facultyKey === homeFaculty ? 0 : 1) - (b.facultyKey === homeFaculty ? 0 : 1)
  );
  // Filter chips, not list rows. `btn btn-xs btn-ghost` read as a row of
  // tappable menu items — full-width, hover-filling, with a scrollbar under
  // them — rather than a set of toggles. A bordered, tinted pill with a muted
  // resting state says "filter" at a glance and takes far less room.
  const chipBase =
    'flex h-7 flex-shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-semibold transition-colors';
  // No border at all: the outline was carrying the shape, and on the dark theme
  // it could not — base-300 (#0f172a) around a base-200 (#111827) fill is
  // 1.006:1, invisible, the recurring reIS dark-theme bug. The fill alone says
  // "chip", and tinting it from base-content rather than the base-100/200/300
  // ramp (which INVERTS between themes) means it reads on any surface in either.
  const chipIdle = 'bg-base-content/5 text-base-content/70';

  return (
    <div className="flex max-h-[60vh] flex-col">
      {showFilter && (
        // Wrap, never scroll sideways. This row renders on DESKTOP only — the
        // phone panel passes showFilter={false} — and a horizontal scroller
        // with its scrollbar hidden is a touch pattern: with a mouse there is
        // nothing to swipe and no bar to drag, so every society past the fourth
        // was cut off at the panel edge and unreachable. Wrapping costs one
        // more row and makes the whole filter visible at once.
        <div className="flex flex-wrap gap-1.5 px-3 py-2">
          {/* "Vše" keeps the brand primary; each society chip fills with its own
              brand colour when active, so the colour legend pays off here */}
          <button
            onClick={() => setFilter('all')}
            className={`${chipBase} ${filter === 'all' ? 'bg-primary text-primary-content' : chipIdle}`}
          >
            {t('map.allSocieties')}
          </button>
          {societies.map((s) => {
            const active = filter === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setFilter(s.id)}
                className={`${chipBase} ${active ? '' : chipIdle}`}
                style={
                  active
                    ? { backgroundColor: s.color, color: readableTextColor(s.color) }
                    : undefined
                }
              >
                {s.shortName}
              </button>
            );
          })}
        </div>
      )}
      <div className="overflow-y-auto">
        {sections.length === 0 ? (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center text-base-content/60">
            <CalendarOff size={28} className="opacity-40" />
            <p className="text-sm">{t('map.noEvents')}</p>
          </div>
        ) : (
          sections.map((s) => (
            <div key={s.key}>
              <div className="border-l-2 border-transparent px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-base-content/60">
                {t(`map.${s.key}`)}
              </div>
              {s.events.map((e) => (
                <EventRow
                  key={e.id}
                  event={e}
                  locale={locale}
                  t={t}
                  selected={e.id === selectedId}
                  onClick={() => focusEvent(e.id, { fly: true })}
                />
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
