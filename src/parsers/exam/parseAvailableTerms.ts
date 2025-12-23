/**
 * Parse Available Terms (Table 2)
 * 
 * Extracts available exam terms from the second table.
 */

import { loggers } from '../../utils/logger';
import { 
  safeText, 
  findDateColumnIndex, 
  extractTerminFromLink, 
  extractIdFromLink,
  parseCapacity 
} from '../domHelpers';
import { 
  getOrCreateSubject, 
  getOrCreateSection, 
  parseAttemptType,
  parseRegistrationDates 
} from './helpers';
import type { ExamSubject } from '../../types/exams';

/**
 * Parse available terms from Table 2.
 * These are exams the student can register for.
 */
export const parseAvailableTerms = (
  doc: Document,
  subjectsMap: Map<string, ExamSubject>
): void => {
  const table2 = doc.querySelector('#table_2');
  loggers.parser.debug('[parseAvailableTerms] table_2 found:', !!table2);

  if (!table2) return;

  const rows = table2.querySelectorAll('tbody tr');
  loggers.parser.debug('[parseAvailableTerms] rows found:', rows.length);

  rows.forEach((row, rowIndex) => {
    const cols = row.querySelectorAll('td');
    if (cols.length < 8) {
      loggers.parser.debug('[parseAvailableTerms] row', rowIndex, 'skipped: insufficient columns', cols.length);
      return;
    }

    // Dynamic detection: Find the column that looks like a date
    const dateIndex = findDateColumnIndex(cols);
    if (dateIndex === -1) {
      loggers.parser.debug('[parseAvailableTerms] row', rowIndex, 'skipped: no date column found');
      return;
    }

    // Extract basic info (indices adjusted from original)
    const code = safeText(cols[2]);
    const name = safeText(cols[3]);

    const dateStr = safeText(cols[dateIndex]);
    const room = safeText(cols[dateIndex + 1]);
    const sectionNameRaw = safeText(cols[dateIndex + 2]);
    const teacher = safeText(cols[dateIndex + 3]);
    const capacityStr = safeText(cols[dateIndex + 4]);

    loggers.parser.debug(`[parseAvailableTerms] Row ${rowIndex}: Code='${code}', Name='${name}'`);

    // Extract teacher ID from link
    const teacherLink = cols[dateIndex + 3]?.querySelector('a[href*="clovek.pl"]');
    const teacherId = extractIdFromLink(teacherLink);

    const sectionName = sectionNameRaw.split('(')[0].trim();
    const [datePart, timePart] = dateStr.split(' ');

    // Parse capacity
    const { isFull } = parseCapacity(capacityStr);

    // Extract Term ID from register link
    const registerLink = row.querySelector('a[href*="prihlasit_ihned=1"]');
    let termId = extractTerminFromLink(registerLink);

    // Fallback: try info link if no register link
    if (!termId) {
      const infoLink = row.querySelector('a[href*="terminy_info.pl"]');
      termId = extractTerminFromLink(infoLink);
    }

    const finalId = termId || Math.random().toString(36).substr(2, 9);

    // Parse registration dates
    const { registrationStart, registrationEnd } = parseRegistrationDates(cols);

    // Parse attempt type
    const attemptType = parseAttemptType(cols);

    const subject = getOrCreateSubject(subjectsMap, code, name);
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

    loggers.parser.debug(
      '[parseAvailableTerms] parsed:',
      code, sectionName, datePart, timePart,
      'full:', isFull, 'canRegisterNow:', canRegisterNow,
      'attemptType:', attemptType
    );
  });
};
