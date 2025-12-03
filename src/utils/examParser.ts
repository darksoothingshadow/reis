import type { ExamSubject } from '../components/ExamDrawer';

export function parseExamData(html: string): ExamSubject[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const subjectsMap = new Map<string, ExamSubject>();

    // Helper to get or create subject
    const getOrCreateSubject = (code: string, rawName: string) => {
        // Clean name: Remove "ZS 202X/202X - FACULTY" prefix/suffix
        // Example: "ZS 2025/2026 - PEF Algoritmizace" or "Algoritmizace ZS 2025/2026 - PEF"
        // Usually it's "ZS 2025/2026 - PEF <Name>"
        let name = rawName.replace(/ZS\s+\d{4}\/\d{4}\s+-\s+\w+\s+/, '').trim();

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
    if (table1) {
        const rows = table1.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 6) return; // Reduced min length check

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

            if (dateIndex === -1) return; // Could not find date, skip row

            const code = cols[2].textContent?.trim() || '';
            const name = cols[3].textContent?.trim() || '';

            const dateStr = cols[dateIndex].textContent?.trim() || '';
            const room = cols[dateIndex + 1]?.textContent?.trim() || '';
            const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
            const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';

            // Clean up section name (remove newlines, extra spaces)
            const sectionName = sectionNameRaw.split('(')[0].trim();

            // Parse date and time
            const [datePart, timePart] = dateStr.split(' ');
            const date = datePart;
            const time = timePart;

            // Extract Term ID from unregister link
            // Link looks like: terminy_seznam.pl?termin=327145;studium=149707;obdobi=801;odhlasit_ihned=1;lang=cz
            const unregisterLink = row.querySelector('a[href*="odhlasit_ihned=1"]');
            let termId = '';
            if (unregisterLink) {
                const href = unregisterLink.getAttribute('href') || '';
                const match = href.match(/termin=(\d+)/);
                if (match) termId = match[1];
            }

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            section.status = 'registered';
            section.registeredTerm = {
                id: termId,
                date,
                time,
                room,
                teacher
            };
        });
    }

    // 2. Parse Available Terms (Table 2)
    const table2 = doc.querySelector('#table_2');
    if (table2) {
        const rows = table2.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cols = row.querySelectorAll('td');
            if (cols.length < 8) return;

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

            if (dateIndex === -1) return;

            const code = cols[3].textContent?.trim() || '';
            const name = cols[4].textContent?.trim() || '';

            const dateStr = cols[dateIndex].textContent?.trim() || '';
            const room = cols[dateIndex + 1]?.textContent?.trim() || '';
            const sectionNameRaw = cols[dateIndex + 2]?.textContent?.trim() || '';
            const teacher = cols[dateIndex + 3]?.textContent?.trim() || '';
            const capacityStr = cols[dateIndex + 4]?.textContent?.trim() || '';

            const sectionName = sectionNameRaw.split('(')[0].trim();
            const [datePart, timePart] = dateStr.split(' ');

            // Check if full
            const [occupied, total] = capacityStr.split('/').map(Number);
            const isFull = occupied >= total;

            // Extract Term ID from register link
            // Link looks like: terminy_seznam.pl?termin=327621;studium=149707;obdobi=801;prihlasit_ihned=1;lang=cz
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
            let registrationStart: string | null = null;
            for (let i = 0; i < cols.length; i++) {
                if (cols[i].innerHTML.includes('<br>')) {
                    const parts = cols[i].innerHTML.split('<br>');
                    if (parts.length >= 1) {
                        const startRaw = parts[0].replace(/<[^>]*>/g, '').trim(); // Remove tags and trim
                        if (startRaw !== '--' && startRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
                            registrationStart = startRaw;
                        }
                    }
                }
            }

            const subject = getOrCreateSubject(code, name);
            const section = getOrCreateSection(subject, sectionName);

            section.terms.push({
                id: finalId,
                date: datePart,
                time: timePart,
                capacity: capacityStr,
                full: isFull,
                room,
                teacher,
                registrationStart: registrationStart || undefined
            });
        });
    }

    // Convert Map to Array
    return Array.from(subjectsMap.values());
}
