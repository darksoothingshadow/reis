/**
 * Search API
 * 
 * API functions for searching people and subjects on IS MENDELU.
 * Parser functions have been extracted to src/parsers/search/
 */

// Re-export types and parsers for backward compatibility
export type { Person, Subject } from '../parsers/search';
export { parseMendeluResults, parseSubjectResults, parseGlobalPeopleResults } from '../parsers/search';

/**
 * Search for people using the people-only endpoint.
 */
export async function searchPeople(personName: string): Promise<import('../parsers/search').Person[]> {
    const { parseMendeluResults } = await import('../parsers/search');
    
    const formData = new URLSearchParams();
    formData.append('vzorek', personName);
    formData.append('cokoliv', '0');
    formData.append('lide', '1');
    formData.append('pocet', '1000');

    try {
        const response = await fetch('https://is.mendelu.cz/auth/lide/index.pl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            credentials: 'include',
        });

        const html = await response.text();
        return parseMendeluResults(html);
    } catch (error) {
        console.error('Error searching for person:', error);
        return [];
    }
}

/**
 * Global search that returns both people and subjects.
 * Uses the /auth/hledani/index.pl endpoint.
 * Falls back to people-only search if global search fails.
 */
export async function searchGlobal(query: string): Promise<{ 
    people: import('../parsers/search').Person[]; 
    subjects: import('../parsers/search').Subject[] 
}> {
    const { parseGlobalPeopleResults, parseSubjectResults } = await import('../parsers/search');
    
    const formData = new URLSearchParams();
    formData.append('lang', 'cz');
    formData.append('vzorek', query);
    formData.append('vyhledat', 'Vyhledat');
    formData.append('oblasti', 'lide');
    formData.append('oblasti', 'predmety');
    formData.append('pocet', '50');

    try {
        console.log('[searchGlobal] Fetching from /auth/hledani/index.pl with query:', query);
        const response = await fetch('https://is.mendelu.cz/auth/hledani/index.pl', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData.toString(),
            credentials: 'include',
        });

        console.log('[searchGlobal] Response status:', response.status);
        const html = await response.text();
        console.log('[searchGlobal] HTML length:', html.length);

        const people = parseGlobalPeopleResults(html);
        console.log('[searchGlobal] Parsed people:', people.length);

        const subjects = parseSubjectResults(html);
        console.log('[searchGlobal] Parsed subjects:', subjects.length);

        return { people, subjects };
    } catch (error) {
        console.error('Error in global search, falling back to people-only:', error);
        const people = await searchPeople(query);
        return { people, subjects: [] };
    }
}
