import { loggers } from './logger';
import type { ExamSubject } from '../types/exams';

export function parseExamData(html: string): ExamSubject[] {
    loggers.parser.debug('[parseExamData] Starting parse, input length:', html.length);

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const subjectsMap = new Map<string, ExamSubject>();

    // Helper to get or create subject
    const getOrCreateSubject = (code: string, rawName: string) => {
        // Clean name: Remove "ZS 202X/202X - FACULTY" prefix/suffix
        // Example: "ZS 2025/2026 - PEF Algoritmizace" or "Algoritmizace ZS 2025/2026 - PEF"
        // Usually it's "ZS 2025/2026 - PEF <Name>"
        // Clean name: Remove "ZS 202X/202X - FACULTY" prefix/suffix
        // Example: "ZS 2025/2026 - PEF Algoritmizace"
        // Regex handles ZS/LS, year format, faculty code (letters), and following hyphen
        const name = rawName.replace(/^[ZL]S\s*\d{4}\/\d{4}\s*-\s*[A-Z]+\s*(-)?\s*/i, '').trim();

        if (!subjectsMap.has(code)) {
            subjectsMap.set(code, {
                id: code,
                name,
                code,
                sections: []
            });
        }
        return subjectsMap.get(code)!;
    };

    // Helper to get or create section within a subject
    const getOrCreateSection = (subject: ExamSubject, sectionName: string) => {
        let section = subject.sections.find(s => s.name === sectionName);
        if (!section) {
            section = {
                id: `${subject.id}-${sectionName.replace(/\s+/g, '-').toLowerCase()}`,
                name: sectionName,
                type: sectionName.toLowerCase().includes('zkouška') ? 'exam' : 'test',
                status: 'open',
                terms: []
            };
            subject.sections.push(section);
        }
        return section;
    };

    // 1. Parse Registered Terms (Table 1)
    const table1 = doc.querySelector('#table_1');
    loggers.parser.debug('[parseExamData] table_1 (registered terms) found:', !!table1);

    if (table1) {
        const rows = table1.querySelectorAll('tbody tr');
        loggers.parser.debug('[parseExamData] table_1 rows found:', rows.length);

        rows.forEach((row, rowIndex) => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 6) {
                loggers.parser.debug('[parseExamData] table_1 row', rowIndex, 'skipped: insufficient columns', cols.length);
                return;
            }

            // Standard indices (assuming hidden column is present)
            // 0: Hidden, 1: Num, 2: Code, 3: Name, 4: Period(Hidden), 5: Date, 6: Room, 7: Type, 8: Teacher

            // Dynamic detection: Find the column that looks like a date
            let dateIndex = -1;
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].textContent?.match(/\d{2}\.\d{2}\.\d{4}/)) {
                    dateIndex = i;
                    break;
                }
            }

            if (dateIndex === -1) {
                loggers.parser.debug('[parseExamData] table_1 row', rowIndex, 'skipped: no date column found');
                return;
            }

            // Indices shifted by -1 (assuming no hidden column 0, or previous assumption was off)
            // Was: Code=2, Name=3
            // Now: Code=1, Name=2
            const code = cols[1].textContent?.trim() || '';
            const name = cols[2].textContent?.trim() || '';

            const dateStr = cols[dateIndex].textContent?.trim() || '';
            const room = cols[dateIndex + 1]?.textContent?.trim() || '';
            const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
            const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';

            // Extract teacher ID from link
            const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
            let teacherId = '';
            if (teacherLink) {
                const href = teacherLink.getAttribute('href') || '';
                const match = href.match(/id=(\d+)/);
                if (match) teacherId = match[1];
            }

            // Clean up section name (remove newlines, extra spaces)
            const sectionName = sectionNameRaw.split('(')[0].trim();

            // Parse date and time
            const [datePart, timePart] = dateStr.split(' ');
            const date = datePart;
            const time = timePart;

            // Extract Term ID from unregister link
            const unregisterLink = row.querySelector('a[href*="odhlasit_ihned=1"]');
            let termId = '';
            if (unregisterLink) {
                const href = unregisterLink.getAttribute('href') || '';
                const match = href.match(/termin=(\d+)/);
                if (match) termId = match[1];
            }

            // Log for debugging Sidebar Title Issue
            loggers.parser.debug(`[parseExamData] T1 Row ${rowIndex}: Code='${code}', Name='${name}'`);

            // DEBUG: Log all columns to see what we are working with
            console.debug(`[parseExamData DEBUG] Row ${rowIndex} All Cols HTML:`, Array.from(cols).map(c => c.innerHTML));

            // Extract deregistration deadline from column with <br> separators
            // Header format: "Přihlašování od<br>Přihlašování do<br>Odhlašování do"
            // Value format: "--<br>DD.MM.YYYY HH:MM<br>DD.MM.YYYY HH:MM" (3 parts separated by <br>)
            // We specifically want parts[2] which is "Odhlašování do"
            let deregistrationDeadline: string | undefined;
            for (let i = 0; i < cols.length; i++) {
                const cellHtml = cols[i].innerHTML;
                // Look for columns with at least 2 <br> tags (indicating 3 parts)
                const brMatches = cellHtml.match(/<br\s*\/?>/gi);
                if (brMatches && brMatches.length >= 2) {
                    const parts = cellHtml.split(/<br\s*\/?>/i);
                    console.debug(`[parseExamData DEBUG] Row ${rowIndex} Col ${i} has ${parts.length} parts:`, parts);

                    // parts[2] should be "Odhlašování do" value
                    if (parts.length >= 3) {
                        const deadlineRaw = parts[2].replace(/<[^>]*>/g, '').trim();
                        console.debug(`[parseExamData DEBUG] Row ${rowIndex} Odhlašování do (parts[2]): '${deadlineRaw}'`);

                        if (deadlineRaw !== '--' && deadlineRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
                            deregistrationDeadline = deadlineRaw;
                            console.debug(`[parseExamData DEBUG] Row ${rowIndex} ✓ Valid deregistration deadline: '${deregistrationDeadline}'`);
                            break; // Found it, stop searching
                        }
                    }
                }
            }

            if (!deregistrationDeadline) {
                console.debug(`[parseExamData DEBUG] Row ${rowIndex} No deregistration deadline found`);
            }

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            section.status = 'registered';
            section.registeredTerm = {
                id: termId,
                date,
                time,
                room,
                teacher,
                teacherId,
                deregistrationDeadline
            };

            loggers.parser.debug('[parseExamData] table_1 parsed registered term:', code, sectionName, date, time);
        });
    }

    // 2. Parse Available Terms (Table 2)
    const table2 = doc.querySelector('#table_2');
    loggers.parser.debug('[parseExamData] table_2 (available terms) found:', !!table2);

    if (table2) {
        const rows = table2.querySelectorAll('tbody tr');
        loggers.parser.debug('[parseExamData] table_2 rows found:', rows.length);

        rows.forEach((row, rowIndex) => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 8) {
                loggers.parser.debug('[parseExamData] table_2 row', rowIndex, 'skipped: insufficient columns', cols.length);
                return;
            }

            // Standard indices (assuming hidden column is present)
            // 0: Hidden, 1: Num, 2: Status, 3: Code, 4: Name, 5: Period(Hidden), 6: Date, 7: Room, 8: Type, 9: Teacher, 10: Capacity

            // Dynamic detection: Find the column that looks like a date
            let dateIndex = -1;
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].textContent?.match(/\d{2}\.\d{2}\.\d{4}/)) {
                    dateIndex = i;
                    break;
                }
            }

            if (dateIndex === -1) {
                loggers.parser.debug('[parseExamData] table_2 row', rowIndex, 'skipped: no date column found');
                return;
            }

            // Indices shifted by -1
            // Was: Code=3, Name=4
            // Now: Code=2, Name=3
            const code = cols[2].textContent?.trim() || '';
            const name = cols[3].textContent?.trim() || '';

            // Log for debugging Sidebar Title Issue
            loggers.parser.debug(`[parseExamData] T2 Row ${rowIndex}: Code='${code}', Name='${name}'`);

            const dateStr = cols[dateIndex].textContent?.trim() || '';
            const room = cols[dateIndex + 1]?.textContent?.trim() || '';
            const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
            const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';
            const capacityStr = cols[dateIndex + 4]?.textContent?.trim() || '';

            // Extract teacher ID from link
            const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
            let teacherId = '';
            if (teacherLink) {
                const href = teacherLink.getAttribute('href') || '';
                const match = href.match(/id=(\d+)/);
                if (match) teacherId = match[1];
            }

            const sectionName = sectionNameRaw.split('(')[0].trim();
            const [datePart, timePart] = dateStr.split(' ');

            // Check if full
            const [occupied, total] = capacityStr.split('/').map(Number);
            const isFull = occupied >= total;

            // Extract Term ID from register link
            const registerLink = row.querySelector('a[href*="prihlasit_ihned=1"]');
            let termId = '';
            if (registerLink) {
                const href = registerLink.getAttribute('href') || '';
                const match = href.match(/termin=(\d+)/);
                if (match) termId = match[1];
            }

            // If no termId found (e.g. full term without watchdog link, or logic differs), generate random for now to avoid crash, 
            // but ideally we should find it elsewhere or disable interaction.
            // For full terms, the link might be different or missing.
            if (!termId) {
                // Try to find it in other links if possible, or fallback
                const infoLink = row.querySelector('a[href*="terminy_info.pl"]');
                if (infoLink) {
                    const href = infoLink.getAttribute('href') || '';
                    const match = href.match(/termin=(\d+)/);
                    if (match) termId = match[1];
                }
            }

            const finalId = termId || Math.random().toString(36).substr(2, 9);

            // Find registration info column (contains <br>)
            // Format: parts[0] = Přihlašování od, parts[1] = Přihlašování do
            // DEFENSIVE: Wrap in try/catch to detect IS MENDELU HTML structure changes
            let registrationStart: string | null = null;
            let registrationEnd: string | null = null;
            let foundBrColumn = false;

            try {
                for (let i = 0; i < cols.length; i++) {
                    if (cols[i].innerHTML.includes('<br>')) {
                        foundBrColumn = true;
                        // Check for registration dates (contains <br>)
                        // Only access innerHTML once
                        const cellHtml = cols[i].innerHTML;
                        const parts = cellHtml.split(/<br\s*\/?>/i);

                        // parts[0] = Přihlašování od (registration start)
                        if (parts.length >= 1) {
                            const startRaw = parts[0].replace(/<[^>]*>/g, '').trim();
                            if (startRaw !== '--' && startRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
                                registrationStart = startRaw;
                                const timePart = startRaw.split(' ')[1];
                                if (timePart && !timePart.match(/^\d{2}:\d{2}$/)) {
                                    loggers.parser.warn('[parseExamData] Registration time format unexpected:', timePart, 'in row', rowIndex);
                                }
                            }
                        }

                        // parts[1] = Přihlašování do (registration end)
                        if (parts.length >= 2) {
                            const endRaw = parts[1].replace(/<[^>]*>/g, '').trim();
                            if (endRaw !== '--' && endRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
                                registrationEnd = endRaw;
                            }
                        }
                        break;
                    }
                }

                // DEFENSIVE: Warn if expected structure not found
                if (!foundBrColumn && cols.length > 0) {
                    loggers.parser.warn('[parseExamData] No <br> column found for registration dates. IS MENDELU HTML structure may have changed. Row:', rowIndex);
                }
            } catch (parseError) {
                loggers.parser.error('[parseExamData] Failed to parse registration date for row', rowIndex, ':', parseError);
            }

            // Parse attempt type from "Typ termínu" column
            // Looking for icons with alt/title text like "řádný", "opravný 1", etc.
            let attemptType: 'regular' | 'retake1' | 'retake2' | 'retake3' | undefined;
            for (let i = 0; i < cols.length; i++) {
                const colHtml = cols[i].innerHTML.toLowerCase();
                const img = cols[i].querySelector('img');
                const imgAlt = img?.getAttribute('alt')?.toLowerCase() || '';
                const imgTitle = img?.getAttribute('title')?.toLowerCase() || '';
                const combinedText = colHtml + imgAlt + imgTitle;

                if (combinedText.includes('opravný 3') || combinedText.includes('opravny 3')) {
                    attemptType = 'retake3';
                    break;
                } else if (combinedText.includes('opravný 2') || combinedText.includes('opravny 2')) {
                    attemptType = 'retake2';
                    break;
                } else if (combinedText.includes('opravný 1') || combinedText.includes('opravny 1') || combinedText.includes('opravný') || combinedText.includes('opravny')) {
                    attemptType = 'retake1';
                    break;
                } else if (combinedText.includes('řádný') || combinedText.includes('radny')) {
                    attemptType = 'regular';
                    break;
                }
            }

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            // canRegisterNow = register link exists AND not full
            const canRegisterNow = !!registerLink && !isFull;

            section.terms.push({
                id: finalId,
                date: datePart,
                time: timePart,
                capacity: capacityStr,
                full: isFull,
                room,
                teacher,
                teacherId,
                registrationStart: registrationStart || undefined,
                registrationEnd: registrationEnd || undefined,
                attemptType,
                canRegisterNow
            });

            loggers.parser.debug('[parseExamData] table_2 parsed available term:', code, sectionName, datePart, timePart, 'full:', isFull, 'canRegisterNow:', canRegisterNow, 'regEnd:', registrationEnd, 'attemptType:', attemptType);
        });
    }

    // Convert Map to Array
    const results = Array.from(subjectsMap.values());
    console.debug('[parseExamData] Completed. Returning', results.length, 'subjects with',
        results.reduce((acc, s) => acc + s.sections.length, 0), 'total sections');

    return results;
}
