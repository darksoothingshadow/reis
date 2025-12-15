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

export interface Subject {
    id: string;
    code: string;        // e.g., "EBC-AIS"
    name: string;        // e.g., "Architektury informačních systémů"
    link: string;        // syllabus URL
    faculty: string;     // e.g., "PEF"
    facultyColor: string; // hex color for faculty badge
    semester: string;     // e.g., "ZS 2025/2026"
}

/**
 * Parses HTML from MENDELU to find person data.
 * It handles multi-result list pages, single-person profile pages, and no-result pages.
 *
 * @param {string} htmlString The raw HTML from the server.
 * @returns {Array<Person>} An array of person objects.
 */
export function parseMendeluResults(htmlString: string): Person[] {
    console.debug('[parseMendeluResults] Starting parse, HTML length:', htmlString.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    // --- Case 1: Check for the multi-result list page ---
    const personLinks = doc.querySelectorAll("a[href*='clovek.pl?zpet=']");
    console.debug('[parseMendeluResults] Case 1 check: found', personLinks.length, 'person links');
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
    console.debug('[parseMendeluResults] Case 2 check: found name element?', !!nameElement);
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
    console.debug('[parseMendeluResults] No results found (Case 3)');
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

/**
 * Parses subject results from the global search HTML.
 * Extracts subject links from SEARCH RESULTS only (not sidebar).
 * Search result links have format: "EBC-TZI Teoretické základy informatiky" (code + name)
 * Sidebar links have format: "Teoretické základy informatiky" (name only)
 */
export function parseSubjectResults(htmlString: string): Subject[] {
    console.log('[parseSubjectResults] Starting parse, HTML length:', htmlString.length);
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/";

    const subjects: Subject[] = [];
    const seenIds = new Set<string>(); // For deduplication

    // Find all subject links: a[href*="katalog/syllabus.pl"]
    // Search results use relative paths like "../katalog/syllabus.pl"
    // Sidebar uses absolute paths like "/auth/katalog/syllabus.pl"
    const subjectLinks = doc.querySelectorAll('a[href*="katalog/syllabus.pl"]');
    console.log('[parseSubjectResults] Found', subjectLinks.length, 'total syllabus links');

    // Pattern for subject code: uppercase letters, optionally with numbers, followed by dash
    // Examples: EBC-TZI, ASVP, D-BINFO, EDA-AJI
    const codePattern = /^([A-Z][A-Z0-9-]*[A-Z0-9])\s+(.+)$/;

    subjectLinks.forEach((link, index) => {
        const href = link.getAttribute('href') ?? '';
        const fullText = link.textContent?.trim() ?? '';

        console.log(`[parseSubjectResults] Link ${index}: href="${href.substring(0, 60)}", text="${fullText.substring(0, 60)}"`);

        // Extract predmet ID from URL: predmet=162392
        const idMatch = href.match(/predmet=(\d+)/);
        const id = idMatch ? idMatch[1] : '';

        if (!id) {
            console.log(`[parseSubjectResults] Link ${index}: Skipping - no predmet ID`);
            return;
        }
        if (!fullText) {
            console.log(`[parseSubjectResults] Link ${index}: Skipping - no text content`);
            return;
        }
        
        // Check if this looks like a search result (has code prefix)
        const codeMatch = fullText.match(codePattern);
        if (!codeMatch) {
            console.log(`[parseSubjectResults] Link ${index}: Skipping - no code prefix (likely sidebar)`);
            return;
        }
        
        const code = codeMatch[1];  // e.g., "EBC-TZI"
        const name = codeMatch[2];  // e.g., "Teoretické základy informatiky"
        
        // Skip duplicates
        if (seenIds.has(id)) {
            console.log(`[parseSubjectResults] Link ${index}: Skipping - duplicate ID ${id}`);
            return;
        }
        seenIds.add(id);

        // Extract faculty and semester from the text after the link
        // Format: " - ZS 2025/2026 - PEF" or " - LS 2024/2025 - AF"
        const nextText = link.nextSibling?.textContent ?? '';
        console.log(`[parseSubjectResults] Link ${index}: nextText="${nextText.substring(0, 50)}"`);
        
        // Match semester (e.g., "ZS 2025/2026" or "LS 2024/2025")
        const semesterMatch = nextText.match(/(ZS|LS)\s+\d{4}\/\d{4}/);
        const semester = semesterMatch ? semesterMatch[0] : '';
        
        // Match faculty - the last capitalized word before <br> or end
        // Pattern: " - AF" or " - PEF" at the end of the string
        const facultyMatch = nextText.match(/- ([A-Z]{2,5})$/);
        const faculty = facultyMatch ? facultyMatch[1] : 'N/A';

        // Get faculty color from the preceding span
        const prevElement = link.previousElementSibling as HTMLElement;
        const colorStyle = prevElement?.getAttribute?.('style') ?? '';
        const colorMatch = colorStyle.match(/background-color:\s*(#[a-fA-F0-9]{6})/);
        const facultyColor = colorMatch ? colorMatch[1] : '#6b7280';

        // Build absolute URL
        let subjectLink = href.startsWith('../') ? baseUrl + href.replace('../', '') : baseUrl + href;
        if (!subjectLink.includes('lang=')) {
            subjectLink += ';lang=cz';
        }

        console.log(`[parseSubjectResults] Link ${index}: Adding subject code="${code}" name="${name}"`);

        subjects.push({
            id,
            code: sanitizeString(code, 50),
            name: sanitizeString(name, 200),
            link: subjectLink,
            faculty: sanitizeString(faculty, 20),
            facultyColor,
            semester
        });
    });

    console.log('[parseSubjectResults] Final result:', subjects.length, 'unique subjects');
    return subjects;
}

/**
 * Parses people results from global search HTML.
 * Different from parseMendeluResults as it uses different link patterns.
 */
export function parseGlobalPeopleResults(htmlString: string): Person[] {
    console.log('[parseGlobalPeopleResults] Starting parse');
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    const baseUrl = "https://is.mendelu.cz/auth/lide/";

    // Global search uses links like "../lide/clovek.pl?id=70606;lang=cz"
    // Need to match both ../lide/clovek.pl and /auth/lide/clovek.pl patterns
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
        const rawDetails = detailsNode ? detailsNode.textContent?.trim().replace(/^-/, '').trim() ?? '' : 'No details';

        const statusMatch = rawDetails.match(/\[(.*?)\]$/);
        const status = statusMatch ? statusMatch[1].trim() : 'N/A';
        const primaryInfo = rawDetails.replace(statusMatch ? statusMatch[0] : '', '').trim();
        const parts = primaryInfo.split(/\s+/);
        const faculty = parts[0] ?? 'N/A';
        const programAndMode = parts.slice(1).join(' ');

        // Classification logic
        const hasStudentIndicators = rawDetails.includes('[') && (
            rawDetails.includes('term') ||
            rawDetails.includes('year') ||
            rawDetails.includes('ročník') ||
            rawDetails.includes('roč') ||
            rawDetails.includes('sem')
        );

        const hasStudyProgramIndicators =
            rawDetails.includes(' pres ') ||
            rawDetails.includes(' prez ') ||
            rawDetails.includes(' komb ') ||
            rawDetails.includes('Bachelor') ||
            rawDetails.includes('Master') ||
            rawDetails.includes('Bakalářský') ||
            rawDetails.includes('Magisterský') ||
            rawDetails.includes('Doktorský') ||
            rawDetails.includes('prezenční') ||
            rawDetails.includes('kombinovaná');

        const isStudent = hasStudentIndicators || hasStudyProgramIndicators;

        let type: 'student' | 'teacher' | 'staff' = 'staff';
        if (isStudent) {
            type = 'student';
        } else if (
            name.toLowerCase().includes('ph.d.') ||
            name.toLowerCase().includes('csc.') ||
            name.toLowerCase().includes('drsc.') ||
            name.toLowerCase().includes('dr.') ||
            name.toLowerCase().includes('doc.') ||
            name.toLowerCase().includes('prof.') ||
            name.toLowerCase().includes('th.d.')
        ) {
            type = 'teacher';
        }

        let personLink = href.startsWith('../') ? baseUrl + href.replace('../lide/', '') : baseUrl + href.replace('/auth/lide/', '');
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



/**
 * Global search that returns both people and subjects.
 * Uses the /auth/hledani/index.pl endpoint.
 * Falls back to people-only search if global search fails.
 */
export async function searchGlobal(query: string): Promise<{ people: Person[]; subjects: Subject[] }> {
    const formData = new URLSearchParams();
    formData.append('lang', 'cz');
    formData.append('vzorek', query);
    formData.append('vyhledat', 'Vyhledat');  // Submit button - required to trigger search!
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
        console.log('[searchGlobal] HTML contains predmety?', html.includes('predmety'));
        console.log('[searchGlobal] HTML contains katalog/syllabus?', html.includes('katalog/syllabus.pl'));
        console.log('[searchGlobal] First 500 chars of HTML:', html.substring(0, 500));
        
        const people = parseGlobalPeopleResults(html);
        console.log('[searchGlobal] Parsed people:', people.length);
        
        const subjects = parseSubjectResults(html);
        console.log('[searchGlobal] Parsed subjects:', subjects.length);

        return { people, subjects };
    } catch (error) {
        console.error('Error in global search, falling back to people-only:', error);
        // Fallback to old endpoint for people
        const people = await searchPeople(query);
        return { people, subjects: [] };
    }
}
