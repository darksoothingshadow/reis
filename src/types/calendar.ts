export interface CalendarEvent {
    id: string;
    subjectCode: string;
    subjectName: string;
    startTime: string;
    endTime: string;
    room: string;
    day: number; // 0-6 (Monday=0, Sunday=6)
    type: 'lecture' | 'exercise';
    teacher?: string;
    color?: string;
}
