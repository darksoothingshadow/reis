// constants.js
// Shared constants for MENDELU helper functions

/**
 * Storage keys used in browser.storage.local
 */
export const STORAGE_KEYS = {
  SCHEDULE: 'schedule',
  SUBJECTS: 'subjects',
  FILES: 'files',
  METADATA: 'metadata'
};

/**
 * Base URL for MENDELU IS
 */
export const IS_BASE_URL = 'https://is.mendelu.cz/auth';

/**
 * API endpoints
 */
export const ENDPOINTS = {
  SCHEDULE_FORM: '/auth/katalog/rozvrhy_view.pl',
  STUDENT_LIST: '/auth/student/list.pl'
};

/**
 * DOM selectors for parsing
 */
export const SELECTORS = {
  SCHEDULE_TABLE: '#tmtab_1 tbody',
  SUBJECTS_TABLE: '#tmtab_1',
  SUBJECT_ROW: 'tr.uis-hl-table',
  STUDENT_ID_INPUT: 'input[name="rozvrh_student"]',
  FILES_TABLE: '#tmtab_1',
  FILE_ROW: 'tr.uis-hl-table',
  PAGINATION_TEXT: 'div.small span.small'
};
