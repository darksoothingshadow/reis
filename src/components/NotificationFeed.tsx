import { useState, useEffect } from 'react';
import { Bell, Users, Calendar, X } from 'lucide-react';
import type { SpolekNotification } from '../services/spolky';
import { fetchNotifications } from '../services/spolky';

interface NotificationFeedProps {
  className?: string;
}

export function NotificationFeed({ className = '' }: NotificationFeedProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SpolekNotification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications();
      setNotifications(data);
    } catch (error) {
      console.error('[NotificationFeed] Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const unreadCount = notifications.length; // For MVP, all are "unread"

  return (
    <div className={`relative ${className}`}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 hover:bg-base-300 rounded-lg transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-base-content/70" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-error-content text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Popover */}
          <div className="absolute right-0 top-12 z-50 w-96 bg-base-100 border border-base-300 rounded-lg shadow-xl max-h-[500px] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
              <h3 className="font-semibold text-base-content">Novinky</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-base-300 rounded"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-4 text-center text-base-content/60">
                  Načítá se...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-8 text-center text-base-content/60">
                  <Bell size={48} className="mx-auto mb-2 opacity-40" />
                  <p>Žádné nové novinky</p>
                </div>
              ) : (
                <div className="divide-y divide-base-300">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => {
                        if (notification.link) {
                          window.open(notification.link, '_blank');
                        }
                        setIsOpen(false);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface NotificationItemProps {
  notification: SpolekNotification;
  onClick: () => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const isSpolek = true; // All notifications are from spolky for now
  const Icon = isSpolek ? Users : Calendar;

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffHours < 24) {
      return 'Dnes';
    } else if (diffHours < 48) {
      return 'Včera';
    } else {
      return `${date.getDate()}.${date.getMonth() + 1}.`;
    }
  };

  return (
    <button
      onClick={onClick}
      className="w-full p-4 hover:bg-base-200 transition-colors text-left flex gap-3"
    >
      <div className="flex-shrink-0 mt-1">
        <Icon size={20} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-base-content line-clamp-1">
          {notification.title}
        </div>
        <div className="text-sm text-base-content/70 line-clamp-2 mt-1">
          {notification.body}
        </div>
        <div className="text-xs text-base-content/50 mt-2">
          {formatDate(notification.createdAt)}
        </div>
      </div>
    </button>
  );
}
