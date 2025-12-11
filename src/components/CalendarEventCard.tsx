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

// Clean exam/test name - extract just the test type name
function cleanExamTitle(title: string): string {
    // Remove patterns like "ZS 2025/2026 - PEF - " or "LS 2024/2025 - PEF - "
    return title.replace(/^[ZL]S\s*\d{4}\/\d{4}\s*-\s*[A-Z]+\s*-\s*/i, '').trim();
}

// Extract short code from exam courseCode (e.g., "Algoritmizace-průběžný-test-2" -> "ALG")
function getExamShortCode(courseCode: string): string {
    // Try to extract a 3-letter code from the beginning
    const match = courseCode.match(/^([A-Za-z]+)/);
    if (match) {
        const code = match[1].toUpperCase();
        // Return first 3-4 letters as abbreviation
        return code.substring(0, Math.min(4, code.length));
    }
    return courseCode.substring(0, 4).toUpperCase();
}

export function CalendarEventCard({ lesson, onClick }: CalendarEventCardProps) {
    const duration = calculateDuration(lesson.startTime, lesson.endTime);
    const isLongEnough = duration >= 60; // Only show location if event is 1 hour+

    // Determine event type and colors using workspace tokens
    const getEventStyles = () => {
        if (lesson.isExam) {
            return {
                bg: 'bg-exam-bg/90',
                border: 'border-l-exam-border',
                text: 'text-gray-900',
            };
        } else if (lesson.isSeminar === 'true') {
            // Seminars/exercises use lecture colors (blue)
            return {
                bg: 'bg-lecture-bg/90',
                border: 'border-l-lecture-border',
                text: 'text-gray-900',
            };
        } else {
            // Lectures use seminar colors (green)
            return {
                bg: 'bg-seminar-bg/90',
                border: 'border-l-seminar-border',
                text: 'text-gray-900',
            };
        }
    };

    const styles = getEventStyles();

    // For exams: show short code like "ALGO", for others: show full course code
    const displayCode = lesson.isExam
        ? getExamShortCode(lesson.courseCode)
        : lesson.courseCode;

    // Clean the course name for exams
    const courseTitle = lesson.isExam
        ? cleanExamTitle(lesson.courseName)
        : lesson.courseName;

    // Check if it's a test (not a full exam)
    const isTest = lesson.isExam && (
        courseTitle.toLowerCase().includes('test') ||
        courseTitle.toLowerCase().includes('zápočtový')
    );

    return (
        <div
            className={`h-full mx-1 rounded overflow-hidden cursor-pointer 
                        ${styles.bg} border-l-4 ${styles.border}`}
            onClick={onClick}
            title={`${courseTitle}\n${lesson.startTime} - ${lesson.endTime}\n${lesson.room}\n${lesson.teachers[0]?.shortName || ''}`}
        >
            <div className="p-2 h-full flex flex-col text-sm overflow-hidden font-inter">
                {/* Course code - always visible */}
                <div className={`font-bold ${styles.text} flex-shrink-0`}>
                    {displayCode}
                </div>

                {/* Course title - only for longer events */}
                {isLongEnough && courseTitle && (
                    <div className={`${styles.text} break-words line-clamp-2 flex-shrink-0`}>
                        {courseTitle}
                    </div>
                )}

                {/* Test/Exam indicator - without emoji for cleaner look */}
                {lesson.isExam && (
                    <div className="mt-1 text-xs font-bold text-exam-text uppercase tracking-wide flex-shrink-0">
                        {isTest ? 'TEST' : 'ZKOUŠKA'}
                    </div>
                )}

                {/* Location - only for longer events, pushed to bottom */}
                {isLongEnough && lesson.room && (
                    <div className="text-gray-600 text-sm mt-auto flex-shrink-0 flex items-center gap-1">
                        <MapPin size={12} className="flex-shrink-0" />
                        {lesson.room}
                    </div>
                )}
            </div>
        </div>
    );
}
