/**
 * CalendarEventCard - Event card component matching Figma design.
 *
 * Uses workspace semantic colors (exam-*, lecture-*, seminar-*).
 * Renders with adaptive content based on event duration.
 *
 * NOTE: This component fills its parent container. Positioning is handled by the parent.
 */

import { MapPin, EyeOff, Calendar, CalendarRange, Timer } from 'lucide-react';
import type { LessonWithRow } from '../types/calendarTypes';
import { useCourseName } from '../hooks/ui/useCourseName';
import { useAppStore } from '../store/useAppStore';
import { useTranslation } from '../hooks/useTranslation';
import { useTimeline } from '../hooks/useTimeline';
import { useHintStatus } from '../hooks/ui/useHintStatus';
import { renderedBlockMinutes } from './WeeklyCalendar/utils';
import { toast } from 'sonner';

interface CalendarEventCardProps {
  lesson: LessonWithRow;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  language?: string; // Language for localization
}

// Helper function to get localized course name
function getLocalizedCourseName(lesson: LessonWithRow, language?: string): string {
  if (language === 'en' && lesson.courseNameEn) {
    return lesson.courseNameEn;
  }
  return lesson.courseNameCs || lesson.courseName;
}

// Helper function to get localized room name
function getLocalizedRoom(lesson: LessonWithRow, language?: string): string {
  if (language === 'en' && lesson.roomEn) {
    return lesson.roomEn;
  }
  return lesson.roomCs || lesson.room;
}

// Extract exam section name from the composite title
function getExamSectionName(courseName: string): string {
  // The format from WeeklyCalendar is `${subject.name} - ${section.name}`
  // We want to extract the full section name (everything after the first dash)
  const parts = courseName.split(' - ');
  const sectionName = parts.length > 1 ? parts.slice(1).join(' - ') : courseName;

  // Normalize "prubezny" to "průběžný"
  return sectionName.replace(/prubezny/gi, 'průběžný');
}

export function CalendarEventCard({ lesson, onClick, language }: CalendarEventCardProps) {
  const { t } = useTranslation();
  const { isSeen, markSeen } = useHintStatus('calendar_hide_first_time');
  const hideEvent = useAppStore((s) => s.hideEvent);
  const hideCourse = useAppStore((s) => s.hideCourse);
  const timeline = useTimeline(lesson.courseCode || '');

  // Gate on the space the block actually occupies, not its literal length. Exam
  // lengths are real now (see services/sync/examDurations.ts), so a 10-minute
  // oral exam would otherwise fail this check and render with no subject or
  // room at all — the grid floors short blocks, so the room is there to use.
  const isLongEnough = renderedBlockMinutes(lesson.startTime, lesson.endTime) >= 60;

  const handleHideOccurrence = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideEvent(lesson.id, lesson.courseCode, fullName, lesson.date);
    showHint();
  };

  const handleHideType = (e: React.MouseEvent) => {
    e.stopPropagation();
    const type = lesson.isSeminar === 'true' ? 'seminar' : 'lecture';
    hideCourse(lesson.courseCode, fullName, type);
    showHint();
  };

  const handleHideAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    hideCourse(lesson.courseCode, fullName, 'all');
    showHint();
  };

  const showHint = () => {
    if (!isSeen) {
      toast.info(t('calendar.hide.hint'), {
        duration: 5000,
      });
      markSeen();
    }
  };

  // Get localized names and apply nickname
  const fullName = getLocalizedCourseName(lesson, language);
  const baseOnly = fullName.split(' - ')[0];
  const nickname = useAppStore((state) => state.courseNicknames?.[lesson.courseCode || '']);
  const baseName = useCourseName(lesson.courseCode, baseOnly);
  const courseName = lesson.isExam
    ? `${baseName} - ${getExamSectionName(fullName)}`
    : nickname
      ? baseName
      : fullName;
  const room = getLocalizedRoom(lesson, language);

  // Determine event type and colors using workspace tokens
  const getEventStyles = () => {
    // Card backgrounds are fixed light tints (exam/lecture/seminar-bg) that do
    // NOT follow the active DaisyUI theme, so the foreground must be a fixed dark
    // color too — using text-base-content turns the text near-white on the
    // default dark theme, making cards render blank/white.
    if (lesson.isExam) {
      return {
        bg: 'bg-exam-bg/85',
        border: 'border-l-exam-border',
        outerBorder: 'border-exam-border/30',
        text: 'text-exam-text',
      };
    } else if (lesson.isSeminar === 'true') {
      return {
        bg: 'bg-seminar-bg/85',
        border: 'border-l-seminar-border',
        outerBorder: 'border-seminar-border/30',
        text: 'text-seminar-text',
      };
    } else {
      return {
        bg: 'bg-lecture-bg/85',
        border: 'border-l-lecture-border',
        outerBorder: 'border-lecture-border/30',
        text: 'text-lecture-text',
      };
    }
  };

  const styles = getEventStyles();

  // For exams: show the section name (e.g. "Průběžný test 2")
  // For others: show the full course name
  const isCompact = (lesson.maxColumns ?? 1) > 1;
  const compactCode = lesson.courseCode
    ? lesson.courseCode.includes('-')
      ? lesson.courseCode.split('-').slice(1).join('-')
      : lesson.courseCode
    : courseName;
  const courseTitle =
    isCompact && !lesson.isExam
      ? compactCode
      : lesson.isExam
        ? getExamSectionName(courseName)
        : courseName;

  return (
    <div
      className={`h-full mx-1 rounded cursor-pointer group
                        ${styles.bg} border ${styles.outerBorder} border-l-4 ${styles.border} relative`}
      onClick={onClick}
      title={`${courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${room}\n${lesson.teachers[0]?.shortName || ''}`}
    >
      {/* Deadline countdown badge */}
      {timeline && timeline.weeksLeft <= 4 && !lesson.isExam && (
        <div
          className={`absolute top-1.5 right-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold z-10 group-hover:opacity-0 transition-opacity ${
            timeline.weeksLeft === 0
              ? 'bg-error/15 text-error'
              : timeline.weeksLeft <= 2
                ? 'bg-warning/15 text-warning'
                : 'bg-info/15 text-info'
          }`}
        >
          <Timer size={10} />
          <span>{timeline.short}</span>
        </div>
      )}
      {/* Quick Hide Action (custom event actions disabled until feature ships) */}
      {!lesson.isCustom && !lesson.isExam && !isCompact && (
        <div
          className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dropdown dropdown-end">
            <div
              tabIndex={0}
              role="button"
              className="btn btn-ghost btn-xs btn-circle bg-base-100/50 hover:bg-base-100 shadow-sm"
            >
              <EyeOff size={14} className="text-base-content/70" />
            </div>
            <ul
              tabIndex={0}
              className="dropdown-content z-[100] menu p-1 shadow-xl bg-base-100 border border-base-300 rounded-lg w-52 text-xs font-medium mt-1"
            >
              <li className="menu-title px-2 py-1 text-[10px] opacity-40 uppercase tracking-widest border-b border-base-200 mb-1 line-clamp-2 whitespace-normal leading-tight">
                {baseName}
              </li>
              <li>
                <button onClick={handleHideOccurrence} className="flex items-center gap-2 py-2">
                  <Calendar size={14} />
                  {t('calendar.hide.occurrence')}
                </button>
              </li>
              <li>
                <button onClick={handleHideType} className="flex items-center gap-2 py-2">
                  <CalendarRange size={14} />
                  {lesson.isSeminar === 'true'
                    ? t('calendar.hide.seminars')
                    : t('calendar.hide.lectures')}
                </button>
              </li>
              <div className="h-px bg-base-300 my-1 opacity-50" />
              <li>
                <button onClick={handleHideAll} className="flex items-center gap-2 py-2 opacity-70">
                  <EyeOff size={14} />
                  {t('calendar.hide.allLessons')}
                </button>
              </li>
            </ul>
          </div>
        </div>
      )}
      <div className="p-2 h-full flex flex-col text-sm overflow-hidden font-inter">
        {/* Course title - always visible. Fixed near-black (content-primary)
                    rather than the colored type token, so the title reads black on the
                    light green/blue/red card tints regardless of theme. */}
        <div
          className={`font-semibold text-content-primary flex-shrink-0 truncate ${!lesson.isExam && !isCompact ? 'pr-8' : ''}`}
        >
          {courseTitle}
        </div>
        {/* Additional course info - only for longer events */}
        {isLongEnough && lesson.isExam && !isCompact && (
          <div className="text-exam-text font-medium text-xs flex-shrink-0 truncate">
            {courseName.split(' - ')[0]}
          </div>
        )}

        {/* Bottom row - Location and Time, pushed to bottom */}
        {isLongEnough && (
          <div className="text-content-secondary text-sm mt-auto flex-shrink-0 flex items-center justify-between gap-2">
            {room && !isCompact && (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                <MapPin size={12} className="flex-shrink-0" />
                {/* No "show on map" button here. A calendar block is minutes
                    tall and already carries the course, the room and the time;
                    a third control spelled out as a sentence pushed the row
                    past the block at every width. The room is still reachable
                    on the map from the subject drawer. */}
                <span className="truncate">{room}</span>
              </div>
            )}
            <div className="text-content-secondary whitespace-nowrap flex-shrink-0">
              {isCompact ? lesson.startTime : `${lesson.startTime} - ${lesson.endTime}`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
