import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Moon } from 'lucide-react';
import { useOutlookSync } from '../../hooks/data';
import { useTheme } from '../../hooks/useTheme';

interface ProfilePopupProps {
  isOpen: boolean;
}

export function ProfilePopup({ isOpen }: ProfilePopupProps) {
  const { isEnabled: outlookSyncEnabled, isLoading: outlookSyncLoading, toggle: toggleOutlookSync } = useOutlookSync();
  const { isDark, isLoading: themeLoading, toggle: toggleTheme } = useTheme();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: 10, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="absolute left-14 bottom-0 w-72 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-3 z-50"
        >
          <div className="px-1 py-1 border-b border-base-200 mb-3">
            <h3 className="font-semibold text-base-content">Nastavení</h3>
          </div>

          {/* Outlook Sync Toggle */}
          <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg transition-colors">
            <div className="flex items-center gap-2 flex-1">
              <Calendar className="w-4 h-4 text-base-content/50 shrink-0" />
              <span className="text-xs text-base-content/70">Synchronizace rozvrhu do Outlooku</span>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={outlookSyncEnabled ?? false}
              disabled={outlookSyncLoading || outlookSyncEnabled === null}
              onChange={() => toggleOutlookSync()}
            />
          </label>

          {/* Dark Theme Toggle */}
          <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg transition-colors">
            <div className="flex items-center gap-2 flex-1">
              <Moon className="w-4 h-4 text-base-content/50 shrink-0" />
              <span className="text-xs text-base-content/70">Tmavý režim</span>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary toggle-sm"
              checked={isDark}
              disabled={themeLoading}
              onChange={() => toggleTheme()}
            />
          </label>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
