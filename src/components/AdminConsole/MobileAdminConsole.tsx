import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { AdminConsoleHeader } from './AdminConsoleHeader';
import { AdminEventList } from './AdminEventList';
import { SuggestionsInbox } from './SuggestionsInbox';
import { SocietyAccountsPanel } from './SocietyAccountsPanel';
import { ChangeMyPasswordForm } from './ChangeMyPasswordForm';
import { AdminConsoleMap } from './AdminConsoleMap';
import { HousingModerationPanel } from './HousingModerationPanel';
import { AdminStatsPanel } from './AdminStatsPanel';

/**
 * A phone has no room for the desktop's side-by-side list and map, so they share
 * the screen behind a toggle — and the map has to be reachable on its own, not
 * only as a step inside the composer: rows fly the camera to their event, which
 * means nothing if the map can never be seen.
 *
 * Two rules make this work:
 *
 * 1. **The list is never unmounted.** EventComposer (hosted inside
 *    AdminEventList) keeps the entire form — title, date, time, venue, category
 *    — in local useState. Swapping it out for the map destroyed all of it, so
 *    tapping "pick on the map" wiped the form and handed back an empty one. It
 *    is hidden with CSS instead, which preserves every field.
 * 2. **The map is only mounted while visible.** Leaflet measures its container
 *    on init; mounting it inside a `hidden` element gives it a zero-size
 *    viewport and a map that never paints. Mounting on demand costs a re-init
 *    per toggle, which is cheap and, unlike the form, carries nothing worth
 *    keeping.
 *
 * `placingEvent` forces the map and hides the toggle: that flow has its own
 * instruction banner and Cancel, so a second way out would just be ambiguous.
 */
type Tab = 'list' | 'map' | 'suggestions' | 'accounts' | 'housing' | 'stats';

export function MobileAdminConsole() {
  const placing = useAppStore((s) => s.placingEvent);
  const { t } = useTranslation();
  // Suggestions are a reIS-wide inbox, so the third tab exists only for the
  // reIS admin login; a society gets the same two tabs it always had.
  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  const unread = useAppStore((s) => s.suggestionsUnread);
  const loadAdminHousing = useAppStore((s) => s.loadAdminHousing);
  const loadAdminStats = useAppStore((s) => s.loadAdminStats);
  const [tab, setTab] = useState<Tab>('list');
  const draftFocus = useAppStore((s) => s.draftFocusRequest);
  // "Ukázat na mapě" has to bring the map forward as well as move the camera —
  // on a phone the two panes are a tab apart, so a silent camera move would be
  // invisible. Keyed on the counter so a second press works after the society
  // taps back to the list, and baselined at mount because the counter outlives
  // the console: a plain `> 0` would reopen straight onto the map for anyone
  // who had previewed a draft at any point earlier.
  const seenFocusRef = useRef(draftFocus);
  useEffect(() => {
    if (draftFocus <= seenFocusRef.current) return;
    seenFocusRef.current = draftFocus;
    setTab('map');
  }, [draftFocus]);
  const showMap = placing || tab === 'map';
  const showSuggestions = !placing && isReisAdmin && tab === 'suggestions';
  const showHousing = !placing && isReisAdmin && tab === 'housing';
  const showStats = !placing && isReisAdmin && tab === 'stats';
  // Every account gets the accounts tab — a society needs it to change its own
  // password; only a reIS admin additionally sees the reset panel inside it.
  const showAccounts = !placing && tab === 'accounts';

  const tabBtn = (key: Tab, label: string, badge = 0) => (
    <button
      type="button"
      role="tab"
      aria-selected={tab === key}
      className={`tab flex-1 px-1 ${tab === key ? 'tab-active font-semibold' : 'text-base-content'}`}
      onClick={() => {
        if (key === 'housing') void loadAdminHousing();
        if (key === 'stats') void loadAdminStats();
        setTab(key);
      }}
    >
      {label}
      {badge > 0 && <span className="badge badge-primary badge-xs ml-1">{badge}</span>}
    </button>
  );

  return (
    <div
      data-testid="admin-console-mobile"
      className="flex h-screen w-full flex-col overflow-hidden bg-base-200 pt-[var(--safe-top,0px)] text-base-content"
    >
      <AdminConsoleHeader compact />
      {!placing && (
        <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0 flex-nowrap overflow-x-auto">
          {tabBtn('list', t('admin.listTab') as string)}
          {tabBtn('map', t('admin.mapTab') as string)}
          {isReisAdmin && tabBtn('suggestions', t('admin.suggestionsTab') as string, unread)}
          {isReisAdmin && tabBtn('housing', t('admin.housingTab') as string)}
          {isReisAdmin && tabBtn('stats', t('admin.statsTab') as string)}
          {tabBtn('accounts', t('admin.accountsTab') as string)}
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        {/* Hidden, not unmounted — see rule 1 above. `bg-base-100` matches the
            desktop aside: EventComposer's bg-base-200/60 header is a tint meant
            for base-100 and measures 1.005:1 (invisible) on base-200. */}
        <div
          className={showMap || showSuggestions || showAccounts || showHousing || showStats ? 'hidden' : 'h-full bg-base-100'}
        >
          <AdminEventList />
        </div>
        {showAccounts && (
          <div className="h-full overflow-y-auto bg-base-100 p-3">
            <div className="flex flex-col gap-6">
              {isReisAdmin && <SocietyAccountsPanel />}
              <ChangeMyPasswordForm />
            </div>
          </div>
        )}
        {showSuggestions && (
          <div className="h-full overflow-y-auto bg-base-100 p-2">
            <SuggestionsInbox />
          </div>
        )}
        {showHousing && (
          <div className="h-full overflow-y-auto bg-base-100 p-2">
            <HousingModerationPanel />
          </div>
        )}
        {showStats && (
          <div className="h-full overflow-y-auto bg-base-100">
            <AdminStatsPanel />
          </div>
        )}
        {showMap && (
          <div className="h-full">
            <AdminConsoleMap />
          </div>
        )}
      </div>
    </div>
  );
}
