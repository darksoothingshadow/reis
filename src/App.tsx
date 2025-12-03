import { useState } from 'react'
import './App.css'
import { Sidebar } from './components/Sidebar'
import { SearchBar } from './components/SearchBar'
import { SchoolCalendar } from './components/SchoolCalendar'
import { DashboardWidgets } from './components/DashboardWidgets'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSmartWeekRange } from './utils/calendarUtils'
import { ExamDrawer } from './components/ExamDrawer'
import { PortalContext } from './components/ui/portal-context'
import { useRef } from 'react'

function App() {
  const [currentDate, setCurrentDate] = useState(() => {
    const { start } = getSmartWeekRange();
    return start;
  });

  const handlePrevWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    const { start } = getSmartWeekRange();
    setCurrentDate(start);
  };

  const getMonthYear = () => {
    return currentDate.toLocaleString('cs-CZ', { month: 'long', year: 'numeric' });
  };

  const [isExamDrawerOpen, setIsExamDrawerOpen] = useState(false);
  const portalContainerRef = useRef<HTMLDivElement>(null);

  return (
    <PortalContext.Provider value={portalContainerRef.current}>
      <div className="flex min-h-screen bg-white font-sans text-gray-900" ref={portalContainerRef}>
        <Sidebar onOpenExamDrawer={() => setIsExamDrawerOpen(true)} />
        <main className="flex-1 ml-0 md:ml-20 transition-all duration-300">
          <div className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200 px-8 py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
              {/* Navigation Controls */}
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-100 rounded-lg p-1">
                  <button onClick={handlePrevWeek} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-gray-600 hover:text-primary">
                    <ChevronLeft size={20} />
                  </button>
                  <button onClick={handleNextWeek} className="p-1 hover:bg-white rounded-md shadow-sm transition-all text-gray-600 hover:text-primary">
                    <ChevronRight size={20} />
                  </button>
                </div>
                <button
                  onClick={handleToday}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-[#79be15] hover:bg-[#79be15]/90 rounded-md transition-all shadow-sm"
                >
                  Dnes
                </button>
                <span className="text-lg font-semibold text-gray-800 capitalize min-w-[150px]">{getMonthYear()}</span>
              </div>

              <div className="flex-1 max-w-2xl">
                <SearchBar onOpenExamDrawer={() => setIsExamDrawerOpen(true)} />
              </div>
            </div>
          </div>

          <div className="p-8 max-w-8xl mx-auto">
            <DashboardWidgets />
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden min-h-[800px]">
              <SchoolCalendar key={currentDate.toISOString()} initialDate={currentDate} />
            </div>
          </div>
        </main>

        <ExamDrawer isOpen={isExamDrawerOpen} onClose={() => setIsExamDrawerOpen(false)} />
      </div>
    </PortalContext.Provider>
  )
}

export default App