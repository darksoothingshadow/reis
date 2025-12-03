export interface CalendarSubject {
    day: string;
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    subjectCode: string;
    faculty: string;
    type: string;
    room: string;
    teacher: string;
}

export interface Teacher {
    fullName: string;
    shortName: string;
    id: string,
}

export interface RoomStructured {
    name: string;
    id: string;
}

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
    isExam?: boolean;
    examEvent?: any; // Using any for now to avoid circular dependency or complex imports, or I can import ExamEvent
}

export interface FileObject {
    subfolder: string;
    file_name: string;
    file_comment: string;
    author: string;
    date: string;
    files: {
        name: string;
        type: string;
        link: string;
    }[];
}

export interface StoredSubject {
    fullName: string;
    folderUrl: string;
    // Add other properties if needed based on usage
}

export interface ScheduleData {
    blockLessons: BlockLesson[];
}

export interface LessonWithRow extends BlockLesson {
    row: number;
}

export interface OrganizedLessons {
    lessons: LessonWithRow[];
    totalRows: number;
}

export interface DateInfo {
    weekday: string;
    day: string;
    month: string;
    year: string;
    full: string;
}
