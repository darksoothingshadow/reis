import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { LandmarkPicker } from './LandmarkPicker';
import { MapEventsSection } from './MapEventsSection';

type TabKey = 'events' | 'places';

// Top-right discovery panel on the STUDENT map. "Events" surfaces the society
// events pinned on the map; "Places" keeps the original grouped destinations.
// There used to be a third "Moje akce" tab that doubled as the entrance to
// society authoring — that now lives on its own surface (AdminConsole), so this
// panel is student-only and has no notion of roles or modes.
export function MapSidePanel() {
  const tab = useAppStore((s) => s.mapPanelTab);
  const setTab = useAppStore((s) => s.setMapPanelTab);
  const { t } = useTranslation();

  // Text-only, equal-width tabs so both fit one row in the narrow panel.
  const tabBtn = (key: TabKey, label: string) => (
    <button
      type="button"
      role="tab"
      id={`map-tab-${key}`}
      aria-selected={tab === key}
      aria-controls="map-tabpanel"
      // DaisyUI's resting tab colour measured 3.34:1 in the light theme; an
      // unselected tab is still a control you have to read to choose.
      className={`tab flex-1 whitespace-nowrap px-1 ${
        tab === key ? 'tab-active font-semibold' : 'text-base-content/70'
      }`}
      onClick={() => setTab(key)}
    >
      {label}
    </button>
  );

  return (
    <div className="flex max-h-[80vh] w-72 flex-col overflow-hidden rounded-box border border-base-300 bg-base-100/95 shadow-popover-heavy backdrop-blur-sm">
      <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0 flex-nowrap">
        {tabBtn('events', t('map.events'))}
        {tabBtn('places', t('map.places'))}
      </div>
      <div
        id="map-tabpanel"
        role="tabpanel"
        aria-labelledby={`map-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {tab === 'places' ? <LandmarkPicker /> : <MapEventsSection />}
      </div>
    </div>
  );
}
