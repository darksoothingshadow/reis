import { useState, useRef, useEffect } from 'react';
import {
  LayoutGrid,
  Mail,
  Settings,
  CalendarCheck,
  Users
} from 'lucide-react';
import { MENDELU_LOGO_PATH } from '../constants/icons';
import { useUserParams } from '../hooks/useUserParams';
import { getFacultySync } from '../utils/userParams';
import { getMainMenuItems, type MenuItem } from './menuConfig';
import { getUserAssociation } from '../services/spolky';
import { NavItem } from './Sidebar/NavItem';
import { ProfilePopup } from './Sidebar/ProfilePopup';

export type AppView = 'calendar' | 'exams';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (view: AppView) => void;
  /** Ref that will be populated with a function to open settings popup */
  onOpenSettingsRef?: React.MutableRefObject<(() => void) | null>;
}

export const Sidebar = ({ onViewChange, onOpenSettingsRef }: SidebarProps) => {
  const [activeItem, setActiveItem] = useState<string>('dashboard');
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [profilHovered, setProfilHovered] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profilTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Expose function to open settings popup and listen for custom events
  useEffect(() => {
    const handleOpenSettings = () => {
      setProfilHovered(true);
      // Auto-close after 5 seconds if no interaction
      if (profilTimeoutRef.current) clearTimeout(profilTimeoutRef.current);
      profilTimeoutRef.current = setTimeout(() => setProfilHovered(false), 5000);
    };

    if (onOpenSettingsRef) {
      onOpenSettingsRef.current = handleOpenSettings;
    }

    document.addEventListener('reis-open-settings', handleOpenSettings);
    
    return () => {
      if (onOpenSettingsRef) {
        onOpenSettingsRef.current = null;
      }
      document.removeEventListener('reis-open-settings', handleOpenSettings);
    };
  }, [onOpenSettingsRef]);

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
    // Handle view switching for home (dashboard)
    if (item.id === 'dashboard') {
      onViewChange('calendar');
      return;
    }
    if (item.href) {
      window.location.href = item.href;
    }
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-22 h-screen bg-base-200 border-r border-base-300 fixed left-0 top-0 z-40 items-center py-6">
        {/* Logo - click to return to calendar */}
        <div 
          onClick={() => onViewChange('calendar')}
          className="mb-8 w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center overflow-hidden cursor-pointer hover:shadow-md transition-shadow border border-base-300/50"
          title="Zpět na rozvrh"
        >
          <img src={MENDELU_LOGO_PATH} alt="Mendelu Logo" className="w-8 h-8 object-contain" />
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 flex flex-col w-full px-2 gap-2">
          {/* Domů - Dashboard */}
          <NavItem
            item={mainMenuItems.find(i => i.id === 'dashboard')!}
            isActive={activeItem === 'dashboard'}
            isHovered={hoveredItem === 'dashboard'}
            onMouseEnter={() => handleMouseEnter('dashboard')}
            onMouseLeave={handleMouseLeave}
            onClick={() => {
              setActiveItem('dashboard');
              onViewChange('calendar');
            }}
            onViewChange={onViewChange}
          />

          {/* Divider */}
          <div className="h-px bg-base-300 mx-2 my-1" />

          {/* Zkousky - Own Section */}
          <NavItem
            item={{
              id: 'zkousky',
              label: 'Zkoušky',
              icon: <CalendarCheck className="w-5 h-5" />,
              expandable: false
            }}
            isActive={activeItem === 'zkousky'}
            isHovered={hoveredItem === 'zkousky'}
            onMouseEnter={() => handleMouseEnter('zkousky')}
            onMouseLeave={handleMouseLeave}
            onClick={() => {
              setActiveItem('zkousky');
              onViewChange('exams');
            }}
            onViewChange={onViewChange}
          />

          {/* Divider */}
          <div className="h-px bg-base-300 mx-2 my-1" />

          {/* Other Menu Items (excluding dashboard) */}
          {mainMenuItems.filter(item => item.id !== 'dashboard').map((item) => (
            <NavItem
              key={item.id}
              item={item}
              isActive={activeItem === item.id}
              isHovered={hoveredItem === item.id}
              onMouseEnter={() => handleMouseEnter(item.id)}
              onMouseLeave={handleMouseLeave}
              onClick={() => handleItemClick(item)}
              onViewChange={onViewChange}
            />
          ))}
        </nav>

        {/* Bottom Actions */}
        <div className="flex flex-col gap-2 px-2 w-full mt-auto">
          {/* Spolek Button - Dynamic based on faculty */}
          {(() => {
            const facultyId = getFacultySync() || '2';
            const association = getUserAssociation(facultyId);
            if (!association) return null;
            
            return (
              <a 
                href={association.websiteUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-base-content/50 hover:bg-base-100 hover:text-primary hover:shadow-sm transition-all mx-auto group"
                title={association.name}
              >
                <Users className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] mt-1 font-medium">Spolek</span>
              </a>
            );
          })()}
          
          {/* Divider */}
          <div className="h-px bg-base-300 mx-2 my-1" />
          
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
            <ProfilePopup isOpen={profilHovered} />
          </div>

          {/* Divider */}
          <div className="h-px bg-base-300 mx-2 my-1" />

          {/* Legacy IS Link */}
          <a
            href="https://is.mendelu.cz/auth/?lang=cz"
            className="w-12 h-12 rounded-xl flex flex-col items-center justify-center text-base-content/30 hover:bg-error/10 hover:text-error hover:shadow-sm transition-all mx-auto group"
            title="Přejít do starého IS"
          >
            <span className="text-[10px] font-bold">Starý</span>
            <span className="text-[10px] font-bold">IS</span>
          </a>
        </div>
      </aside>
    </>
  );
};