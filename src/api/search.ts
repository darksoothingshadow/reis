import { sanitizeString, validateUrl } from '../utils/validation';

export interface Person {
    id: string | null;
    name: string;
    link: string;
    faculty: string; // The primary faculty or department
    programAndMode: string; // Additional details or roles
    status: string; // e.g., "Student", "Staff", or academic term
    rawDetails: string; // The full, unparsed details
    type: 'student' | 'teacher' | 'staff' | 'unknown';
}

/**
 * Parses HTML from MENDELU to find person data.
 * It handles multi-result list pages, single-person profile pages, and no-result pages.
 *
 * @param {string} htmlString The raw HTML from the server.
 * @returns {Array<Person>} An array of person objects.
 */
export function parseMendeluResults(htmlString: string): Person[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    // --- Case 1: Check for the multi-result list page ---
    const personLinks = doc.querySelectorAll("a[href*='clovek.pl?zpet=']");
    if (personLinks.length > 0) {
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

            // Classification logic
            // Students usually have [term X, year Y] or [ročník X] in their status/details
            // Staff usually have titles like Ing., Ph.D., doc., prof., etc. in their name
            const hasStudentIndicators = rawDetails.includes('[') && (
                rawDetails.includes('term') ||
                rawDetails.includes('year') ||
                rawDetails.includes('ročník') ||
                rawDetails.includes('sem')
            );

            // Check for study program indicators (pres = full-time, komb = part-time)
            // Also check for explicit Czech study types since we force lang=cz
            const hasStudyProgramIndicators =
                rawDetails.includes(' pres ') ||
                rawDetails.includes(' komb ') ||
                rawDetails.includes('Bachelor') ||
                rawDetails.includes('Master') ||
                rawDetails.includes('Bakalářský typ studia') ||
                rawDetails.includes('Magisterský typ studia') ||
                rawDetails.includes('Doktorský typ studia') ||
                rawDetails.includes('prezenční forma') ||
                rawDetails.includes('kombinovaná forma') ||
                rawDetails.includes('Univerzita třetího věku') ||
                rawDetails.includes('Celoživotní vzdělávání') ||
                rawDetails.includes('U3V');

            // Prioritize student enrollment indicators over academic titles
            // If someone has active enrollment info (pres, komb, term, year), they're a student
            const isStudent = hasStudentIndicators || hasStudyProgramIndicators;

            let type: 'student' | 'teacher' | 'staff' = 'staff';
            if (isStudent) {
                type = 'student';
            } else if (
                // Teacher classification based on titles in name (Same as Case 2)
                name.toLowerCase().includes('ph.d.') ||
                name.toLowerCase().includes('csc.') ||
                name.toLowerCase().includes('drsc.') ||
                name.toLowerCase().includes('dr.') || // Matches RNDr., PhDr., JUDr., etc.
                name.toLowerCase().includes('doc.') ||
                name.toLowerCase().includes('prof.') ||
                name.toLowerCase().includes('th.d.')
            ) {
                type = 'teacher';
            } else {
                type = 'staff';
            }

            // Add ;lang=cz to the link
            let personLink = baseUrl + href;
            if (!personLink.includes('lang=')) {
                personLink += ';lang=cz';
            }

            // Sanitize and validate extracted data
            const sanitizedName = sanitizeString(name, 200);
            const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

            if (!sanitizedName) {
                return null;
            }

            return {
                id,
                name: sanitizedName,
                link: validatedLink || personLink, // Fall back to original if validation fails
                faculty: sanitizeString(faculty, 100),
                programAndMode: sanitizeString(programAndMode, 200),
                status: sanitizeString(status, 100),
                rawDetails: sanitizeString(rawDetails, 500),
                type
            };
        }).filter(person => person !== null) as Person[];
    }

    // --- Case 2: Check for a single-person profile page (using your helpful snippet) ---
    // We look for a unique element on that page, like the name in the big font.
    const nameElement = doc.querySelector('td.odsazena b font[size="+1"]');
    if (nameElement) {
        const name = nameElement.textContent?.trim() ?? 'Unknown Name';
        let id: string | null = null;
        const allTds = doc.querySelectorAll('td.odsazena');

        // Find the TD with the identification number to extract the ID
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

        // Check for student program information (bold program names and their details)
        allTds.forEach(td => {
            const text = td.textContent ?? '';
            // Look for program info like "FBE B-F pres [term 3, year 2]"
            if (text.includes(' pres ') || text.includes(' komb ') ||
                text.includes('[term') || text.includes('[year') ||
                text.includes('Bachelor') || text.includes('Master')) {
                infoLines.push(text.trim());
            }
        });

        const rawDetails = infoLines.join('\n');

        // Apply same classification logic as Case 1
        const hasStudentIndicators = rawDetails.includes('[') && (
            rawDetails.includes('term') ||
            rawDetails.includes('year') ||
            rawDetails.includes('ročník') ||
            rawDetails.includes('sem')
        );

        const hasStudyProgramIndicators =
            rawDetails.includes(' pres ') ||
            rawDetails.includes(' komb ') ||
            rawDetails.includes('Bachelor') ||
            rawDetails.includes('Master') ||
            rawDetails.includes('Bakalářský typ studia') ||
            rawDetails.includes('Magisterský typ studia') ||
            rawDetails.includes('Doktorský typ studia') ||
            rawDetails.includes('prezenční forma') ||
            rawDetails.includes('kombinovaná forma') ||
            rawDetails.includes('Univerzita třetího věku') ||
            rawDetails.includes('Celoživotní vzdělávání') ||
            rawDetails.includes('U3V');

        // Prioritize student enrollment indicators over academic titles
        // If someone has active enrollment info (pres, komb, term, year), they're a student
        const isStudent = hasStudentIndicators || hasStudyProgramIndicators;

        let type: 'student' | 'teacher' | 'staff' = 'staff';
        if (isStudent) {
            type = 'student';
        } else if (
            // Teacher classification based on titles in name
            // User rule: "vyučující are gonna have ph.d., dr., rndr. prof. atd."
            // "the rest which has ext ... or mgr. should not be classified as teacher"
            name.toLowerCase().includes('ph.d.') ||
            name.toLowerCase().includes('csc.') ||
            name.toLowerCase().includes('drsc.') ||
            name.toLowerCase().includes('dr.') || // Matches RNDr., PhDr., JUDr., etc.
            name.toLowerCase().includes('doc.') ||
            name.toLowerCase().includes('prof.') ||
            name.toLowerCase().includes('th.d.')
        ) {
            type = 'teacher';
        } else {
            type = 'staff';
        }

        // Add ;lang=cz to the link
        let personLink = id ? `${baseUrl}clovek.pl?id=${id}` : '';
        if (personLink && !personLink.includes('lang=')) {
            personLink += ';lang=cz';
        }

        // Sanitize and validate single person data
        const sanitizedName = sanitizeString(name, 200);
        const validatedLink = validateUrl(personLink, 'is.mendelu.cz');

        if (!sanitizedName) {
            return [];
        }

        return [{
            id: id,
            name: sanitizedName,
            link: validatedLink || personLink,
            faculty: sanitizeString(infoLines.length > 0 ? infoLines[0] : 'N/A', 100),
            programAndMode: isStudent ? 'Student Profile' : 'Staff Profile',
            status: isStudent ? 'Student' : 'Staff',
            rawDetails: sanitizeString(rawDetails, 500),
            type: type
        }];
    }

    // --- Case 3: No results found on either page type ---
    return [];
}

export async function searchPeople(personName: string): Promise<Person[]> {
    const formData = new URLSearchParams();
    formData.append('vzorek', personName);
    // Only search for people
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
            credentials: 'include', // Important for maintaining session/auth
        });

        const html = await response.text();
        return parseMendeluResults(html);
    } catch (error) {
        console.error('Error searching for person:', error);
        return [];
    }
}
