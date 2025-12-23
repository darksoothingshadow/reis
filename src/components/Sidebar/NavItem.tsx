import { motion, AnimatePresence } from 'motion/react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import type { MenuItem } from '../menuConfig';
import type { AppView } from '../Sidebar';

interface NavItemProps {
  item: MenuItem;
  isActive: boolean;
  isHovered: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onViewChange: (view: AppView) => void;
}

export function NavItem({ item, isActive, isHovered, onMouseEnter, onMouseLeave, onClick, onViewChange }: NavItemProps) {
  return (
    <div
      className="relative group"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        onClick={onClick}
        className={`w-14 h-auto min-h-[56px] py-2 rounded-xl flex flex-col items-center justify-center transition-all duration-200 mx-auto
          ${isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-base-content/50 hover:bg-base-100 hover:text-base-content hover:shadow-sm'
          }`}
      >
        {item.icon}
        <span className="text-[10px] mt-1 font-medium w-full text-center px-1 leading-tight">
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
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    if (child.id === 'zapisy-zkousky') {
                      e.preventDefault();
                      onViewChange('exams');
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
  );
}
