import { useState, useMemo } from 'react';
import { SubjectPopup } from '../popup/subject_popup';

// --- TYPE DEFINITIONS ---

/** Defines the shape of a teacher object. */
interface Teacher {
  fullName: string;
  shortName: string;
  id:string,
}

interface RoomStructured {
  name: string;
  id: string;
}

/** Defines the shape of a single block lesson in the schedule. */
export interface BlockLesson {
  date: string; // e.g., "20251022"
  isConsultation: string; // <-- NEW, e.g., "false" (or boolean if possible)
  room: string;
  roomStructured: RoomStructured; // <-- NEW, structured room data
  studyId: string;
  endTime: string; // e.g., "16:50"
  facultyCode: string; // <-- NEW, e.g., "PEF"
  id: string;
  startTime: string; // e.g., "15:00"
  isDefaultCampus: string; // <-- NEW, e.g., "true" (or boolean if possible)
  courseId: string;
  courseName: string;
  campus: string;
  isSeminar: string; // <-- NEW, e.g., "false" (or boolean if possible)
  teachers: Teacher[];
  courseCode: string;
  periodId: string; // <-- NEW, e.g., "801"
}

/** Defines the shape of the full schedule data object. */
export interface ScheduleData {
  blockLessons: BlockLesson[];
}

/** Defines the structure of the date information for display. */
interface DateInfo {
  weekday: string;
  day: string;
  month: string;
  full: string;
}

/** Extends BlockLesson with the assigned row index for display. */
interface LessonWithRow extends BlockLesson {
  row: number;
}

/** Defines the structure for lessons organized by date. */
interface OrganizedLessons {
  lessons: LessonWithRow[];
  totalRows: number;
}

// --- COMPONENT START ---
export interface SchedueleProps{
  hideScroll?:boolean,
  data:BlockLesson[],
}

export function SchoolCalendar(props:SchedueleProps){
  if(props.data.length == 0){
    return (
      <div className='w-full h-48 pl-8 pr-8 flex justify-center items-center'>
        <div className='w-full h-3/4 bg-white shadow-md rounded-md text-lg font-dm text-gray-400 flex justify-center items-center'>
          Čas na odpočinek!
        </div>
      </div>
    )
  };
  // Sample data: use the ScheduleData interface
  const scheduleData: ScheduleData = {
    "blockLessons": props.data,
  };

  const [selected,setSelected] = useState<BlockLesson|null>(null);
  const [viewDays, _setViewDays] = useState<number>(scheduleData.blockLessons.length);

  // Time configuration
  const START_HOUR: number = 7;
  const END_HOUR: number = 19;
  const HOURS: number[] = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => i + START_HOUR);

  /**
   * Parses time string to minutes from the START_HOUR.
   * @param time - The time string (e.g., "15:00").
   * @returns The time in minutes relative to START_HOUR.
   */
  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours - START_HOUR) * 60 + minutes;
  };

  /**
   * Formats a date string (YYYYMMDD) for display.
   * @param dateStr - The date string (e.g., "20251020").
   * @returns An object with formatted date components.
   */
  const formatDate = (dateStr: string): DateInfo => {
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    // Note: Month is 0-indexed in Date constructor (month - 1)
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return {
      weekday: date.toLocaleDateString('cs-CZ', { weekday: 'short' }),
      day: day,
      month: month,
      full: `${day}.${month}.`
    };
  };

  // Get unique dates and sort them, limited by viewDays
  const uniqueDates: string[] = useMemo(() => {
    const dates = [...new Set(scheduleData.blockLessons.map(l => l.date))].sort();
    return dates.slice(0, viewDays === 10 ? dates.length : viewDays); // Handle 'Vše' (All) case
  }, [viewDays]);

  /**
   * Assigns a vertical row index to each lesson on a given day to prevent collisions.
   * @param lessons - An array of lessons for a single day.
   * @returns An object containing the lessons with row indices and the total number of rows used.
   */
  const assignLessonRows = (lessons: BlockLesson[]): OrganizedLessons => {
    const sortedLessons = [...lessons].sort((a, b) => {
      const aStart = timeToMinutes(a.startTime);
      const bStart = timeToMinutes(b.startTime);
      return aStart - bStart;
    });

    // rows is an array of arrays of LessonWithRow, where rows[i] holds all lessons in row i
    const rows: LessonWithRow[][] = [];

    sortedLessons.forEach((lesson) => {
      const startMin = timeToMinutes(lesson.startTime);
      const endMin = timeToMinutes(lesson.endTime);

      // Find the first row where this lesson doesn't collide
      let rowIndex = 0;
      let placed = false;

      while (!placed) {
        if (!rows[rowIndex]) {
          rows[rowIndex] = [];
        }

        const hasCollision = rows[rowIndex].some(l => {
          const lStart = timeToMinutes(l.startTime);
          const lEnd = timeToMinutes(l.endTime);
          // Collision check: startA < endB AND endA > startB
          return (startMin < lEnd && endMin > lStart);
        });

        if (!hasCollision) {
          rows[rowIndex].push({ ...lesson, row: rowIndex });
          placed = true;
        } else {
          rowIndex++;
        }
      }
    });

    const totalRows = rows.length;
    const allLessons = rows.flat();

    return { lessons: allLessons, totalRows };
  };

  // Organize lessons by date and assign collision rows
  const lessonsByDate: Record<string, OrganizedLessons> = useMemo(() => {
    const organized: Record<string, OrganizedLessons> = {};
    uniqueDates.forEach(date => {
      const dateLessons = scheduleData.blockLessons.filter(l => l.date === date);
      organized[date] = assignLessonRows(dateLessons);
    });
    return organized;
  }, [uniqueDates, scheduleData.blockLessons]); // Added scheduleData.blockLessons as a dependency for completeness

  /**
   * Maps a course code to a Tailwind CSS background color class.
   * @param courseCode - The course code string.
   * @returns A Tailwind CSS class string.
   */
  /*const getColorForCourse = (courseCode: string): string => {
    const colors: Record<string, string> = {
      'EBC-PE': 'bg-blue-500',
      'EBC-PS': 'bg-green-500',
      'EBA-OTII': 'bg-purple-500',
      'EBC-PJ': 'bg-orange-500',
      'EBC-UICT': 'bg-red-500',
      'EBC-VWA': 'bg-teal-500'
    };
    return colors[courseCode] || 'bg-gray-500';
  };*/

  const totalMinutes: number = (END_HOUR - START_HOUR) * 60;
  const pixelsPerMinute: number = 1.95; // 2 pixels per minute = 120px per hour
  const rowHeight: number = 120;

  return (
    <div className="w-full min-h-fit p-4">
      {/*<div className="mb-4 flex gap-2 items-center">
        <span className="text-sm font-medium">Zobrazit dní:</span>
        <button onClick={() => setViewDays(1)} className={`px-3 py-1 rounded ${viewDays === 1 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>1</button>
        <button onClick={() => setViewDays(5)} className={`px-3 py-1 rounded ${viewDays === 5 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>5</button>
        <button onClick={() => setViewDays(10)} className={`px-3 py-1 rounded ${viewDays === 10 ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>Vše</button>
      </div>*/}
      {/* Calendar Grid */}
      <div className={`bg-white rounded-lg shadow-lg ${props.hideScroll!=true?"overflow-auto modern-scrollbar":"overflow-hidden"}`}>
        {/* Time header */}
        <div className="flex border-b-2 border-gray-300 sticky top-0 bg-white z-10">
          <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50"></div>
          <div className="flex-1 flex relative" style={{ minWidth: `${totalMinutes * pixelsPerMinute}px` }}>
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="border-l border-gray-300 flex items-center justify-start pl-2"
                style={{ width: `${60 * pixelsPerMinute}px` }}
              >
                <span className="text-sm font-semibold text-gray-700">{hour}:00</span>
              </div>
            ))}
          </div>
        </div>

        {/* Days rows */}
        {uniqueDates.map((date) => {
          const dateInfo = formatDate(date);
          const { lessons, totalRows } = lessonsByDate[date];
          const totalHeight = Math.max(totalRows * rowHeight, rowHeight);

          return (
            <div key={date} className="flex border-b border-gray-200">
              {/* Day label */}
              <div className="w-16 flex-shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col items-center justify-center p-2">
                <span className="text-xs font-semibold text-gray-500 uppercase">{dateInfo.weekday}</span>
                <span className="text-md font-bold text-gray-800">{dateInfo.day}/{dateInfo.month}</span>
              </div>

              {/* Time grid for this day */}
              <div className="flex-1 relative" style={{ minWidth: `${totalMinutes * pixelsPerMinute}px`, height: `${totalHeight}px` }}>
                {/* Hour grid lines */}
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute top-0 bottom-0 border-l border-gray-100"
                    style={{ left: `${(hour - START_HOUR) * 60 * pixelsPerMinute}px` }}
                  ></div>
                ))}

                {/* Lessons */}
                {lessons.map((lesson) => {
                  const startMin = timeToMinutes(lesson.startTime);
                  const endMin = timeToMinutes(lesson.endTime);
                  const duration = endMin - startMin;
                  const leftPos = startMin * pixelsPerMinute;
                  const width = duration * pixelsPerMinute;
                  const top = lesson.row * rowHeight;

                  return (
                    <div
                      key={lesson.id}
                      className={`absolute ${/*getColorForCourse(lesson.courseCode)*/""} ${lesson.isSeminar=="true"?"bg-gradient-to-br from-[#b3e6ea] to-white":"bg-gradient-to-br from-[#79be15]/25 to-white"} text-gray-700 font-dm p-3 rounded shadow-md cursor-pointer hover:shadow-lg transition-shadow overflow-hidden`}
                      style={{
                        left: `${leftPos}px`,
                        width: `${width - 4}px`, // Adjusted width for padding/margin
                        top: `${top + 6}px`, // Adjusted top for padding/margin
                        height: `${rowHeight - 12}px` // Adjusted height for padding/margin
                      }}
                      onClick={()=>{setSelected(lesson)}}
                      title={`${lesson.courseName}\n${lesson.startTime} - ${lesson.endTime}\n${lesson.room}\n${lesson.teachers[0]?.shortName}`}
                    >
                      <div className="text-sm font-bold truncate">{lesson.courseCode}</div>
                      <div className="text-xs truncate mt-1">{lesson.courseName}</div>
                      <div className="text-xs mt-1 opacity-90">{lesson.startTime} - {lesson.endTime}</div>
                      {/*<div className="text-xs opacity-90 truncate">📍 {lesson.room}</div>*/}
                      <span className={`absolute left-0 top-0 h-full w-0.5 border-l-2 ${lesson.isSeminar=="false"?"border-l-primary":"border-l-blue-500"}`}></span>
                      <span className='absolute right-1 top-1 text-gray-500 font-semibold font-dm text-xs'>{lesson.roomStructured.name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      {selected!=null?<SubjectPopup code={selected} onClose={()=>{setSelected(null)}}/>:<></>}
    </div>
  );
};

export default SchoolCalendar;