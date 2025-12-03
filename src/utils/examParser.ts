import { sanitizeString, validateDate, sanitizeTeacherName, validateRoomCode, validateUrl } from './validation';

export interface ExamEvent {
    id: string;
    title: string;
    start: string; // ISO String
    location: string;
    meta: {
        teacher: string;
        capacity: string;
        deadline_logout: string;
    };
    actions: {
        info_url: string;
        logout_url: string;
    };
}

export function parseRegisteredExams(html: string): ExamEvent[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const table = doc.querySelector('#table_1');

    if (!table) {
        return [];
    }

    const rows = table.querySelectorAll('tbody > tr');
    const events: ExamEvent[] = [];

    rows.forEach((row) => {
        const cells = row.querySelectorAll('td');

        if (cells.length < 13) {
            return;
        }

        // Column 1: Subject Code (VALIDATE)
        const subjectCodeRaw = cells[1]?.textContent?.trim() || '';
        const subjectCode = sanitizeString(subjectCodeRaw, 50);
        if (!subjectCode) {
            return;
        }

        // Column 2: Subject Name (SANITIZE)
        const subjectNameAnchor = cells[2].querySelector('a');
        const subjectNameRaw = subjectNameAnchor?.textContent?.trim() || cells[2].textContent?.trim() || '';
        const subjectName = sanitizeString(subjectNameRaw, 200);
        if (!subjectName) {
            return;
        }

        // Column 4: Date & Time (VALIDATE)
        const dateRaw = cells[4].textContent?.trim() || '';
        const dateClean = dateRaw.replace(/\s*\(.*\)/, '');
        const [datePart, timePart] = dateClean.split(' ');

        let isoDate = '';
        if (datePart && timePart) {
            const [day, month, year] = datePart.split('.');
            isoDate = `${year}-${month}-${day}T${timePart}:00`;
        }

        // Validate the constructed date
        const validatedDate = validateDate(isoDate);
        if (!validatedDate) {
            return; // Skip exams with invalid dates
        }

        // Column 5: Location (VALIDATE)
        const locationAnchor = cells[5].querySelector('a');
        const locationRaw = locationAnchor?.textContent?.trim() || cells[5].textContent?.trim() || '';
        const location = sanitizeString(locationRaw, 50);

        // Optionally validate room code format
        if (location && !validateRoomCode(location) && location !== 'Online') {
            // Don't skip, but log for monitoring
        }

        // Column 6: Exam Type (SANITIZE)
        const examTypeRaw = cells[6].textContent?.trim() || '';
        const examType = sanitizeString(examTypeRaw, 50);

        // Column 7: Teacher (SANITIZE)
        const teacherRaw = cells[7].textContent?.trim() || '';
        const teacher = sanitizeTeacherName(teacherRaw);
        if (!teacher) {
        }

        // Column 8: Capacity (SANITIZE)
        const capacityRaw = cells[8].textContent?.trim() || '';
        const capacity = sanitizeString(capacityRaw, 20);

        // Column 10: Deadlines (SANITIZE)
        const deadlinesText = cells[10].textContent || '';
        const deadlinesParts = deadlinesText.split(/\n+/).map(s => sanitizeString(s, 100)).filter(Boolean);
        const deadlineLogout = deadlinesParts.length >= 3 ? deadlinesParts[2] : '';

        // Column 11: Info URL (VALIDATE)
        const infoAnchor = cells[11].querySelector('a');
        let infoUrl = infoAnchor?.getAttribute('href') || '';
        if (infoUrl) {
            infoUrl = validateUrl(infoUrl, 'is.mendelu.cz');
            if (!infoUrl) {
            }
        }

        // Column 12: Logout URL (VALIDATE)
        const logoutAnchor = cells[12].querySelector('a');
        let logoutUrl = logoutAnchor?.getAttribute('href') || '';
        if (logoutUrl) {
            logoutUrl = validateUrl(logoutUrl, 'is.mendelu.cz');
            if (!logoutUrl) {
            }
        }

        events.push({
            id: subjectCode,
            title: `${subjectName} - ${examType}`,
            start: isoDate,
            location: location,
            meta: {
                teacher,
                capacity,
                deadline_logout: deadlineLogout
            },
            actions: {
                info_url: infoUrl,
                logout_url: logoutUrl
            }
        });
    });

    return events;
}
