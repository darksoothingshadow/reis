import { useState, useRef } from 'react';
import { ReisLogo } from './ReisLogo';
import type { AppView } from '../types/app';
import { NavItem } from './Sidebar/NavItem';
import { BottomActions } from './Sidebar/BottomActions';
import { useMenuItems } from '../hooks/ui/useMenuItems';
import type { MenuItem } from './menuConfig';

interface SidebarProps {
  currentView: AppView;
  onViewChange: (v: AppView) => void;
  onOpenFeedback?: () => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
  items?: MenuItem[];
}

export const Sidebar = ({
  currentView,
  onViewChange,
  onOpenFeedback,
  onOpenSubject,
  items,
}: SidebarProps) => {
  const [hovered, setHovered] = useState<string | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hookItems = useMenuItems();
  const menuItems = items || hookItems;

  const handleEnter = (id: string) => {
    if (timeout.current) clearTimeout(timeout.current);
    setHovered(id);
  };
  const handleLeave = () => {
    timeout.current = setTimeout(() => setHovered(null), 300);
  };

  const isItemActive = (id: string) => {
    if (currentView === 'calendar' && id === 'dashboard') return true;
    if (currentView === 'studyPlan' && id === 'subjects') return true;
    return currentView === id;
  };

  return (
    <aside className="flex touch:hidden flex-col w-20 h-screen bg-base-200 border-r border-base-300 items-center py-6 shrink-0 relative z-40">
      <button
        onClick={() => onViewChange('calendar')}
        className="mb-8 w-10 h-10 rounded-xl overflow-hidden hover:opacity-80 transition-opacity flex items-center justify-center"
      >
        <ReisLogo className="w-full h-full" />
      </button>
      <div className="flex flex-col gap-3 w-full px-2">
        {menuItems.map((item) => {
          if (item.type === 'divider') {
            return (
              // bg-base-300 on base-200 is 1.006:1 in the dark theme — the
              // divider was simply not there. A base-content tint reads on both.
              <div key={item.id} className="h-px bg-base-content/10 w-full my-1" />
            );
          }
          if (item.type === 'header') {
            return (
              <div
                key={item.id}
                className="mt-4 mb-1 text-[10px] font-bold uppercase tracking-wider text-base-content/30 w-full text-center px-1 truncate"
              >
                {item.label}
              </div>
            );
          }
          return (
            <NavItem
              key={item.id}
              item={item}
              isActive={isItemActive(item.id)}
              isHovered={hovered === item.id}
              onMouseEnter={() => handleEnter(item.id)}
              onMouseLeave={handleLeave}
              onClick={() => {
                if (item.id === 'dashboard') onViewChange('calendar');
                else if (item.id === 'exams') onViewChange('exams');
                else if (item.id === 'subjects') onViewChange('subjects');
                else if (item.id === 'erasmus') onViewChange('erasmus');
                else if (item.id === 'map') onViewChange('map');
                else if (item.href) window.open(item.href, '_blank');
              }}
              onViewChange={onViewChange}
              onOpenSubject={onOpenSubject}
            />
          );
        })}
      </div>
      <div className="flex-1" />
      <BottomActions onOpenFeedback={onOpenFeedback} />
    </aside>
  );
};
