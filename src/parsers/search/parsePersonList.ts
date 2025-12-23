/**
 * Parse Mendelu Results (People Search)
 * 
 * Handles multi-result list pages, single-person profile pages, and no-result pages.
 */

import { sanitizeString, validateUrl } from '../../utils/validation';
import { parseHtml } from '../domHelpers';
import type { Person } from './types';
import { classifyPersonType, isStudentFromDetails } from './types';

const BASE_URL = 'https://is.mendelu.cz/auth/lide/';

/**
 * Parse people results from a MENDELU person search.
 * Handles both list pages and single-person profile pages.
 */
export function parseMendeluResults(htmlString: string): Person[] {
    console.debug('[parseMendeluResults] Starting parse, HTML length:', htmlString.length);
    const doc = parseHtml(htmlString);

    // --- Case 1: Check for the multi-result list page ---
    const personLinks = doc.querySelectorAll("a[href*='clovek.pl?zpet=']");
    console.debug('[parseMendeluResults] Case 1 check: found', personLinks.length, 'person links');

    if (personLinks.length > 0) {
        return parseListPage(personLinks);
    }

    // --- Case 2: Check for a single-person profile page ---
    const nameElement = doc.querySelector('td.odsazena b font[size="+1"]');
    console.debug('[parseMendeluResults] Case 2 check: found name element?', !!nameElement);

    if (nameElement) {
        return parseProfilePage(doc, nameElement);
    }

    // --- Case 3: No results found ---
    console.debug('[parseMendeluResults] No results found (Case 3)');
    return [];
}

/**
 * Parse a multi-result list page.
 */
function parseListPage(personLinks: NodeListOf<Element>): Person[] {
    return Array.from(personLinks).map(link => {
        const name = link.textContent?.trim() ?? 'Unknown Name';
        const href = link.getAttribute('href') ?? '';
        const idMatch = href.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;

        const detailsNode = link.nextSibling;
        const rawDetails = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : 'No details';

        const statusMatch = rawDetails.match(/\[(.*?)\]$/);
        const status = statusMatch ? statusMatch[1].trim() : 'N/A';
        const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
        const parts = primaryInfo.split(/\s+/);
        const faculty = parts[0] ?? 'N/A';
        const programAndMode = parts.slice(1).join(' ');

        const type = classifyPersonType(name, rawDetails);

        // Build link with lang=cz
        let personLink = BASE_URL + href;
        if (!personLink.includes('lang=')) {
            personLink += ';lang=cz';
        }

        const sanitizedName = sanitizeString(name, 200);
        const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

        if (!sanitizedName) {
            return null;
        }

        return {
            id,
            name: sanitizedName,
            link: validatedLink || personLink,
            faculty: sanitizeString(faculty, 100),
            programAndMode: sanitizeString(programAndMode, 200),
            status: sanitizeString(status, 100),
            rawDetails: sanitizeString(rawDetails, 500),
            type
        };
    }).filter(person => person !== null) as Person[];
}

/**
 * Parse a single-person profile page.
 */
function parseProfilePage(doc: Document, nameElement: Element): Person[] {
    const name = nameElement.textContent?.trim() ?? 'Unknown Name';
    let id: string | null = null;
    const allTds = doc.querySelectorAll('td.odsazena');

    // Find the TD with the identification number
    allTds.forEach(td => {
        const text = td.textContent ?? '';
        if (text.includes('Identification number:')) {
            const idMatch = text.match(/Identification number:\s*(\d+)/);
            if (idMatch) {
                id = idMatch[1];
            }
        }
    });

    // Collect all roles, departments, and student program information
    const infoLines: string[] = [];

    // Check for staff roles (department links)
    const departmentLinks = doc.querySelectorAll("a[href*='pracoviste.pl']");
    departmentLinks.forEach(link => {
        infoLines.push(link.parentElement?.textContent?.trim() ?? '');
    });

    // Check for student program information
    allTds.forEach(td => {
        const text = td.textContent ?? '';
        if (text.includes(' pres ') || text.includes(' komb ') ||
            text.includes('[term') || text.includes('[year') ||
            text.includes('Bachelor') || text.includes('Master')) {
            infoLines.push(text.trim());
        }
    });

    const rawDetails = infoLines.join('\n');
    const isStudent = isStudentFromDetails(rawDetails);
    const type = classifyPersonType(name, rawDetails);

    // Build link with lang=cz
    let personLink = id ? `${BASE_URL}clovek.pl?id=${id}` : '';
    if (personLink && !personLink.includes('lang=')) {
        personLink += ';lang=cz';
    }

    const sanitizedName = sanitizeString(name, 200);
    const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

    if (!sanitizedName) {
        return [];
    }

    return [{
        id,
        name: sanitizedName,
        link: validatedLink || personLink,
        faculty: sanitizeString(infoLines.length > 0 ? infoLines[0] : 'N/A', 100),
        programAndMode: isStudent ? 'Student Profile' : 'Staff Profile',
        status: isStudent ? 'Student' : 'Staff',
        rawDetails: sanitizeString(rawDetails, 500),
        type
    }];
}
