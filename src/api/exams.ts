import { parseExamData } from "../utils/examParser";
import type { ExamSubject } from "../components/ExamDrawer";
import { fetchWithAuth } from "./client";
import { getUserParams } from "../utils/userParams";

/**
 * Build exam list URL dynamically using user's studium.
 * Removed hardcoded studium that only worked for one user.
 */
async function getExamListUrl(): Promise<string> {
    const params = await getUserParams();
    if (!params?.studium) {
        console.warn('[exams] No studium available, using base URL');
        return 'https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz';
    }
    return `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${params.studium};lang=cz`;
}

export async function fetchExamData(): Promise<ExamSubject[]> {
    try {
        const url = await getExamListUrl();
        console.log('[exams] Fetching from:', url);
        const response = await fetchWithAuth(url);
        const html = await response.text();
        const data = parseExamData(html);
        return data;
    } catch (error) {
        console.error("Error fetching exam data:", error);
        return [];
    }
}

export async function registerExam(termId: string): Promise<boolean> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            console.error('[exams] Cannot register: no studium available');
            return false;
        }
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};prihlasit_ihned=1;lang=cz`;

        const response = await fetchWithAuth(url);
        void response;
        return true;
    } catch (error) {
        console.error("Error registering for exam:", error);
        return false;
    }
}

export async function unregisterExam(termId: string): Promise<boolean> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            console.error('[exams] Cannot unregister: no studium available');
            return false;
        }
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};odhlasit_ihned=1;lang=cz`;

        const response = await fetchWithAuth(url);
        void response;
        return true;
    } catch (error) {
        console.error("Error unregistering from exam:", error);
        return false;
    }
}


