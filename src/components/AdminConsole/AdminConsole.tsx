import { useState } from 'react';
import { Toaster } from '../ui/sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { usePhoneViewport } from '../../hooks/ui/usePhoneViewport';
import { AdminConsoleHeader } from './AdminConsoleHeader';
import { AdminEventList } from './AdminEventList';
import { AdminConsoleMap } from './AdminConsoleMap';
import { AdminLoginScreen } from './AdminLoginScreen';
import { MobileAdminConsole } from './MobileAdminConsole';
import { SuggestionsInbox } from './SuggestionsInbox';
import { SocietyAccountsPanel } from './SocietyAccountsPanel';
import { ChangeMyPasswordForm } from './ChangeMyPasswordForm';
import { AdminStatsPanel } from './AdminStatsPanel';

/**
 * The admin surface, reached only through "Spravovat spolky" in the profile
 * popover. App.tsx returns this INSTEAD of the student shell, so the sidebar,
 * header, search and student views are not merely hidden — they are unmounted.
 * That is the whole point: the student and admin interfaces are separate
 * surfaces, not one surface with a tab swapped.
 *
 * Mounts its own Toaster. App.tsx's lives inside the desktop return and
 * MobileApp mounts a second one, so without this every save/delete
 * confirmation in the console would silently do nothing.
 */
export function AdminConsole() {
  const session = useAppStore((s) => s.adminSession);
  const isPhone = usePhoneViewport();
  // Student suggestions are a reIS-wide inbox, not a per-society one, so the
  // pane exists only for the reIS admin login. A society sees its events and
  // nothing else — it has no business reading another society's students.
  const isReisAdmin = useAppStore((s) => s.adminRole === 'reis_admin');
  const unread = useAppStore((s) => s.suggestionsUnread);
  const loadAdminStats = useAppStore((s) => s.loadAdminStats);
  const [pane, setPane] = useState<'events' | 'suggestions' | 'accounts' | 'stats'>(
    'events'
  );
  const { t } = useTranslation();

  if (!session) {
    return (
      <>
        <Toaster position="top-center" />
        <AdminLoginScreen />
      </>
    );
  }

  if (isPhone) {
    return (
      <>
        <Toaster position="top-center" />
        <MobileAdminConsole />
      </>
    );
  }

  return (
    <div
      data-testid="admin-console"
      className="flex h-screen w-full flex-col overflow-hidden bg-base-200 font-sans text-base-content"
    >
      <Toaster position="top-center" />
      <AdminConsoleHeader />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-96 shrink-0 flex-col border-r border-base-300 bg-base-100">
          <div role="tablist" className="tabs tabs-box tabs-sm m-1 mb-0 shrink-0 flex-nowrap">
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'events'}
              onClick={() => setPane('events')}
              className={`tab flex-1 ${pane === 'events' ? 'tab-active font-semibold' : 'text-base-content'}`}
            >
              {t('admin.listTab')}
            </button>
            {isReisAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={pane === 'suggestions'}
                onClick={() => setPane('suggestions')}
                className={`tab flex-1 gap-1 ${pane === 'suggestions' ? 'tab-active font-semibold' : 'text-base-content'}`}
              >
                {t('admin.suggestionsTab')}
                {unread > 0 && (
                  <span data-testid="suggestions-badge" className="badge badge-primary badge-xs">
                    {unread}
                  </span>
                )}
              </button>
            )}
            {isReisAdmin && (
              <button
                type="button"
                role="tab"
                aria-selected={pane === 'stats'}
                onClick={() => {
                  void loadAdminStats();
                  setPane('stats');
                }}
                className={`tab flex-1 ${pane === 'stats' ? 'tab-active font-semibold' : 'text-base-content'}`}
              >
                {t('admin.statsTab')}
              </button>
            )}
            <button
              type="button"
              role="tab"
              aria-selected={pane === 'accounts'}
              onClick={() => setPane('accounts')}
              className={`tab flex-1 ${pane === 'accounts' ? 'tab-active font-semibold' : 'text-base-content'}`}
            >
              {t('admin.accountsTab')}
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {isReisAdmin && pane === 'suggestions' && <SuggestionsInbox />}
            {isReisAdmin && pane === 'stats' && <AdminStatsPanel />}
            {pane === 'accounts' && (
              <div className="flex flex-col gap-6">
                {isReisAdmin && <SocietyAccountsPanel />}
                <ChangeMyPasswordForm />
              </div>
            )}
            {pane === 'events' && <AdminEventList />}
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <AdminConsoleMap />
        </div>
      </div>
    </div>
  );
}
