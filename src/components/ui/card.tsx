import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Home,
  User,
  GraduationCap,
  Settings,
  LogOut,
  ClipboardCheck,
  FileQuestion,
  BookOpen,
  Award,
  BookMarked,
  ClipboardList,
  Wifi,
  MessageSquare,
  Mail
} from 'lucide-react';

interface MenuItem {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  children?: { label: string; id: string; icon?: React.ReactNode }[];
  danger?: boolean;
  href?: string;
}

interface SidebarProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export function Sidebar({ isOpen: _isOpen, onToggle: _onToggle }: SidebarProps) {
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [popupItem, setPopupItem] = useState<string | null>(null);
  const [popupPosition, setPopupPosition] = useState<{ top: number; left: number } | null>(null);

  const buttonRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mainMenuItems: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Domů',
      shortLabel: 'Domů',
      icon: <Home className="w-5 h-5" />
    },
    {
      id: 'portal',
      label: 'Student',
      shortLabel: 'Student',
      icon: <User className="w-5 h-5" />,
      children: [
        { id: 'testy', label: 'Testy', icon: <FileQuestion className="w-4 h-4" /> },
        { id: 'zkousky', label: 'Zkoušky', icon: <ClipboardCheck className="w-4 h-4" /> },
        { id: 'cvicne-testy', label: 'Cvičné testy', icon: <FileQuestion className="w-4 h-4" /> },
        { id: 'zapisy-predmetu', label: 'Zápisy předmětů', icon: <BookOpen className="w-4 h-4" /> }
      ]
    },
    {
      id: 'o-studiu',
      label: 'Studium',
      shortLabel: 'Studium',
      icon: <GraduationCap className="w-5 h-5" />,
      children: [
        { id: 'hodnoceni-uspesnosti', label: 'Hodnocení úspěšnosti předmětů', icon: <Award className="w-4 h-4" /> },
        { id: 'studijni-plany', label: 'Studijní plány', icon: <BookMarked className="w-4 h-4" /> },
        { id: 'zadosti-formular', label: 'Žádosti a formuláře', icon: <ClipboardList className="w-4 h-4" /> },
        { id: 'wifi', label: 'Nastavení WiFi', icon: <Wifi className="w-4 h-4" /> }
      ]
    }
  ];

  const microsoftItems: MenuItem[] = [
    {
      id: 'teams',
      label: 'Teams',
      shortLabel: 'Teams',
      icon: <MessageSquare className="w-5 h-5" />,
      href: 'https://teams.microsoft.com'
    },
    {
      id: 'outlook',
      label: 'Outlook',
      shortLabel: 'Outlook',
      icon: <Mail className="w-5 h-5" />,
      href: 'https://outlook.office.com'
    }
  ];

  const settingsMenuItems: MenuItem[] = [
    {
      id: 'nastaveni',
      label: 'Nastavení',
      shortLabel: 'Nastavení',
      icon: <Settings className="w-5 h-5" />
    },
    {
      id: 'odhlaseni',
      label: 'Odhlášení',
      shortLabel: 'Odhlásit',
      icon: <LogOut className="w-5 h-5" />,
      danger: true
    }
  ];

  // --- Logic Handlers ---

  const openPopup = (item: MenuItem) => {
    // Clear any pending close actions
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

    setPopupItem(item.id);

    if (buttonRefs.current[item.id]) {
      const buttonRect = buttonRefs.current[item.id]!.getBoundingClientRect();
      setPopupPosition({
        top: buttonRect.top,
        left: buttonRect.right + 8 // 8px gap
      });
    }
  };

  const cancelClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleClose = () => {
    // Only schedule if not already scheduled
    if (!closeTimeoutRef.current) {
      closeTimeoutRef.current = setTimeout(() => {
        setPopupItem(null);
        setPopupPosition(null);
      }, 300); // 300ms grace period
    }
  };

  const handleItemClick = (item: MenuItem) => {
    if (item.children) {
      if (popupItem === item.id) {
        setPopupItem(null);
        setPopupPosition(null);
      } else {
        openPopup(item);
      }
    } else {
      setActiveItem(item.id);
      setPopupItem(null);
      setPopupPosition(null);
    }
  };

  const handleMouseEnter = (item: MenuItem) => {
    // 1. CRITICAL: Always cancel close first. 
    // This saves the popup if we move mouse from Popup -> Button
    cancelClose();

    if (item.children) {
      // If this specific popup is already open, do nothing
      if (popupItem === item.id) return;

      // If we are hovering a new item, clear previous open timer
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);

      // Wait a bit before opening (prevents flashing when scrubbing)
      hoverTimeoutRef.current = setTimeout(() => {
        openPopup(item);
      }, 200);
    } else {
      // If hovering an item without children, we might want to close existing popups
      // But strictly speaking, Slack keeps them open until you leave the sidebar area.
      // To keep it clean, we can close others if we hover a non-child item for a while:
      if (popupItem && popupItem !== item.id) {
        scheduleClose();
      }
    }
  };

  const handleMouseLeave = (item: MenuItem) => {
    // Clear the "Open" timer so it doesn't pop up if we just quickly brushed past
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }

    // Only schedule close if we are leaving the currently active popup trigger
    if (popupItem === item.id) {
      scheduleClose();
    }
  };

  // Popup specific handlers
  const handlePopupMouseEnter = () => {
    cancelClose();
  };

  const handlePopupMouseLeave = () => {
    scheduleClose();
  };

  const activeMenuData = mainMenuItems.find(item => item.id === popupItem);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <>
      {/* Sidebar - Increased Z-Index to [120] to sit ABOVE the backdrop */}
      <aside className="fixed left-0 top-0 w-25 bg-[#3F0E40] flex flex-col h-screen z-[120] border-r border-[#522653]">
        {/* Main navigation icons */}
        <nav className="flex-1 flex flex-col items-center py-4 gap-1 overflow-y-auto scrollbar-hide">
          {mainMenuItems.map(item => (
            <button
              key={item.id}
              ref={el => (buttonRefs.current[item.id] = el as any)}
              onClick={() => handleItemClick(item)}
              className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center transition-all relative group ${activeItem === item.id || popupItem === item.id
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
              onMouseEnter={() => handleMouseEnter(item)}
              onMouseLeave={() => handleMouseLeave(item)}
            >
              {item.icon}
              <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
            </button>
          ))}

          <div className="w-12 h-px bg-white/10 my-2" />

          {/* Microsoft Apps */}
          {microsoftItems.map(item => (
            <a
              key={item.id}
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center transition-all ${activeItem === item.id
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
            </a>
          ))}
        </nav>

        {/* Settings icons at bottom */}
        <nav className="flex flex-col items-center pb-4 gap-1 border-t border-white/10 pt-4">
          {settingsMenuItems.map(item => (
            <button
              key={item.id}
              onClick={() => handleItemClick(item)}
              className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center transition-all ${item.danger
                ? 'text-red-400 hover:bg-red-500/10'
                : activeItem === item.id
                  ? 'bg-white/10 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
                }`}
            >
              {item.icon}
              <span className="text-[10px] mt-1 text-center leading-tight">{item.shortLabel}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* Popup rendered outside sidebar */}
      <AnimatePresence>
        {popupItem && activeMenuData && activeMenuData.children && popupPosition && (
          <>
            {/* Backdrop - Z-Index [100] (Lower than Sidebar [120] but higher than content) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 bg-black/10 z-[100]"
              onClick={() => {
                setPopupItem(null);
                setPopupPosition(null);
              }}
            />

            {/* Popup Menu - Z-Index [130] (Highest) */}
            <motion.div
              initial={{ opacity: 0, x: -10, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: popupPosition.top,
                left: popupPosition.left
              }}
              className="bg-white rounded-lg shadow-xl border border-gray-200 min-w-[240px] z-[130]"
              onMouseEnter={handlePopupMouseEnter}
              onMouseLeave={handlePopupMouseLeave}
            >
              {/* --- INVISIBLE BRIDGE --- 
                  This fills the 8px gap to the left of the popup.
                  It ensures the mouse doesn't 'leave' when moving from button to popup. 
              */}
              <div
                className="absolute -left-4 top-0 bottom-0 w-6 bg-transparent"
                style={{ content: '""' }}
              />

              <div className="px-4 py-3 border-b border-gray-100">
                <span className="text-sm text-gray-900">{activeMenuData.label}</span>
              </div>
              <div className="py-1">
                {activeMenuData.children.map(child => (
                  <button
                    key={child.id}
                    onClick={() => {
                      setActiveItem(child.id);
                      setPopupItem(null);
                      setPopupPosition(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${activeItem === child.id
                      ? 'bg-[#8DC843]/10 text-[#8DC843]'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {child.icon && (
                      <span className={activeItem === child.id ? 'text-[#8DC843]' : 'text-gray-500'}>
                        {child.icon}
                      </span>
                    )}
                    <span className="text-sm">{child.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}