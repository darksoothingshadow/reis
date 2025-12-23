/**
 * Exam Parser Helpers
 * 
 * Shared utilities for exam parsing operations.
 */

import type { ExamSubject, ExamSection } from '../../types/exams';

/**
 * Clean subject name by removing semester/faculty prefix.
 * Example: "ZS 2025/2026 - PEF Algoritmizace" → "Algoritmizace"
 */
export const cleanSubjectName = (rawName: string): string => {
  return rawName.replace(/^[ZL]S\s*\d{4}\/\d{4}\s*-\s*[A-Z]+\s*(-)?s*/i, '').trim();
};

/**
 * Get or create a subject in the subjects map.
 */
export const getOrCreateSubject = (
  subjectsMap: Map<string, ExamSubject>,
  code: string,
  rawName: string
): ExamSubject => {
  const name = cleanSubjectName(rawName);

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

/**
 * Get or create a section within a subject.
 */
export const getOrCreateSection = (
  subject: ExamSubject,
  sectionName: string
): ExamSection => {
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

/**
 * Parse attempt type from column HTML content.
 * Looks for icons with alt/title text like "řádný", "opravný 1", etc.
 */
export const parseAttemptType = (
  cols: NodeListOf<Element>
): 'regular' | 'retake1' | 'retake2' | 'retake3' | undefined => {
  for (let i = 0; i < cols.length; i++) {
    const colHtml = cols[i].innerHTML.toLowerCase();
    const img = cols[i].querySelector('img');
    const imgAlt = img?.getAttribute('alt')?.toLowerCase() || '';
    const imgTitle = img?.getAttribute('title')?.toLowerCase() || '';
    const combinedText = colHtml + imgAlt + imgTitle;

    if (combinedText.includes('opravný 3') || combinedText.includes('opravny 3')) {
      return 'retake3';
    } else if (combinedText.includes('opravný 2') || combinedText.includes('opravny 2')) {
      return 'retake2';
    } else if (combinedText.includes('opravný 1') || combinedText.includes('opravny 1') || combinedText.includes('opravný') || combinedText.includes('opravny')) {
      return 'retake1';
    } else if (combinedText.includes('řádný') || combinedText.includes('radny')) {
      return 'regular';
    }
  }
  return undefined;
};

/**
 * Extract registration dates from a cell with <br> separators.
 * Format: "startDate<br>endDate<br>deregistrationDeadline"
 */
export const parseRegistrationDates = (
  cols: NodeListOf<Element>
): { registrationStart: string | null; registrationEnd: string | null; deregistrationDeadline: string | null } => {
  let registrationStart: string | null = null;
  let registrationEnd: string | null = null;
  let deregistrationDeadline: string | null = null;

  for (let i = 0; i < cols.length; i++) {
    const cellHtml = cols[i].innerHTML;
    const brMatches = cellHtml.match(/<br\s*\/?>/gi);
    
    if (brMatches && brMatches.length >= 1) {
      const parts = cellHtml.split(/<br\s*\/?>/i);

      // parts[0] = Přihlašování od (registration start)
      if (parts.length >= 1) {
        const startRaw = parts[0].replace(/<[^>]*>/g, '').trim();
        if (startRaw !== '--' && startRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
          registrationStart = startRaw;
        }
      }

      // parts[1] = Přihlašování do (registration end)
      if (parts.length >= 2) {
        const endRaw = parts[1].replace(/<[^>]*>/g, '').trim();
        if (endRaw !== '--' && endRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
          registrationEnd = endRaw;
        }
      }

      // parts[2] = Odhlašování do (deregistration deadline)
      if (parts.length >= 3) {
        const deadlineRaw = parts[2].replace(/<[^>]*>/g, '').trim();
        if (deadlineRaw !== '--' && deadlineRaw.match(/\d{2}\.\d{2}\.\d{4}/)) {
          deregistrationDeadline = deadlineRaw;
        }
      }

      break;
    }
  }

  return { registrationStart, registrationEnd, deregistrationDeadline };
};
