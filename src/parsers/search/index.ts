/**
 * Search Parsers Module
 * 
 * Re-exports all search-related parsers.
 */

export type { Person, Subject } from './types';
export { parseMendeluResults } from './parsePersonList';
export { parseSubjectResults } from './parseSubjectResults';
export { parseGlobalPeopleResults } from './parseGlobalPeopleResults';
export { classifyPersonType, isStudentFromDetails } from './types';
