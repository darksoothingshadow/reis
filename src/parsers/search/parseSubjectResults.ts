/**
 * Parse Subject Results
 * 
 * Extracts subject information from global search HTML.
 */

import { sanitizeString } from '../../utils/validation';
import { parseHtml } from '../domHelpers';
import type { Subject } from './types';

const BASE_URL = 'https://is.mendelu.cz/auth/';

// Pattern for subject code: uppercase letters, optionally with numbers, followed by dash
// Examples: EBC-TZI, ASVP, D-BINFO, EDA-AJI
const CODE_PATTERN = /^([A-Z][A-Z0-9-]*[A-Z0-9])\s+(.+)$/;

/**
 * Parse subject results from global search HTML.
 * Extracts subject links from SEARCH RESULTS only (not sidebar).
 */
export function parseSubjectResults(htmlString: string): Subject[] {
    console.log('[parseSubjectResults] Starting parse, HTML length:', htmlString.length);
    const doc = parseHtml(htmlString);

    const subjects: Subject[] = [];
    const seenIds = new Set<string>();

    // Find all subject links
    const subjectLinks = doc.querySelectorAll('a[href*="katalog/syllabus.pl"]');
    console.log('[parseSubjectResults] Found', subjectLinks.length, 'total syllabus links');

    subjectLinks.forEach((link, index) => {
        const href = link.getAttribute('href') ?? '';
        const fullText = link.textContent?.trim() ?? '';

        // Extract predmet ID from URL
        const idMatch = href.match(/predmet=(\d+)/);
        const id = idMatch ? idMatch[1] : '';

        if (!id || !fullText) {
            return;
        }

        // Check if this looks like a search result (has code prefix)
        const codeMatch = fullText.match(CODE_PATTERN);
        if (!codeMatch) {
            console.log(`[parseSubjectResults] Link ${index}: Skipping - no code prefix (likely sidebar)`);
            return;
        }

        const code = codeMatch[1];
        const name = codeMatch[2];

        // Skip duplicates
        if (seenIds.has(id)) {
            return;
        }
        seenIds.add(id);

        // Extract faculty and semester from text after link
        const nextText = link.nextSibling?.textContent ?? '';

        const semesterMatch = nextText.match(/(ZS|LS)\s+\d{4}\/\d{4}/);
        const semester = semesterMatch ? semesterMatch[0] : '';

        const facultyMatch = nextText.match(/- ([A-Z]{2,5})$/);
        const faculty = facultyMatch ? facultyMatch[1] : 'N/A';

        // Get faculty color from preceding span
        const prevElement = link.previousElementSibling as HTMLElement;
        const colorStyle = prevElement?.getAttribute?.('style') ?? '';
        const colorMatch = colorStyle.match(/background-color:\s*(#[a-fA-F0-9]{6})/);
        const facultyColor = colorMatch ? colorMatch[1] : 'var(--color-base-content-400, #6b7280)';

        // Build absolute URL
        let subjectLink = href.startsWith('../') 
            ? BASE_URL + href.replace('../', '') 
            : BASE_URL + href;
        if (!subjectLink.includes('lang=')) {
            subjectLink += ';lang=cz';
        }

        subjects.push({
            id,
            code: sanitizeString(code, 50),
            name: sanitizeString(name, 200),
            link: subjectLink,
            faculty: sanitizeString(faculty, 20),
            facultyColor,
            semester
        } as Subject);
    });

    console.log('[parseSubjectResults] Final result:', subjects.length, 'unique subjects');
    return subjects;
}
