import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../../types/app';
import { useAppStore } from '../../store/useAppStore';
import {
  IsSearchTriggers,
  IsSearchPopovers,
  type IsSearchTarget,
} from '../SearchBar/IsSearchTriggers';

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onViewChange: (view: AppView) => void;
  onOpenSubject?: (courseCode: string, courseName?: string, courseId?: string) => void;
}

export function NavItem({
  item,
  isActive,
  isHovered,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onViewChange,
  onOpenSubject,
}: NavItemProps) {
  const [isSearchOpen, setIsSearchOpen] = useState<IsSearchTarget>(null);
  const setIsEduroamOpen = useAppStore((s) => s.setIsEduroamOpen);
  const setIsDocumentsOpen = useAppStore((s) => s.setIsDocumentsOpen);

  return (
    <div className="relative group" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        onClick={onClick}
        className={`relative w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
          ${
            isActive
              ? 'bg-primary/10 text-primary shadow-sm'
              : // /50 put these 10px labels at 2.02:1 in the light theme — the app's
                // primary navigation, below AA on every screen. /70 clears 4.5:1 in
                // both themes and still reads as "not the active one".
                'text-base-content/70 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
          }`}
      >
        {item.href && !item.expandable && item.id !== 'dashboard' && (
          <ExternalLink className="absolute top-1 right-1 w-2.5 h-2.5 text-base-content/30" />
        )}
        <div className="relative flex items-center justify-center">
          {item.icon}
          {item.badge !== undefined && (
            <span
              className={`absolute -top-2 -right-3 font-bold px-1 rounded text-[10px] leading-[14px] shadow-sm transition-all duration-300
              ${
                item.badge > 0
                  ? 'bg-neutral text-neutral-content scale-110 shadow-neutral/20'
                  : 'bg-base-content/10 text-base-content/70'
              }`}
            >
              {item.badge}
            </span>
          )}
        </div>
        {/* The label is base-content even when active. MENDELU green (#79be15)
            is a pale colour: as text it is 2.02:1 on the light theme's tint and
            2.2:1 on a solid primary fill — the ACTIVE item was the least
            readable thing in the whole rail. The green stays as the pill and
            the icon, where it is a cue rather than the only way to read the
            word. */}
        <span
          className={`text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight ${
            isActive ? 'text-base-content' : ''
          }`}
        >
          {item.label}
        </span>
      </button>

      {/* Popup Menu for expandable items */}
      <AnimatePresence>
        {isHovered && item.expandable && (
          <motion.div
            initial={{ opacity: 0, x: 10, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`absolute left-14 -top-4 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-2 z-50 ${
              item.id === 'subjects' && item.children && item.children.length > 4
                ? 'w-[500px] max-w-[calc(100vw-5rem)]'
                : 'w-64 max-w-[calc(100vw-5rem)]'
            }`}
          >
            <div
              className={`gap-0.5 ${
                item.id === 'subjects' && item.children && item.children.length > 4
                  ? 'grid grid-cols-2'
                  : 'flex flex-col'
              }`}
            >
              {!item.children || item.children.length === 0
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-2">
                      <div className="skeleton w-4 h-4 rounded" />
                      <div className="skeleton h-3 rounded flex-1" />
                    </div>
                  ))
                : item.children.map((child) => (
                    <a
                      key={child.id}
                      href={child.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => {
                        if (child.id === 'zapisy-zkousky') {
                          e.preventDefault();
                          onViewChange('exams');
                        } else if (child.id === 'studijni-plany') {
                          e.preventDefault();
                          onViewChange('subjects');
                        } else if (child.isSubject && child.courseCode) {
                          e.preventDefault();
                          onOpenSubject?.(child.courseCode, child.label, child.subjectId);
                        } else if (child.id === 'eduroam') {
                          e.preventDefault();
                          setIsEduroamOpen(true);
                        } else if (child.id === 'dokumenty') {
                          e.preventDefault();
                          setIsDocumentsOpen(true);
                        } else if (child.isFeature) {
                          e.preventDefault();
                        }
                      }}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-base-content/70 hover:bg-base-200 hover:text-primary transition-colors group/item cursor-pointer"
                    >
                      <span className="text-base-content/50 group-hover/item:text-primary transition-colors">
                        {child.icon || <ChevronRight className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 flex flex-col min-w-0">
                        <span className="font-medium truncate">{child.label}</span>
                        {child.subtitle && (
                          <span className="text-[10px] text-base-content/40 truncate">
                            {child.subtitle}
                          </span>
                        )}
                      </div>
                      {!child.isFeature && !child.isSubject && (
                        <ExternalLink className="w-3 h-3 text-base-content/30 group-hover/item:text-base-content/50" />
                      )}
                    </a>
                  ))}
            </div>

            {item.id === 'is' && (
              <IsSearchTriggers
                onOpen={setIsSearchOpen}
                buttonClassName="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-base-content/40 hover:bg-base-200 hover:text-primary transition-colors relative"
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <IsSearchPopovers open={isSearchOpen} onClose={() => setIsSearchOpen(null)} />
    </div>
  );
}
