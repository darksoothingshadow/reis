/**
 * CalendarEventCard - Event card component matching Figma design.
 * 
 * Uses workspace semantic colors (exam-*, lecture-*, seminar-*).
 * Renders with adaptive content based on event duration.
 * 
 * NOTE: This component fills its parent container. Positioning is handled by the parent.
 */

import { MapPin } from 'lucide-react';
import type { BlockLesson } from '../types/calendarTypes';

interface CalendarEventCardProps {
    lesson: BlockLesson;
    onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
}

// Calculate duration in minutes from time strings
function calculateDuration(startTime: string, endTime: string): number {
    const [startHours, startMinutes] = startTime.split(':').map(Number);
    const [endHours, endMinutes] = endTime.split(':').map(Number);
    return (endHours * 60 + endMinutes) - (startHours * 60 + startMinutes);
}

// Extract exam section name from the composite title
function getExamSectionName(courseName: string): string {
    // The format from WeeklyCalendar is `${subject.name} - ${section.name}`
    // We want to extract just the section name part
    const parts = courseName.split(' - ');
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return courseName;
}

export function CalendarEventCard({ lesson, onClick }: CalendarEventCardProps) {
    const duration = calculateDuration(lesson.startTime, lesson.endTime);
    const isLongEnough = duration >= 60; // Only show location if event is 1 hour+

    // Determine event type and colors using workspace tokens
    const getEventStyles = () => {
        if (lesson.isExam) {
            return {
                bg: 'bg-exam-bg/85',
                border: 'border-l-exam-border',
                text: 'text-gray-900',
            };
        } else if (lesson.isSeminar === 'true') {
            // Seminars/exercises use lecture colors (blue)
            return {
                bg: 'bg-lecture-bg/85',
                border: 'border-l-lecture-border',
                text: 'text-gray-900',
            };
        } else {
            // Lectures use seminar colors (green)
            return {
                bg: 'bg-seminar-bg/85',
                border: 'border-l-seminar-border',
                text: 'text-gray-900',
            };
        }
    };

    const styles = getEventStyles();

    // For exams: show the section name (e.g. "Průběžný test 2")
    // For others: show the full course name
    const courseTitle = lesson.isExam
        ? getExamSectionName(lesson.courseName)
        : lesson.courseName;

    return (
        <div
            className={`h-full mx-1 rounded overflow-hidden cursor-pointer 
                        ${styles.bg} border-l-4 ${styles.border}`}
            onClick={onClick}
            title={`${courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${lesson.room}\n${lesson.teachers[0]?.shortName || ''}`}
            data-testid="calendar-event-card"
        >
            <div className="p-2 h-full flex flex-col text-sm overflow-hidden font-inter">
                {/* Course title - always visible */}
                <div className={`font-semibold ${styles.text} flex-shrink-0 break-words line-clamp-2`}>
                    {courseTitle}
                </div>

                {/* Additional course info - only for longer events */}
                {isLongEnough && lesson.isExam && (
                    <div className="text-exam-text font-medium text-xs flex-shrink-0">
                        {lesson.courseName.split(' - ')[0]}
                    </div>
                )}

                {/* Bottom row - Location and Time, pushed to bottom */}
                {isLongEnough && (
                    <div className="text-gray-600 text-sm mt-auto flex-shrink-0 flex items-center justify-between gap-2">
                        {lesson.room && (
                            <div className="flex items-center gap-1 min-w-0 flex-1">
                                <MapPin size={12} className="flex-shrink-0" />
                                <span className="truncate">{lesson.room}</span>
                            </div>
                        )}
                        <div className="text-gray-500 whitespace-nowrap flex-shrink-0">
                            {lesson.startTime} - {lesson.endTime}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
