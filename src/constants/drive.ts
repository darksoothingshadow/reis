/**
 * Google Drive constants for synchronization.
 */

export const DRIVE_CONSTANTS = {
    /** Root folder name where all synced files are stored */
    DEFAULT_FOLDER_NAME: "Soubory Mendelu (Synchronizováno)",

    /** MIME type for Google Drive folders */
    MIME_TYPE_FOLDER: "application/vnd.google-apps.folder",

    /** OAuth2 scopes - drive.file only accesses files created by this app */
    SCOPES: ['https://www.googleapis.com/auth/drive.file'],

    /** Delay between API requests to avoid rate limits (ms) */
    INTER_REQUEST_DELAY_MS: 100,

    /** Maximum concurrent file uploads */
    CONCURRENCY_LIMIT: 3,

    /** Auto-sync interval in minutes */
    SYNC_INTERVAL_MINUTES: 5,

    /** Client Secret for OAuth (Available because using Web Application type) */
    CLIENT_SECRET: "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",
};
