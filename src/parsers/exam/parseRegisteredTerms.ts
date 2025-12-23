/**
 * Parse Registered Terms (Table 1)
 * 
 * Extracts already-registered exam terms from the first table.
 */

import { loggers } from '../../utils/logger';
import { safeText, findDateColumnIndex, extractTerminFromLink, extractIdFromLink } from '../domHelpers';
import { getOrCreateSubject, getOrCreateSection, parseRegistrationDates } from './helpers';
import type { ExamSubject } from '../../types/exams';

/**
 * Parse registered terms from Table 1.
 * These are exams the student is already registered for.
 */
export const parseRegisteredTerms = (
  doc: Document,
  subjectsMap: Map<string, ExamSubject>
): void => {
  const table1 = doc.querySelector('#table_1');
  loggers.parser.debug('[parseRegisteredTerms] table_1 found:', !!table1);

  if (!table1) return;

  const rows = table1.querySelectorAll('tbody tr');
  loggers.parser.debug('[parseRegisteredTerms] rows found:', rows.length);

  rows.forEach((row, rowIndex) => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 6) {
      loggers.parser.debug('[parseRegisteredTerms] row', rowIndex, 'skipped: insufficient columns', cols.length);
      return;
    }

    // Dynamic detection: Find the column that looks like a date
    const dateIndex = findDateColumnIndex(cols);
    if (dateIndex === -1) {
      loggers.parser.debug('[parseRegisteredTerms] row', rowIndex, 'skipped: no date column found');
      return;
    }

    // Extract basic info (indices adjusted from original)
    const code = safeText(cols[1]);
    const name = safeText(cols[2]);

    const dateStr = safeText(cols[dateIndex]);
    const room = safeText(cols[dateIndex + 1]);
    const sectionNameRaw = safeText(cols[dateIndex + 2]);
    const teacher = safeText(cols[dateIndex + 3]);

    // Extract teacher ID from link
    const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
    const teacherId = extractIdFromLink(teacherLink);

    // Clean up section name (remove parenthetical content)
    const sectionName = sectionNameRaw.split('(')[0].trim();

    // Parse date and time
    const [datePart, timePart] = dateStr.split(' ');

    // Extract Term ID from unregister link
    const unregisterLink = row.querySelector('a[href*="odhlasit_ihned=1"]');
    const termId = extractTerminFromLink(unregisterLink);

    // Extract deregistration deadline from registration dates column
    const { deregistrationDeadline } = parseRegistrationDates(cols);

    loggers.parser.debug(`[parseRegisteredTerms] Row ${rowIndex}: Code='${code}', Name='${name}'`);

    const subject = getOrCreateSubject(subjectsMap, code, name);
    const section = getOrCreateSection(subject, sectionName);

    section.status = 'registered';
    section.registeredTerm = {
      id: termId,
      date: datePart,
      time: timePart,
      room,
      teacher,
      teacherId,
      deregistrationDeadline: deregistrationDeadline || undefined
    };

    loggers.parser.debug('[parseRegisteredTerms] parsed:', code, sectionName, datePart, timePart);
  });
};
