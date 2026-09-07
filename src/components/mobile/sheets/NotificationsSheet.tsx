import { useEffect, useRef, type ReactNode } from 'react';
import { Bell } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useNotificationFeed } from '../../../hooks/useNotificationFeed';
import { useDeadlineAlerts } from '../../../hooks/useDeadlineAlerts';
import { NotificationItem } from '../../Notifications/NotificationItem';
import { DeadlineAlertItem } from '../../Notifications/DeadlineAlertItem';
import { trackNotificationClick } from '../../../services/spolky';
import { openExternal } from '../../../mobile/openExternal';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';

export interface NotificationsSheetProps {
  onClose: () => void;
}

/**
 * Full-size feed of deadline alerts + spolky notifications, reusing the
 * exact same `useNotificationFeed`/`useDeadlineAlerts` hooks and
 * `NotificationItem`/`DeadlineAlertItem` renderers as desktop's
 * `NotificationDropdown` — this is the phone's whole "novinky" surface, not
 * a second implementation of it.
 */
/**
 * The app's own section label — `ProfileScreen`, `ExamGroup` and the search
 * results all use exactly this. Deadlines and society news are two different
 * kinds of thing, and stacking them unlabelled in one list was half of why the
 * feed read as a jumble.
 */
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="pb-1.5 pt-3 text-xs font-bold uppercase tracking-wider text-base-content/60 first:pt-1">
      {children}
    </div>
  );
}

export function NotificationsSheet({ onClose }: NotificationsSheetProps) {
  const { t } = useTranslation();
  const { notifications, loading, markVisible, settingsLoading, readIds } = useNotificationFeed();
  const { alerts, markAllSeen } = useDeadlineAlerts();
  const hasContent = notifications.length > 0 || alerts.length > 0;
  const mapEvents = useAppStore((s) => s.mapEvents);
  const mapEventsLoaded = useAppStore((s) => s.mapEventsLoaded);
  const loadMapEvents = useAppStore((s) => s.loadMapEvents);
  const focusEventById = useAppStore((s) => s.focusEventById);
  const setMobileTab = useAppStore((s) => s.setMobileTab);
  const markNotificationsRead = useAppStore((s) => s.markNotificationsRead);

  /**
   * Opening this sheet IS reading the feed — so the sheet marks it read.
   *
   * The bell's badge counts `notifications` minus `readIds`, and the only code
   * that ever added to `readIds` was `useNotificationFeed().toggle()`, which
   * belongs to the DESKTOP dropdown. The phone's bell calls `pushSheet`, so the
   * student read every notification here and the dot stayed lit forever.
   *
   * Gated on `settingsLoading`, not just on mount: `notifications` is the feed
   * filtered by the spolky subscriptions, which are read out of IndexedDB, so
   * on a cold open the list is still empty for a tick or two. Marking then
   * marks nothing and the badge survives — the very bug, reintroduced through a
   * race. Following the list instead of the mount also covers the 5-minute
   * refetch landing while the sheet is still up.
   */
  useEffect(() => {
    if (settingsLoading) return;
    const unread = notifications.filter((n) => !readIds.has(n.id)).map((n) => n.id);
    if (unread.length) void markNotificationsRead(unread);
  }, [notifications, readIds, settingsLoading, markNotificationsRead]);

  /**
   * The other half of the same badge. The bell counts unseen deadline alerts
   * too now that the calendar's strip is gone and this sheet is the only place
   * a deadline appears — so a count that opening the sheet could not clear
   * would be the very bug above, moved one field across.
   *
   * `markAllSeen` is already idempotent against `seenDeadlineAlertIds`, and
   * unlike the feed these are derived synchronously from data the store
   * already holds, so there is no settings gate to wait on.
   */
  useEffect(() => {
    if (alerts.length) markAllSeen(alerts.map((a) => a.id));
  }, [alerts, markAllSeen]);

  /**
   * A notification IS a `spolky_events` row — `fetchNotifications` reads that
   * table and maps its optional `url` column to `link`. Gating the whole tap on
   * that link meant every society event without one, which is most of them, was
   * announced here and could not be opened: the tap did nothing at all.
   *
   * The row's id is the map event's id (one `spolky_events` id space, mapped by
   * `toMapEvent`), so the event the student tapped is one the map already knows
   * how to show — `focusEventById` opens the same EventDetailCard a pin does,
   * with the venue, the RSVP and the event's own URL on it.
   *
   * The link keeps priority where it exists: an author who set a URL chose a
   * destination, and the academic feed's rows are deadlines rather than places.
   * A notification with neither a link nor a matching event (a far-future one
   * the public map filters out) does nothing rather than switching to a map with
   * nothing selected — and is not counted as a click, which is reserved for taps
   * that actually went somewhere.
   */
  // The same question the tap asks, asked for the affordance: a row that opens
  // something has to look like it does. While the map feed is still outstanding
  // the answer is "assume it does" — every notification IS an event row, so a
  // match is the overwhelmingly common case, and guessing the other way paints
  // the row as dead for as long as the fetch takes.
  const opensSomewhere = (n: (typeof notifications)[number]) =>
    !!n.link || !mapEventsLoaded || mapEvents.some((e) => e.id === n.id);

  // One activation at a time. Awaiting the load opens a window the synchronous
  // version never had, and a second tap inside it ran a second handler: two
  // fetches (loadMapEvents guards on "already loaded", not on "already
  // loading") and two increment_post_click RPCs for one intent. A slow row is
  // exactly the row a student taps twice, so this is the common case, not the
  // exotic one. The guard spans the in-flight load and nothing more.
  const openingRef = useRef(false);

  // ...and one activation TOTAL, not one per branch. A linked row returns
  // before it ever reads `openingRef`, so tapping one while a linkless
  // activation was still awaiting the map feed used to leave that first
  // handler alive: the load lands, and it focuses the earlier event and
  // switches to the map behind the browser the student was just handed. They
  // come back to somebody else's event instead of the tab they left. The later
  // tap is the later intent, so it cancels the earlier one outright rather
  // than queueing behind it.
  //
  // Dismissing the sheet is a supersession too — the student who closes it
  // mid-load has left, and a handler with no surface left must not drag the
  // map tab up over whatever they went to instead.
  const activationRef = useRef(0);
  useEffect(
    () => () => {
      activationRef.current += 1;
    },
    []
  );

  const openNotification = async (n: (typeof notifications)[number]) => {
    const track = () => {
      if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
    };
    if (n.link) {
      activationRef.current += 1;
      openingRef.current = false;
      track();
      // openExternal, not window.open: on Capacitor that hands
      // the URL to the system browser, which has no IS session.
      void openExternal(n.link);
      onClose();
      return;
    }
    // `mapEventsLoaded` flips only on SUCCESS, so it is false both before the
    // feed lands and forever after a failed load. Waiting for it here — rather
    // than reading whatever happens to be in the store at tap time — is what
    // keeps this from being the very dead tap the fix removes, reachable
    // through a race. loadMapEvents is a no-op once loaded, and retries when
    // the previous attempt failed.
    if (openingRef.current) return;
    openingRef.current = true;
    const activation = (activationRef.current += 1);
    try {
      if (!mapEventsLoaded) await loadMapEvents();
      if (activationRef.current !== activation) return;
      if (!useAppStore.getState().mapEvents.some((e) => e.id === n.id)) return;
      track();
      focusEventById(n.id, { fly: true });
      setMobileTab('map');
      onClose();
    } finally {
      // Only if nothing superseded us — whoever did has already reopened the
      // gate for itself, and closing it again here would wedge the row shut.
      if (activationRef.current === activation) openingRef.current = false;
    }
  };

  return (
    <Sheet size="full" onClose={onClose}>
      <SheetHeader title={t('notifications.title')} onClose={onClose} />
      <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1">
        {alerts.length > 0 && (
          <>
            <SectionLabel>{t('notifications.sectionDeadlines')}</SectionLabel>
            <div className="flex flex-col gap-2">
              {alerts.map((alert) => (
                <DeadlineAlertItem key={alert.id} alert={alert} />
              ))}
            </div>
          </>
        )}
        {loading && !notifications.length ? (
          <div className="p-6 text-center text-base text-base-content/60">
            {t('notifications.loading')}
          </div>
        ) : !hasContent ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center text-base-content/60">
            <Bell size={40} className="opacity-40" />
            <p>{t('notifications.empty')}</p>
          </div>
        ) : notifications.length > 0 ? (
          <>
            {/* Labelled only when there is something above it to tell it apart
                from — a lone group under a header that already says "Novinky"
                would be labelling the sheet twice. */}
            {alerts.length > 0 && (
              <SectionLabel>{t('notifications.sectionSocieties')}</SectionLabel>
            )}
            <div className="flex flex-col gap-2">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onVisible={() => markVisible(n.id)}
                  onClick={() => void openNotification(n)}
                  clickable={opensSomewhere(n)}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}
