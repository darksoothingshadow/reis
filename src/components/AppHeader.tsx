import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SearchBar, type SearchResult } from './SearchBar';
import { NotificationFeed } from './NotificationFeed';

interface AppHeaderProps {
  currentView: string;
  dateRangeLabel: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onOpenExams: () => void;
  onSelectResult: (result: SearchResult) => void;
}

export function AppHeader({
  currentView,
  dateRangeLabel,
  onPrevWeek,
  onNextWeek,
  onToday,
  onOpenExams,
  onSelectResult
}: AppHeaderProps) {
  return (
    <div className="flex-shrink-0 z-30 bg-base-200/90 backdrop-blur-md border-b border-base-300 px-4 py-2">
      <div className="flex items-center justify-between gap-4 w-full">
        {currentView === 'calendar' && (
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center bg-base-300 rounded-lg p-1">
              <button onClick={onPrevWeek} className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary">
                <ChevronLeft size={20} />
              </button>
              <button onClick={onNextWeek} className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary">
                <ChevronRight size={20} />
              </button>
            </div>
            <button onClick={onToday} className="btn btn-primary btn-sm border-none shadow-sm">
              Dnes
            </button>
            <span className="text-lg font-semibold text-base-content whitespace-nowrap">{dateRangeLabel}</span>
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
          <NotificationFeed />
          <div className="w-[480px] mr-2">
            <SearchBar 
              onOpenExamDrawer={onOpenExams} 
              onSelect={onSelectResult}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
