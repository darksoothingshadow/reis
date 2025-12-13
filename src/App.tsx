import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import './App.css'
import { Sidebar } from './components/Sidebar'
import { SearchBar } from './components/SearchBar'
import { WeeklyCalendar } from './components/WeeklyCalendar'
import { OutlookSyncHint } from './components/OutlookSyncHint'
import { Toaster } from './components/ui/sonner'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getSmartWeekRange } from './utils/calendarUtils'
import { ExamDrawer } from './components/ExamDrawer'
import { signalReady, requestData, isInIframe } from './api/proxyClient'
import type { SyncedData } from './types/messages'
import { StorageService, STORAGE_KEYS } from './services/storage'
import { syncService, outlookSyncService } from './services/sync'
import { useSchedule, useExams, useOutlookSync } from './hooks/data'
import { parseDate } from './utils/dateHelpers'

// Helper: Get week date strings (YYYYMMDD format) for a given week start date
function getWeekDateStrings(weekStart: Date): string[] {
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}${month}${day}`);
  }
  return dates;
}

function App() {
  // Initialize Outlook sync service on startup
  useEffect(() => {
    outlookSyncService.init();
  }, []);
  
  // Access schedule and exams data at App level for week content checking
  const { schedule: storedSchedule } = useSchedule();
  const { exams: storedExams } = useExams();
  
  // Pre-compute exam date strings (registered exams only)
  const examDateStrings = useMemo(() => {
    if (!storedExams || storedExams.length === 0) return new Set<string>();
    
    const dateSet = new Set<string>();
    storedExams.forEach(subject => {
      subject.sections.forEach((section: { status: string; registeredTerm?: { date: string; time: string } }) => {
        if (section.status === 'registered' && section.registeredTerm) {
          const examDate = parseDate(section.registeredTerm.date, section.registeredTerm.time);
          const dateStr = `${examDate.getFullYear()}${String(examDate.getMonth() + 1).padStart(2, '0')}${String(examDate.getDate()).padStart(2, '0')}`;
          dateSet.add(dateStr);
        }
      });
    });
    return dateSet;
  }, [storedExams]);
  
  // Check if a given week has any events (schedule or exams)
  const weekHasContent = useCallback((weekStart: Date): boolean => {
    const weekDates = getWeekDateStrings(weekStart);
    
    // Check schedule
    if (storedSchedule && storedSchedule.length > 0) {
      const hasScheduleEvent = storedSchedule.some(lesson => weekDates.includes(lesson.date));
      if (hasScheduleEvent) return true;
    }
    
    // Check exams
    const hasExamEvent = weekDates.some(dateStr => examDateStrings.has(dateStr));
    if (hasExamEvent) return true;
    
    return false;
  }, [storedSchedule, examDateStrings]);
  
  // Find the next week with content in a given direction
  const findNextWeekWithContent = useCallback((fromDate: Date, direction: 'next' | 'prev'): Date => {
    const MAX_WEEKS_TO_SKIP = 52; // Maximum weeks to search (1 year)
    let candidate = new Date(fromDate);
    
    for (let i = 0; i < MAX_WEEKS_TO_SKIP; i++) {
      candidate = new Date(candidate);
      candidate.setDate(candidate.getDate() + (direction === 'next' ? 7 : -7));
      
      if (weekHasContent(candidate)) {
        return candidate;
      }
    }
    
    // If no content found within limit, just return one week in direction
    const fallback = new Date(fromDate);
    fallback.setDate(fallback.getDate() + (direction === 'next' ? 7 : -7));
    return fallback;
  }, [weekHasContent]);
  
  const [currentDate, setCurrentDate] = useState(() => {
    const { start } = getSmartWeekRange();
    return start;
  });

  const [isExamDrawerOpen, setIsExamDrawerOpen] = useState(false);
  
  // Navigation count for Outlook sync hint trigger
  const [weekNavCount, setWeekNavCount] = useState(0);
  
  // Outlook sync state
  const { isEnabled: outlookSyncEnabled } = useOutlookSync();
  
  // Ref to trigger opening settings popup in Sidebar
  const openSettingsRef = useRef<(() => void) | null>(null);

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
      // Not in iframe (dev mode)
      console.log('[App] Running standalone (dev mode)');
    }
  }, []);

  const handlePrevWeek = () => {
    // Skip to previous week with content
    const newDate = findNextWeekWithContent(currentDate, 'prev');
    setCurrentDate(newDate);
    setWeekNavCount(prev => prev + 1);
  };

  const handleNextWeek = () => {
    // Skip to next week with content
    const newDate = findNextWeekWithContent(currentDate, 'next');
    setCurrentDate(newDate);
    setWeekNavCount(prev => prev + 1);
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
    <div className="flex h-screen overflow-hidden bg-base-200 font-sans text-base-content">
      <Toaster position="top-center" />
      <Sidebar 
        onOpenExamDrawer={() => setIsExamDrawerOpen(true)} 
        onOpenSettingsRef={openSettingsRef}
      />
      <main className="flex-1 flex flex-col ml-0 md:ml-20 transition-all duration-300 overflow-hidden">
        <div className="flex-shrink-0 z-30 bg-base-200/90 backdrop-blur-md border-b border-base-300 px-4 py-2">
          <div className="flex items-center justify-between gap-4 w-full">
            {/* Navigation Controls - flush left */}
            <div className="flex items-center gap-4 flex-shrink-0">
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
              <span className="text-lg font-semibold text-base-content whitespace-nowrap">{getDateRangeLabel()}</span>
            </div>

            {/* SearchBar - always far right */}
            <div className="flex-shrink-0 w-[480px] mr-2">
              <SearchBar onOpenExamDrawer={() => setIsExamDrawerOpen(true)} />
            </div>
          </div>
        </div>

        <div className="flex-1 pt-3 px-4 pb-1 overflow-hidden flex flex-col">
          <div className="flex-1 bg-base-100 rounded-lg shadow-sm border border-base-300 overflow-hidden">
            <WeeklyCalendar
              key={currentDate.toISOString()}
              initialDate={currentDate}
            />
          </div>
        </div>
      </main>

      <ExamDrawer isOpen={isExamDrawerOpen} onClose={() => setIsExamDrawerOpen(false)} />
      
      {/* Outlook Sync Tutorial Hint */}
      <OutlookSyncHint
        navigationCount={weekNavCount}
        isSyncEnabled={outlookSyncEnabled}
        onSetup={() => openSettingsRef.current?.()}
      />
    </div>
  )
}

export default App