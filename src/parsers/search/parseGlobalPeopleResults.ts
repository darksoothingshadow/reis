/**
 * Parse Global People Results
 * 
 * Parses people from the global search page (different link patterns from people-only search).
 */

import { sanitizeString } from '../../utils/validation';
import { parseHtml } from '../domHelpers';
import type { Person } from './types';
import { classifyPersonType } from './types';

const BASE_URL = 'https://is.mendelu.cz/auth/lide/';

/**
 * Parse people results from global search HTML.
 * Uses different link patterns than parseMendeluResults.
 */
export function parseGlobalPeopleResults(htmlString: string): Person[] {
    console.log('[parseGlobalPeopleResults] Starting parse');
    const doc = parseHtml(htmlString);

    // Global search uses links like "../lide/clovek.pl?id=70606;lang=cz"
    const personLinks = doc.querySelectorAll('a[href*="lide/clovek.pl"]');
    console.log('[parseGlobalPeopleResults] Found', personLinks.length, 'person links');

    if (personLinks.length === 0) {
        return [];
    }

    const seen = new Set<string>();

    return Array.from(personLinks).map(link => {
        const name = link.textContent?.trim() ?? 'Unknown Name';
        const href = link.getAttribute('href') ?? '';
        const idMatch = href.match(/id=(\d+)/);
        const id = idMatch ? idMatch[1] : null;

        if (!id || seen.has(id)) return null;
        seen.add(id);

        const detailsNode = link.nextSibling;
        const rawDetails = detailsNode 
            ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' 
            : 'No details';

        const statusMatch = rawDetails.match(/\[(.*?)\]$/);
        const status = statusMatch ? statusMatch[1].trim() : 'N/A';
        const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
        const parts = primaryInfo.split(/\s+/);
        const faculty = parts[0] ?? 'N/A';
        const programAndMode = parts.slice(1).join(' ');

        const type = classifyPersonType(name, rawDetails);

        // Build link - handle both relative and absolute paths
        let personLink = href.startsWith('../') 
            ? BASE_URL + href.replace('../lide/', '') 
            : BASE_URL + href.replace('/auth/lide/', '');
        if (!personLink.includes('lang=')) {
            personLink += ';lang=cz';
        }

        const sanitizedName = sanitizeString(name, 200);
        if (!sanitizedName) return null;

        console.log(`[parseGlobalPeopleResults] Adding: ${sanitizedName} (${type})`);

        return {
            id,
            name: sanitizedName,
            link: personLink,
            faculty: sanitizeString(faculty, 100),
            programAndMode: sanitizeString(programAndMode, 200),
            status: sanitizeString(status, 100),
            rawDetails: sanitizeString(rawDetails, 500),
            type
        };
    }).filter(person => person !== null) as Person[];
}
