import { fetchWithAuth, BASE_URL } from "./client";
import type { SubjectInfo, SubjectsData } from "../types/documents";

const STUDENT_LIST_URL = `${BASE_URL}/auth/student/list.pl`;

export async function fetchSubjects(): Promise<SubjectsData | null> {
    try {
        const response = await fetchWithAuth(`${STUDENT_LIST_URL}?lang=cz`);
        const html = await response.text();
        const subjectsMap = parseSubjectFolders(html);
        return showFullSubjects(subjectsMap);
    } catch (error) {
        console.error("Failed to fetch subjects:", error);
        return null;
    }
}

function parseSubjectFolders(htmlString: string): Record<string, string> {
    const subjectMap: Record<string, string> = {};
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    const table = doc.querySelector('#tmtab_1');
    if (!table) return subjectMap;

    const subjectRows = table.querySelectorAll('tr.uis-hl-table');
    subjectRows.forEach((row) => {
        const subjectLinkElement = row.querySelector('a[href*="/auth/katalog/syllabus.pl"]');
        const folderLinkElement = row.querySelector('a[href*="../dok_server/slozka.pl"]');

        if (subjectLinkElement && folderLinkElement) {
            const subjectName = subjectLinkElement.textContent?.trim() || '';
            const relativeUrl = folderLinkElement.getAttribute('href') || '';
            const cleanUrl = relativeUrl.replace('../', '');
            const absoluteUrl = new URL(cleanUrl, `${BASE_URL}/auth/`).href;
            subjectMap[subjectName] = absoluteUrl;
        }
    });
    return subjectMap;
}

function extractSubjectCode(subjectName: string): string {
    return subjectName.split(" ")[0];
}

function showFullSubjects(subjectsObject: Record<string, string>): SubjectsData {
    const enrichedSubjects: Record<string, SubjectInfo> = {};
    for (const [fullName, folderUrl] of Object.entries(subjectsObject)) {
        const subjectCode = extractSubjectCode(fullName);
        const displayName = fullName.replace(/\s*\([^)]+\)\s*$/, '').trim();
        enrichedSubjects[subjectCode] = {
            displayName,
            fullName,
            subjectCode,
            folderUrl,
            fetchedAt: new Date().toISOString()
        };
    }
    return {
        lastUpdated: new Date().toISOString(),
        data: enrichedSubjects
    };
}
