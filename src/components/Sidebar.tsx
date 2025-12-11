import { useState, useRef } from 'react';
import {
  ChevronRight,
  LayoutGrid,
  Mail,
  Settings,
  ExternalLink,
  Calendar,
  Moon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MENDELU_LOGO_PATH } from '../constants/icons';
import { useUserParams } from '../hooks/useUserParams';
import { getMainMenuItems, type MenuItem } from './menuConfig';
import { useOutlookSync } from '../hooks/data';
import { useTheme } from '../hooks/useTheme';


interface SidebarProps {
  onOpenExamDrawer?: () => void;
}

export const Sidebar = ({ onOpenExamDrawer }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [profilHovered, setProfilHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Outlook sync hook
  const { isEnabled: outlookSyncEnabled, isLoading: outlookSyncLoading, toggle: toggleOutlookSync } = useOutlookSync();

  // Google Drive sync - DORMANT (code preserved for future use)
  // const { isEnabled: driveSyncEnabled, isLoading: driveSyncLoading, toggle: toggleDriveSync } = useDriveSync();

  // Theme toggle
  const { isDark, isLoading: themeLoading, toggle: toggleTheme } = useTheme();


  const { params } = useUserParams();
  const studiumId = params?.studium || '';
  const obdobiId = params?.obdobi || '';

  // Menu configuration
  const mainMenuItems: MenuItem[] = getMainMenuItems(studiumId, obdobiId);

  const handleMouseEnter = (itemId: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setHoveredItem(itemId);
  };

  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setHoveredItem(null);
    }, 300);
  };

  const handleItemClick = (item: MenuItem) => {
    setActiveItem(item.id);
    if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-22 h-screen bg-base-200 border-r border-base-300 fixed left-0 top-0 z-40 items-center py-6">
        {/* Logo */}
        <div className="mb-8 w-10 h-10 rounded-xl bg-base-100 shadow-sm flex items-center justify-center overflow-hidden">
          <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col w-full px-2 gap-2">
          {mainMenuItems.map((item) => (
            <div
              key={item.id}
              className="relative group"
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                onClick={() => handleItemClick(item)}
                className={`w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
                                    ${activeItem === item.id
                    ? 'bg-primary/10 text-primary shadow-sm'
                    : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
                  }`}
              >
                {item.icon}
                <span className="text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight">
                  {item.label}
                </span>
              </button>

              {/* Popup Menu */}
              <AnimatePresence>
                {hoveredItem === item.id && item.expandable && (
                  <motion.div
                    initial={{ opacity: 0, x: 10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="absolute left-14 -top-4 w-64 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-2 z-50"
                  >
                    <div className="px-3 py-2 border-b border-base-200 mb-1">
                      <h3 className="font-semibold text-base-content">{item.label}</h3>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      {item.children?.map((child) => (
                        <a
                          key={child.id}
                          href={child.href}
                          onClick={(e) => {
                            if (child.id === 'zapisy-zkousky') {
                              e.preventDefault();
                              onOpenExamDrawer?.();
                            }
                          }}
                          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-primary transition-colors group/item cursor-pointer"
                        >
                          <span className="text-base-content/50 group-hover/item:text-primary transition-colors">
                            {child.icon || <ChevronRight className="w-4 h-4" />}
                          </span>
                          <span className="flex-1">{child.label}</span>
                          {!child.isFeature && (
                            <ExternalLink className="w-3 h-3 text-base-content/30 group-hover/item:text-base-content/50" />
                          )}
                        </a>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 px-2 w-full mt-auto">
          <a href="https://teams.microsoft.com" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-info hover:shadow-sm transition-all mx-auto group">
            <LayoutGrid className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Teams</span>
          </a>
          <a href="https://outlook.office.com" target="_blank" rel="noopener noreferrer" className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-info hover:shadow-sm transition-all mx-auto group">
            <Mail className="w-5 h-5 group-hover:scale-110 transition-transform" />
            <span className="text-[10px] mt-1 font-medium">Outlook</span>
          </a>
          {/* Profil with popup */}
          <div
            className="relative"
            onMouseEnter={() => {
              if (profilTimeoutRef.current) clearTimeout(profilTimeoutRef.current);
              setProfilHovered(true);
            }}
            onMouseLeave={() => {
              profilTimeoutRef.current = setTimeout(() => setProfilHovered(false), 300);
            }}
          >
            <button className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm transition-all mx-auto">
              <Settings className="w-5 h-5" />
              <span className="text-[10px] mt-1 font-medium">Profil</span>
            </button>

            {/* Profil Popup */}
            <AnimatePresence>
              {profilHovered && (
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

                  {/* Google Drive Sync Toggle - DORMANT (code preserved for future use)
                  <label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 flex-1">
                      <HardDrive className="w-4 h-4 text-base-content/50 shrink-0" />
                      <span className="text-xs text-base-content/70">Synchronizace souborů do Google Drive (beta)</span>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={driveSyncEnabled}
                      disabled={driveSyncLoading}
                      onChange={() => toggleDriveSync()}
                    />
                  </label>
                  */}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </aside>
    </>
  );
};