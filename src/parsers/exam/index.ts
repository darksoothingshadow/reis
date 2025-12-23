/**
 * Exam Parser Module
 * 
 * Parses exam registration HTML from IS MENDELU.
 * Handles both registered terms (Table 1) and available terms (Table 2).
 */

export { parseExamData } from './parseExamData';
export { parseRegisteredTerms } from './parseRegisteredTerms';
export { parseAvailableTerms } from './parseAvailableTerms';
export { getOrCreateSubject, getOrCreateSection, cleanSubjectName } from './helpers';
