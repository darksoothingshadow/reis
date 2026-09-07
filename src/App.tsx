import { Sidebar } from './components/Sidebar';
import { Toaster } from './components/ui/sonner';
import { getSmartWeekRange } from '@/utils/calendar';
import { useAppLogic } from './hooks/useAppLogic';
import { AppMain } from './components/AppMain';
import { AppOverlays } from './components/AppOverlays';
import { MobileApp } from './components/mobile/MobileApp';
import { AdminConsole } from './components/AdminConsole/AdminConsole';
import { usePhoneViewport } from './hooks/ui/usePhoneViewport';
import { useAppStore } from './store/useAppStore';

function App() {
  const s = useAppLogic();
  const isPhone = usePhoneViewport();
  const adminConsoleOpen = useAppStore((state) => state.adminConsoleOpen);

  const handlePrevWeek = () => {
    s.setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
    s.setWeekNavCount((p) => p + 1);
  };
  const handleNextWeek = () => {
    s.setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
    s.setWeekNavCount((p) => p + 1);
  };
  const handleToday = () => s.setCurrentDate(getSmartWeekRange().start);

  const getDateRangeLabel = () => {
    const end = new Date(s.currentDate);
    end.setDate(s.currentDate.getDate() + 6);
    return s.currentDate.getMonth() === end.getMonth()
      ? `${s.currentDate.getDate()}. - ${end.getDate()}.${s.currentDate.getMonth() + 1}.`
      : `${s.currentDate.getDate()}.${s.currentDate.getMonth() + 1}. - ${end.getDate()}.${end.getMonth() + 1}.`;
  };

  // The admin console replaces the whole student app, phone shell included, so
  // this branch sits above the phone one and covers both. useAppLogic() has
  // already run — it owns IDB hydration and the REIS_READY handshake — so
  // leaving for the console and coming back does not re-bootstrap anything.
  if (adminConsoleOpen) return <AdminConsole />;

  if (isPhone) return <MobileApp />;

  return (
    // data-testid is what `verify:ui --expect-shell` reads. The dev webapp
    // renders whichever shell the viewport asks for, so a desktop run at a
    // phone width silently measures MobileApp instead — a clean report about a
    // screen that was never on screen.
    <div
      data-testid="desktop-app"
      className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content"
    >
      <Toaster position="top-center" />
      <Sidebar
        currentView={s.currentView}
        onViewChange={s.setCurrentView}
        onOpenFeedback={() => s.setIsFeedbackOpen(true)}
        onOpenSubject={s.handleOpenSubjectFromSearch}
      />

      <AppMain
        currentView={s.currentView}
        currentDate={s.currentDate}
        dateRangeLabel={getDateRangeLabel()}
        handlePrevWeek={handlePrevWeek}
        handleNextWeek={handleNextWeek}
        handleToday={handleToday}
        handleOpenSubjectFromSearch={s.handleOpenSubjectFromSearch}
        searchPrefillRef={s.searchPrefillRef}
        setCurrentView={s.setCurrentView}
      />

      <AppOverlays
        selectedSubject={s.selectedSubject}
        setSelectedSubject={s.setSelectedSubject}
        isFeedbackOpen={s.isFeedbackOpen}
        setIsFeedbackOpen={s.setIsFeedbackOpen}
      />
    </div>
  );
}

export default App;
