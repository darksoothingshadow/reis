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
