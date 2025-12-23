import { Clock, FileText, BookOpen, GraduationCap, Briefcase } from 'lucide-react';
import type { SearchResult } from '../../hooks/ui/useSearch';

interface SearchResultItemProps {
  result: SearchResult;
  isRecent: boolean;
  isSelected: boolean;
  onMouseEnter: () => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function SearchResultItem({ result, isRecent, isSelected, onMouseEnter, onMouseDown, onClick }: SearchResultItemProps & { onClick?: (e: React.MouseEvent) => void }) {
  const Component = result.link ? 'a' : 'div';
  const props = result.link ? { href: result.link, target: '_blank', rel: 'noopener noreferrer' } : {};

  return (
    <Component
      {...props}
      role="option"
      data-testid="search-result-item"
      aria-selected={isSelected}
      onMouseEnter={onMouseEnter}
      onMouseDown={onMouseDown}
      onClick={onClick}
      className={`w-full px-4 py-2.5 flex items-center gap-3 cursor-pointer transition-colors text-left block no-underline ${isSelected ? 'bg-primary/10' : 'hover:bg-base-200'}`}
    >
      <div className="flex-shrink-0">
        {isRecent ? (
          <Clock className="w-4 h-4 text-base-content/40" />
        ) : result.type === 'page' ? (
          <div className="w-6 h-6 rounded bg-success/20 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-success" />
          </div>
        ) : result.type === 'subject' ? (
          <div className="w-6 h-6 rounded bg-primary/20 flex items-center justify-center">
            <BookOpen className="w-3.5 h-3.5 text-primary" />
          </div>
        ) : result.personType === 'student' ? (
          <div className="w-6 h-6 rounded-full bg-info/20 flex items-center justify-center">
            <GraduationCap className="w-3.5 h-3.5 text-info" />
          </div>
        ) : result.personType === 'teacher' ? (
          <div className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center">
            <Briefcase className="w-3.5 h-3.5 text-secondary" />
          </div>
        ) : result.personType === 'staff' ? (
          <div className="w-6 h-6 rounded-full bg-base-200 flex items-center justify-center">
            <Briefcase className="w-3.5 h-3.5 text-base-content/60" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded bg-base-200 flex items-center justify-center">
            <FileText className="w-3.5 h-3.5 text-base-content/60" />
          </div>
        )}
      </div>
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm text-base-content truncate">
            {result.title}
          </span>
          {!isRecent && (
            <>
              <span className="text-base-content/40 flex-shrink-0">•</span>
              <span className="text-xs text-base-content/50 flex-shrink-0">
                {result.detail}
              </span>
            </>
          )}
        </div>
      </div>
    </Component>
  );
}
