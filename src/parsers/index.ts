/**
 * Parsers Module
 * 
 * Re-exports all parsers from their modular locations.
 */

// DOM Helpers
export * from './domHelpers';

// Exam Parser
export { parseExamData } from './exam';
export { parseRegisteredTerms, parseAvailableTerms } from './exam';

// Search Parsers
export type { Person, Subject } from './search';
export { parseMendeluResults, parseSubjectResults, parseGlobalPeopleResults } from './search';

// Documents Parser
export { parseServerFiles } from './documents';
