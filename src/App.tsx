import { useState, useEffect } from 'react'
import './App.css'
import { Sidebar } from './components/Sidebar'
import { SearchBar } from './components/SearchBar'
import { WeeklyCalendar } from './components/WeeklyCalendar'

import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { getSmartWeekRange } from './utils/calendarUtils'
import { ExamDrawer } from './components/ExamDrawer'
import { signalReady, requestData, isInIframe } from './api/proxyClient'
import type { SyncedData } from './types/messages'
import { StorageService, STORAGE_KEYS } from './services/storage'
import { syncService, outlookSyncService } from './services/sync'

function App() {
  // Initialize Outlook sync service on startup
  useEffect(() => {
    outlookSyncService.init();
  }, []);
  const [currentDate, setCurrentDate] = useState(() => {
    const { start } = getSmartWeekRange();
    return start;
  });

  const [isExamDrawerOpen, setIsExamDrawerOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [syncData, setSyncData] = useState<SyncedData | null>(null);

  // Set up postMessage communication with Content Script
  useEffect(() => {
    // Only set up iframe communication if we're in an iframe
    if (isInIframe()) {
      console.log('[App] Running in iframe, setting up postMessage listener');

      const handleMessage = (event: MessageEvent) => {
        // Accept messages from parent (content script)
        if (event.source !== window.parent) return;

        const data = event.data;
        if (!data || typeof data !== 'object') return;

        console.log('[App] Received message:', data.type);

        if (data.type === 'REIS_DATA' || data.type === 'REIS_SYNC_UPDATE') {
          const receivedData = data.data || data;
          setSyncData(receivedData);

          // Write data to localStorage so child components can read it
          // This bridges the gap between postMessage and StorageService
          if (receivedData.schedule) {
            StorageService.set(STORAGE_KEYS.SCHEDULE_DATA, receivedData.schedule);
            console.log('[App] Wrote schedule to localStorage:', Array.isArray(receivedData.schedule) ? receivedData.schedule.length : 'non-array');
          }
          if (receivedData.exams) {
            StorageService.set(STORAGE_KEYS.EXAMS_DATA, receivedData.exams);
            console.log('[App] Wrote exams to localStorage:', Array.isArray(receivedData.exams) ? receivedData.exams.length : 'non-array');
          }
          if (receivedData.subjects) {
            StorageService.set(STORAGE_KEYS.SUBJECTS_DATA, receivedData.subjects);
            console.log('[App] Wrote subjects to localStorage');
          }
          if (receivedData.files && typeof receivedData.files === 'object') {
            // Write files for each subject with prefix key
            const filesData = receivedData.files as Record<string, unknown>;
            const subjectCount = Object.keys(filesData).length;
            for (const [courseCode, files] of Object.entries(filesData)) {
              const key = `${STORAGE_KEYS.SUBJECT_FILES_PREFIX}${courseCode}`;
              StorageService.set(key, files);
            }
            console.log('[App] Wrote files for', subjectCount, 'subjects to localStorage');
          }
          if (receivedData.lastSync) {
            StorageService.set(STORAGE_KEYS.LAST_SYNC, receivedData.lastSync);
          }

          // Trigger hooks to re-read from localStorage
          syncService.triggerRefresh();

          setIsLoading(false);
          console.log('[App] Data received, written to localStorage, loading complete');
        }
      };

      window.addEventListener('message', handleMessage);

      // Signal that iframe is ready
      signalReady();

      // Request initial data
      requestData('all');

      return () => {
        window.removeEventListener('message', handleMessage);
      };
    } else {
      // Not in iframe (dev mode), skip loading state
      console.log('[App] Running standalone (dev mode)');
      setIsLoading(false);
    }
  }, []);

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

  const getDateRangeLabel = () => {
    // Show date range like "3.12. - 9.12." or "28.12. - 3.1." if spanning months
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);

    const startDay = currentDate.getDate();
    const startMonth = currentDate.getMonth() + 1;
    const endDay = weekEnd.getDate();
    const endMonth = weekEnd.getMonth() + 1;
    const year = weekEnd.getFullYear();

    if (startMonth === endMonth) {
      return `${startDay}. - ${endDay}.${startMonth}. ${year}`;
    } else {
      return `${startDay}.${startMonth}. - ${endDay}.${startMonth === 12 && endMonth === 1 ? endMonth + '.' + (year) : endMonth + '.'} ${year}`;
    }
  };

  // Show loading spinner while waiting for data from content script
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base-200">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-base-content/70">Načítání dat...</p>
        </div>
      </div>
    );
  }

  // Log sync data for debugging
  if (syncData) {
    console.log('[App] Current sync data:', {
      hasSchedule: !!syncData.schedule,
      hasExams: !!syncData.exams,
      hasSubjects: !!syncData.subjects,
      lastSync: syncData.lastSync
    });
  }

  return (
    <div className="flex min-h-screen bg-base-200 font-sans text-base-content">
      <Sidebar onOpenExamDrawer={() => setIsExamDrawerOpen(true)} />
      <main className="flex-1 ml-0 md:ml-20 transition-all duration-300">
        <div className="sticky top-0 z-30 bg-base-200/90 backdrop-blur-md border-b border-base-300 px-8 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
            {/* Navigation Controls */}
            <div className="flex items-center gap-4">
              <div className="flex items-center bg-base-300 rounded-lg p-1">
                <button onClick={handlePrevWeek} className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary">
                  <ChevronLeft size={20} />
                </button>
                <button onClick={handleNextWeek} className="p-1 hover:bg-base-100 rounded-md shadow-sm transition-all text-base-content/70 hover:text-primary">
                  <ChevronRight size={20} />
                </button>
              </div>
              <button
                onClick={handleToday}
                className="btn btn-primary btn-sm"
              >
                Dnes
              </button>
              <span className="text-lg font-semibold text-base-content min-w-[150px]">{getDateRangeLabel()}</span>
            </div>

            <div className="flex-1 max-w-2xl">
              <SearchBar onOpenExamDrawer={() => setIsExamDrawerOpen(true)} />
            </div>
          </div>
        </div>

        <div className="p-4 max-w-8xl mx-auto">

          <div className="bg-base-100 rounded-xl shadow-sm border border-base-300 overflow-hidden">
            <WeeklyCalendar
              key={currentDate.toISOString()}
              initialDate={currentDate}
              onEmptyWeek={(direction) => {
                if (direction === 'next') {
                  handleNextWeek();
                } else {
                  handlePrevWeek();
                }
              }}
            />
          </div>
        </div>
      </main>

      <ExamDrawer isOpen={isExamDrawerOpen} onClose={() => setIsExamDrawerOpen(false)} />
    </div>
  )
}

export default App