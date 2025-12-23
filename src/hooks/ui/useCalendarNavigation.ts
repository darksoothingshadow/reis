import { useState, useCallback, useMemo } from 'react';
import { getSmartWeekRange } from '../../utils/calendarUtils';
import { useSchedule, useExams } from '../data';
import { parseDate } from '../../utils/dateHelpers';

// Helper: Get week date strings (YYYYMMDD format)
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

export function useCalendarNavigation() {
  const { schedule: storedSchedule } = useSchedule();
  const { exams: storedExams } = useExams();
  
  const [currentDate, setCurrentDate] = useState(() => {
    const { start } = getSmartWeekRange();
    return start;
  });
  const [navCount, setNavCount] = useState(0);

  // Pre-compute exam date strings
  const examDateStrings = useMemo(() => {
    if (!storedExams || storedExams.length === 0) return new Set<string>();
    const dateSet = new Set<string>();
    storedExams.forEach(subject => {
      subject.sections.forEach((section) => {
        if (section.status === 'registered' && section.registeredTerm) {
          const examDate = parseDate(section.registeredTerm.date, section.registeredTerm.time);
          const dateStr = `${examDate.getFullYear()}${String(examDate.getMonth() + 1).padStart(2, '0')}${String(examDate.getDate()).padStart(2, '0')}`;
          dateSet.add(dateStr);
        }
      });
    });
    return dateSet;
  }, [storedExams]);

  const weekHasContent = useCallback((weekStart: Date): boolean => {
    const weekDates = getWeekDateStrings(weekStart);
    if (storedSchedule?.some(lesson => weekDates.includes(lesson.date))) return true;
    if (weekDates.some(dateStr => examDateStrings.has(dateStr))) return true;
    return false;
  }, [storedSchedule, examDateStrings]);

  const findNextWeekWithContent = useCallback((fromDate: Date, direction: 'next' | 'prev'): Date => {
    let candidate = new Date(fromDate);
    for (let i = 0; i < 52; i++) {
      candidate = new Date(candidate);
      candidate.setDate(candidate.getDate() + (direction === 'next' ? 7 : -7));
      if (weekHasContent(candidate)) return candidate;
    }
    const fallback = new Date(fromDate);
    fallback.setDate(fallback.getDate() + (direction === 'next' ? 7 : -7));
    return fallback;
  }, [weekHasContent]);

  const handlePrev = useCallback(() => {
    setCurrentDate(prev => findNextWeekWithContent(prev, 'prev'));
    setNavCount(c => c + 1);
  }, [findNextWeekWithContent]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => findNextWeekWithContent(prev, 'next'));
    setNavCount(c => c + 1);
  }, [findNextWeekWithContent]);

  const handleToday = useCallback(() => {
    const { start } = getSmartWeekRange();
    setCurrentDate(start);
  }, []);

  const dateRangeLabel = useMemo(() => {
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(currentDate.getDate() + 6);
    const startDay = currentDate.getDate();
    const startMonth = currentDate.getMonth() + 1;
    const endDay = weekEnd.getDate();
    const endMonth = weekEnd.getMonth() + 1;
    const year = weekEnd.getFullYear();

    if (startMonth === endMonth) {
      return `${startDay}. - ${endDay}.${startMonth}. ${year}`;
    }
    return `${startDay}.${startMonth}. - ${endDay}.${startMonth === 12 && endMonth === 1 ? endMonth + '.' + (year) : endMonth + '.'} ${year}`;
  }, [currentDate]);

  return {
    currentDate,
    setCurrentDate,
    navCount,
    handlePrev,
    handleNext,
    handleToday,
    dateRangeLabel
  };
}
