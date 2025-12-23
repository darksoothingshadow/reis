import { parseExamData } from "../utils/examParser";
import type { ExamSubject } from "../types/exams";
import { fetchWithAuth } from "./client";
import { getUserParams } from "../utils/userParams";
import { loggers } from "../utils/logger";

/**
 * Result of exam registration/unregistration.
 * Includes success status and optional error message for UI feedback.
 */
export interface ExamActionResult {
    success: boolean;
    error?: string;
}

/**
 * Build exam list URL dynamically using user's studium.
 * Removed hardcoded studium that only worked for one user.
 */
async function getExamListUrl(): Promise<string> {
    const params = await getUserParams();
    if (!params?.studium) {
        loggers.api.warn('[exams] No studium available, using base URL');
        return 'https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz';
    }
    return `https://is.mendelu.cz/auth/student/terminy_seznam.pl?studium=${params.studium};lang=cz`;
}

/**
 * Check if HTML response indicates successful registration.
 * IS MENDELU shows the term in table_1 (registered) after success.
 */
function verifyRegistrationSuccess(html: string, termId: string): boolean {
    // After successful registration, the term should appear in registered table
    // Check for the term ID in unregister links (confirms registration)
    const hasUnregisterLink = html.includes(`termin=${termId}`) && html.includes('odhlasit_ihned=1');
    
    // Also check for common error patterns
    const hasError = html.includes('Termín je již plný') || 
                     html.includes('nelze přihlásit') ||
                     html.includes('Chyba');
    
    loggers.api.debug('[exams] Verification:', { termId, hasUnregisterLink, hasError });
    return hasUnregisterLink && !hasError;
}

export async function fetchExamData(): Promise<ExamSubject[]> {
    try {
        const url = await getExamListUrl();
        loggers.api.info('[exams] Fetching from:', url);
        const response = await fetchWithAuth(url);
        const html = await response.text();
        const data = parseExamData(html);
        return data;
    } catch (error) {
        console.error("Error fetching exam data:", error);
        return [];
    }
}

export async function registerExam(termId: string): Promise<ExamActionResult> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            loggers.api.error('[exams] Cannot register: no studium available');
            return { success: false, error: 'Chybí údaje o studiu. Zkuste obnovit stránku.' };
        }
        
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};obdobi=${params.obdobi};prihlasit_ihned=1;lang=cz`;
        loggers.api.info('[exams] Registering:', url);
        
        const response = await fetchWithAuth(url);
        const html = await response.text();
        
        // Verify the registration actually worked
        if (verifyRegistrationSuccess(html, termId)) {
            loggers.api.info('[exams] Registration verified for term:', termId);
            return { success: true };
        }
        
        // Check for specific error messages
        if (html.includes('Termín je již plný')) {
            return { success: false, error: 'Termín je již plný.' };
        }
        if (html.includes('nelze přihlásit')) {
            return { success: false, error: 'Na tento termín se nelze přihlásit.' };
        }
        
        // Generic failure
        loggers.api.warn('[exams] Registration could not be verified for term:', termId);
        return { success: false, error: 'Registrace se nepodařila ověřit. Zkontrolujte v IS.' };
        
    } catch (error) {
        console.error("Error registering for exam:", error);
        return { success: false, error: 'Chyba připojení. Zkuste to znovu.' };
    }
}

export async function unregisterExam(termId: string): Promise<ExamActionResult> {
    try {
        const params = await getUserParams();
        if (!params?.studium) {
            loggers.api.error('[exams] Cannot unregister: no studium available');
            return { success: false, error: 'Chybí údaje o studiu. Zkuste obnovit stránku.' };
        }
        
        const url = `https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=${termId};studium=${params.studium};obdobi=${params.obdobi};odhlasit_ihned=1;lang=cz`;
        loggers.api.info('[exams] Unregistering:', url);
        
        await fetchWithAuth(url);
        
        // Assume success if no HTTP error
        loggers.api.info('[exams] Unregistration completed for term:', termId);
        return { success: true };
        
    } catch (error) {
        console.error("Error unregistering from exam:", error);
        return { success: false, error: 'Chyba připojení. Zkuste to znovu.' };
    }
}
