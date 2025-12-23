/**
 * Parse Exam Data
 * 
 * Main entry point for parsing exam registration HTML from IS MENDELU.
 * Delegates to specialized parsers for each table type.
 */

import { loggers } from '../../utils/logger';
import { parseHtml } from '../domHelpers';
import { parseRegisteredTerms } from './parseRegisteredTerms';
import { parseAvailableTerms } from './parseAvailableTerms';
import type { ExamSubject } from '../../types/exams';

/**
 * Parse exam data from IS MENDELU HTML.
 * 
 * @param html - Raw HTML from the exam registration page
 * @returns Array of ExamSubject objects with their sections and terms
 */
export function parseExamData(html: string): ExamSubject[] {
  loggers.parser.debug('[parseExamData] Starting parse, input length:', html.length);

  const doc = parseHtml(html);
  const subjectsMap = new Map<string, ExamSubject>();

  // 1. Parse Registered Terms (Table 1)
  parseRegisteredTerms(doc, subjectsMap);

  // 2. Parse Available Terms (Table 2)
  parseAvailableTerms(doc, subjectsMap);

  // 3. Sanity Check & Return
  const results = Array.from(subjectsMap.values());

  // Filter out invalid/hallucinated subjects (Defense in Depth)
  const validResults = results.filter(subject => {
    const isMinLength = subject.name.length >= 2 && subject.code.length >= 2;
    const hasSections = subject.sections.length > 0;

    // Munger-style Inversion: How can this be a hallucination?
    const isHallucinationAddress = subject.name.toLowerCase().includes('742 evergreen terrace');

    if (!isMinLength || !hasSections || isHallucinationAddress) {
      loggers.parser.warn('[parseExamData] Invalid data filtered:', {
        code: subject.code,
        name: subject.name,
        sections: subject.sections.length
      });
      return false;
    }
    return true;
  });

  loggers.parser.debug('[parseExamData] Completed. Returning', validResults.length, 'valid subjects');

  return validResults;
}
