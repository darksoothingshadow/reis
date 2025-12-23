export interface SubjectInfo {
    displayName: string;
    fullName: string;
    subjectCode: string;
    folderUrl: string;
    fetchedAt: string;
}

export interface SubjectsData {
    lastUpdated: string;
    data: Record<string, SubjectInfo>;
}

export interface FileAttachment {
    name: string;
    type: string;
    link: string;
}

export interface ParsedFile {
    subfolder: string;
    file_name: string;
    file_comment: string;
    author: string;
    date: string;
    files: FileAttachment[];
}

export interface GradeStats {
    A: number; B: number; C: number; D: number; E: number; F: number; FN: number;
}

export interface TermStats {
    term: string;
    grades: GradeStats;
    pass: number;
    fail: number;
}

export interface SemesterStats {
    semesterName: string; 
    semesterId: string;
    year: number;
    totalPass: number;
    totalFail: number;
    sourceUrl?: string; // Original IS MENDELU URL
    terms: TermStats[];
}

export interface SubjectSuccessRate {
    courseCode: string;
    stats: SemesterStats[];
    lastUpdated: string;
}

export interface SuccessRateData {
    lastUpdated: string; // Global sync timestamp
    data: Record<string, SubjectSuccessRate>; // Keyed by course code
}
