/**
 * Storage keys for all persisted data.
 * Prefixed with 'reis_' to avoid collisions.
 */
export const STORAGE_KEYS = {
    // Schedule data
    SCHEDULE_DATA: 'reis_schedule',
    SCHEDULE_WEEK_START: 'reis_schedule_week',

    // Exam data
    EXAMS_DATA: 'reis_exams',

    // Subject data (folder links, metadata)
    SUBJECTS_DATA: 'reis_subjects',

    // Success rate data (stats, trends)
    SUCCESS_RATES_DATA: 'reis_success_rates',
    GLOBAL_SUCCESS_RATES_DATA: 'reis_global_success_rates',
    GLOBAL_STATS_LAST_SYNC: 'reis_global_stats_last_sync', // Per-course sync timestamps

    // Subject files (keyed by course code)
    // Usage: SUBJECT_FILES_PREFIX + courseCode
    SUBJECT_FILES_PREFIX: 'reis_files_',

    // User parameters
    USER_PARAMS: 'reis_user_params',

    // Outlook calendar sync
    OUTLOOK_SYNC: 'reis_outlook_sync',

    // Preferences
    THEME: 'reis_theme',

    // Sync metadata
    LAST_SYNC: 'reis_last_sync',
    SYNC_ERROR: 'reis_sync_error',
    SYNC_IN_PROGRESS: 'reis_sync_in_progress',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];
