import type { CalendarEvent } from '../types/calendar';

interface WeeklyCalendarProps {
  currentWeek: Date;
  onNavigateWeek: (direction: 'prev' | 'next') => void;
  onGoToToday: () => void;
  events: CalendarEvent[];
  isLoading?: boolean;
  onEventClick?: (event: CalendarEvent) => void;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const START_HOUR = 6;
const END_HOUR = 20;
const DISPLAY_DAYS = 7;
const ROW_HEIGHT = 50;
const HEADER_HEIGHT = 80;

const typeStyles = {
  lecture: {
    bg: 'rgb(63, 81, 181)',
    text: 'white'
  },
  exercise: {
    bg: 'rgb(251, 188, 4)',
    text: 'rgb(60, 64, 67)'
  }
};

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function getEventPosition(event: CalendarEvent) {
  const startMinutes = timeToMinutes(event.startTime);
  const endMinutes = timeToMinutes(event.endTime);
  const duration = endMinutes - startMinutes;

  // Calculate offset relative to START_HOUR
  const offsetMinutes = startMinutes - (START_HOUR * 60);

  const top = (offsetMinutes / 60) * ROW_HEIGHT;
  const height = (duration / 60) * ROW_HEIGHT;

  return { top, height };
}

export function WeeklyCalendar({ currentWeek, onNavigateWeek: _onNavigateWeek, onGoToToday, events, isLoading, onEventClick }: WeeklyCalendarProps) {
  // const [events] = useState<CalendarEvent[]>(SAMPLE_EVENTS);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center h-full bg-white">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Generate dates
  const getWeekDates = () => {
    const week = [];
    const start = new Date(currentWeek);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);

    for (let i = 0; i < 7; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      week.push(date);
    }
    return week;
  };

  const weekDates = getWeekDates();
  const today = new Date();
  const isToday = (date: Date) =>
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  // Generate labels from START_HOUR to END_HOUR
  const timeLabels = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

  return (
    <div className="flex-1 flex flex-col bg-white h-full overflow-hidden">
      {/* Header Section (Days) */}
      <div className="flex flex-shrink-0 border-b border-gray-200 bg-white z-20 shadow-sm">
        {/* Time Column Header Spacer */}
        <div className="w-12 flex-shrink-0 border-r border-gray-100" style={{ height: HEADER_HEIGHT }}></div>

        {/* Days Header */}
        <div className="flex-1 flex">
          {weekDates.slice(0, DISPLAY_DAYS).map((date, index) => {
            const isTodayDate = isToday(date);
            const isWeekend = index === 5 || index === 6;
            return (
              <div
                key={index}
                className={`flex-1 flex flex-col items-center justify-center ${isTodayDate ? 'bg-blue-50' : ''
                  }`}
                style={{ height: HEADER_HEIGHT }}
              >
                <span className={`text-[11px] mb-2 uppercase font-medium tracking-wide ${isWeekend ? 'text-gray-400' : 'text-gray-500'}`}>
                  {DAYS[index]}
                </span>
                <button
                  className={`text-xl flex items-center justify-center w-10 h-10 rounded-full transition-all ${isTodayDate
                    ? 'bg-blue-600 text-white shadow-md font-medium'
                    : isWeekend
                      ? 'text-gray-400'
                      : 'text-gray-800 hover:bg-gray-100'
                    }`}
                  onClick={isTodayDate ? onGoToToday : undefined}
                >
                  {date.getDate()}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Schedule Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="flex">

          {/* Time Column (Sticky Left) */}
          <div className="w-12 flex-shrink-0 sticky left-0 z-10 bg-white border-r border-gray-100 select-none">
            <div className="relative" style={{ height: (END_HOUR - START_HOUR) * ROW_HEIGHT }}>
              {timeLabels.map((hour, index) => (
                <div
                  key={hour}
                  className="absolute right-2 text-[10px] font-medium text-gray-400 flex items-center justify-end"
                  style={{
                    top: index * ROW_HEIGHT,
                    transform: 'translateY(-50%)',
                    height: '20px'
                  }}
                >
                  {/* Hide labels for 6:00 and 20:00 */}
                  {hour === START_HOUR || hour === END_HOUR ? '' : `${hour}:00`}
                </div>
              ))}
            </div>
          </div>

          {/* Grid & Events */}
          <div className="flex-1 relative">

            {/* Background Grid Lines */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Horizontal Lines */}
              {timeLabels.map((_, index) => (
                <div
                  key={`h-${index}`}
                  className="border-b border-gray-100 w-full absolute"
                  style={{
                    top: index * ROW_HEIGHT,
                  }}
                />
              ))}
              {/* Vertical Lines */}
              <div className="flex h-full">
                {weekDates.slice(0, DISPLAY_DAYS).map((_, i) => (
                  <div key={`v-${i}`} className="flex-1 border-r border-gray-100 h-full last:border-r-0" />
                ))}
              </div>
            </div>

            {/* Events Layer */}
            <div className="flex relative" style={{ height: (END_HOUR - START_HOUR) * ROW_HEIGHT }}>
              {weekDates.slice(0, DISPLAY_DAYS).map((_date, dayIndex) => {
                const dayEvents = events.filter(e => e.day === dayIndex);

                return (
                  <div key={dayIndex} className="flex-1 relative h-full">
                    {dayEvents.map((event) => {
                      const { top, height } = getEventPosition(event);

                      // Simple bounding check
                      const maxTop = (END_HOUR - START_HOUR) * ROW_HEIGHT;
                      if (top + height <= 0 || top >= maxTop) return null;

                      const styles = typeStyles[event.type];

                      return (
                        <div
                          key={event.id}
                          className="absolute left-0.5 right-1 rounded border border-white/20 shadow-sm z-10 cursor-pointer hover:brightness-95 transition-all"
                          style={{
                            top: `${top}px`,
                            height: `${Math.max(height, 20)}px`,
                            backgroundColor: styles.bg,
                            color: styles.text
                          }}
                          onClick={() => onEventClick?.(event)}
                        >
                          <div className="px-1.5 py-1 leading-snug h-full overflow-hidden">
                            <div className="text-xs font-medium truncate">
                              {event.subjectCode}
                            </div>
                            {event.subjectName && (
                              <div className="text-[10px] opacity-90 truncate">
                                {event.subjectName}
                              </div>
                            )}
                            <div className="flex flex-wrap gap-1 text-xs opacity-80 mt-0.5">
                              <span>{event.room}</span>
                              <span>{event.startTime}-{event.endTime}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom buffer */}
        <div className="h-4"></div>
      </div>
    </div>
  );
}