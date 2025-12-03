export interface Teacher {
    fullName: string;
    shortName: string;
    id: string;
}

export interface RoomStructured {
    name: string;
    id: string;
}

export interface BlockLesson {
    date: string; // YYYYMMDD
    isConsultation: string;
    room: string;
    roomStructured: RoomStructured;
    studyId: string;
    endTime: string; // HH:MM
    facultyCode: string;
    id: string;
    startTime: string; // HH:MM
    isDefaultCampus: string;
    courseId: string;
    courseName: string;
    campus: string;
    isSeminar: string;
    teachers: Teacher[];
    courseCode: string;
    periodId: string;
}

export interface ScheduleData {
    blockLessons: BlockLesson[];
}
