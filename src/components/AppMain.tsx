import type { AppView } from '../types/app';
import { AppHeader } from './AppHeader';
import { WeeklyCalendar } from './WeeklyCalendar/index';
import { ExamPanel } from './ExamPanel';
import { SubjectsPanel } from './SubjectsPanel';
import { StudyPlanPage } from './SubjectsPanel/StudyPlanPage';
import { ErasmusPanel } from './ErasmusPanel';
import { CampusMapView } from './CampusMap/CampusMapView';
import { NpsBanner } from './Feedback/NpsBanner';

interface AppMainProps {
  currentView: AppView;
  currentDate: Date;
  handlePrevWeek: () => void;
  handleNextWeek: () => void;
  handleToday: () => void;
  handleOpenSubjectFromSearch: (
    courseCode: string,
    courseName?: string,
    courseId?: string,
    facultyCode?: string,
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates',
    isFulfilled?: boolean
  ) => void;
  dateRangeLabel: string;
  searchPrefillRef?: React.MutableRefObject<((query: string) => void) | null>;
  setCurrentView?: (view: AppView) => void;
}

export function AppMain({
  currentView,
  currentDate,
  handlePrevWeek,
  handleNextWeek,
  handleToday,
  handleOpenSubjectFromSearch,
  dateRangeLabel,
  searchPrefillRef,
  setCurrentView,
}: AppMainProps) {
  return (
    <main className="flex-1 flex flex-col transition-all duration-300 overflow-hidden">
      <AppHeader
        currentView={currentView}
        currentDate={currentDate}
        dateRangeLabel={dateRangeLabel}
        onPrevWeek={handlePrevWeek}
        onNextWeek={handleNextWeek}
        onToday={handleToday}
        onOpenSubject={handleOpenSubjectFromSearch}
        searchPrefillRef={searchPrefillRef}
      />
      <NpsBanner />
      <div className="flex-1 pt-3 px-4 pb-1 overflow-hidden flex flex-col">
        <div className="flex-1 bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
          {currentView === 'calendar' && (
            <WeeklyCalendar
              key={currentDate.toISOString()}
              initialDate={currentDate}
              onPrevWeek={handlePrevWeek}
              onNextWeek={handleNextWeek}
            />
          )}
          {currentView === 'exams' && <ExamPanel />}
          {currentView === 'subjects' && (
            <SubjectsPanel
              onOpenSubject={handleOpenSubjectFromSearch}
              onSearchSubject={(name) => searchPrefillRef?.current?.(name)}
              onOpenStudyPlan={() => setCurrentView?.('studyPlan')}
            />
          )}
          {currentView === 'studyPlan' && (
            <StudyPlanPage
              onBack={() => setCurrentView?.('subjects')}
              onOpenSubject={handleOpenSubjectFromSearch}
            />
          )}
          {currentView === 'erasmus' && (
            <ErasmusPanel
              onOpenSubject={handleOpenSubjectFromSearch}
              onSearchSubject={(name) => searchPrefillRef?.current?.(name)}
            />
          )}
          {currentView === 'map' && <CampusMapView />}
        </div>
      </div>
    </main>
  );
}
