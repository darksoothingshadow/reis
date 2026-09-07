import { Bell, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { NotificationItem } from './NotificationItem';
import { openExternal } from '../../mobile/openExternal';
import { DeadlineAlertItem } from './DeadlineAlertItem';
import { trackNotificationClick } from '../../services/spolky';
import { useTranslation } from '../../hooks/useTranslation';
import type { SpolekNotification } from '../../services/spolky';
import type { DeadlineAlert } from '../../hooks/useDeadlineAlerts';
import { useIsMobile } from '../../hooks/ui/useIsMobile';

interface NotificationDropdownProps {
  notifications: SpolekNotification[];
  loading: boolean;
  onClose: () => void;
  onVisible: (id: string) => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  deadlineAlerts: DeadlineAlert[];
}

export function NotificationDropdown({
  notifications,
  loading,
  onClose,
  onVisible,
  dropdownRef,
  deadlineAlerts,
}: NotificationDropdownProps) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const hasContent = notifications.length > 0 || deadlineAlerts.length > 0;

  // Cards in a gapped column, not `divide-y` rows: the two row components are
  // now self-contained `ExamRowCard`-style cards (see NotificationItem), and a
  // divider between two bordered cards draws a third line between them.
  const notificationList = (
    <div className="flex flex-col gap-2 p-3">
      {deadlineAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {deadlineAlerts.map((alert) => (
            <DeadlineAlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      )}
      {loading && !notifications.length ? (
        <div className="p-4 text-center text-base-content/60">{t('notifications.loading')}</div>
      ) : !hasContent ? (
        <div className="p-8 text-center text-base-content/60">
          <Bell size={48} className="mx-auto mb-2 opacity-40" />
          <p>{t('notifications.empty')}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onVisible={() => onVisible(n.id)}
              onClick={() => {
                if (n.link) {
                  if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
                  // openExternal, not window.open: this dropdown portals to a
                  // full-screen mobile surface too, and on Capacitor
                  // window.open hands the URL to the system browser. It also
                  // validates the link — a notification's URL is data from
                  // outside the app — and adds noopener,noreferrer elsewhere.
                  void openExternal(n.link);
                  onClose();
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed inset-0 z-50 bg-base-100 flex flex-col"
        // Full-screen and top-anchored: at targetSdk 36 the WebView draws under
        // the status bar and camera cutout, so this surface must inset itself.
        // --safe-top is 0 off-device, making this a no-op on desktop.
        style={{ paddingTop: 'var(--safe-top, 0px)' }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
          <h3 className="font-semibold text-lg text-base-content">{t('notifications.title')}</h3>
          <button onClick={onClose} className="p-1 hover:bg-base-300 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{notificationList}</div>
      </div>,
      document.body
    );
  }

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[320px] overflow-hidden flex flex-col"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
        <h3 className="font-semibold text-lg text-base-content">{t('notifications.title')}</h3>
        <button onClick={onClose} className="p-1 hover:bg-base-300 rounded">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">{notificationList}</div>
    </div>
  );
}
