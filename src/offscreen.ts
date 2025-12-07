/**
 * Offscreen document script for background Google Drive sync.
 * 
 * This runs in an offscreen document context, allowing:
 * - Full DOM/Blob API access
 * - File operations without visible tabs
 * - Background sync even when IS Mendelu tabs are closed
 */

import { GoogleDriveService, type DriveSettings } from './services/drive/GoogleDriveService';
import { DRIVE_CONSTANTS } from './constants/drive';
import { cleanSubjectFolderName, hasFilesToSync } from './utils/driveUtils';
import { StorageService, STORAGE_KEYS } from './services/storage';

// ============================================================================
// Types
// ============================================================================

interface SubjectData {
    code: string;
    fullName: string;
    folderUrl?: string;
}

interface FileGroup {
    subfolder?: string;
    files: {
        name: string;
        link: string;
    }[];
}

interface SyncProgress {
    isSyncing: boolean;
    lastSyncTime: number | null;
    error: string | null;
    currentSubject?: string;
    progress?: { current: number; total: number };
}

// ============================================================================
// Message Handler
// ============================================================================

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.target !== 'offscreen') return false;

    if (message.type === 'EXECUTE_DRIVE_SYNC') {
        console.log('[Offscreen] Received sync request');
        executeSync()
            .then(() => sendResponse({ success: true }))
            .catch(e => sendResponse({ error: e.message }));
        return true; // Async response
    }

    return false;
});

// ============================================================================
// Sync Logic
// ============================================================================

/**
 * Execute full Drive sync for all subjects.
 */
async function executeSync(): Promise<void> {
    console.log('[Offscreen] Starting Drive sync...');

    const driveService = GoogleDriveService.getInstance();

    // Check authorization
    const settings = await driveService.getSettings();
    if (!settings.isAuthorized || !settings.rootFolderId) {
        console.log('[Offscreen] Drive not configured, skipping sync');
        return;
    }

    // Validate root folder still exists
    const folderValid = await driveService.validateFolderId(settings.rootFolderId);
    if (!folderValid) {
        console.log('[Offscreen] Root folder invalid, searching for existing...');
        const existing = await driveService.searchFolder(
            settings.rootFolderName || DRIVE_CONSTANTS.DEFAULT_FOLDER_NAME,
            'root'
        );
        if (existing) {
            settings.rootFolderId = existing.id;
            await driveService.saveSettings(settings);
        } else {
            console.error('[Offscreen] Root folder not found');
            await updateSyncStatus({ error: 'Root folder not found' });
            return;
        }
    }

    // Get all subjects from storage
    const subjects = await getStoredSubjects();
    if (!subjects || Object.keys(subjects).length === 0) {
        console.log('[Offscreen] No subjects to sync');
        await updateSyncStatus({ lastSyncTime: Date.now() });
        return;
    }

    await updateSyncStatus({ isSyncing: true });

    const subjectList = Object.values(subjects);
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < subjectList.length; i++) {
        const subject = subjectList[i];
        if (!subject.code) continue;

        await updateSyncStatus({
            currentSubject: subject.fullName,
            progress: { current: i + 1, total: subjectList.length }
        });

        try {
            await syncSubject(subject, settings, driveService);
            successCount++;
        } catch (e) {
            console.error(`[Offscreen] Failed to sync ${subject.code}:`, e);
            errorCount++;
        }
    }

    console.log(`[Offscreen] Sync complete. Success: ${successCount}, Errors: ${errorCount}`);
    await updateSyncStatus({
        isSyncing: false,
        lastSyncTime: Date.now(),
        error: errorCount > 0 ? `${errorCount} subjects failed to sync` : null
    });
}

/**
 * Sync a single subject's files to Drive.
 */
async function syncSubject(
    subject: SubjectData,
    settings: DriveSettings,
    driveService: GoogleDriveService
): Promise<void> {
    // Get files for this subject
    const fileGroups = await getSubjectFiles(subject.code);

    // Skip if no files
    if (!hasFilesToSync(fileGroups)) {
        console.log(`[Offscreen] ${subject.code}: No files, skipping`);
        return;
    }

    // Clean folder name (remove subject code)
    const folderName = cleanSubjectFolderName(subject.fullName);

    // Get or create subject folder
    let subjectFolder = await driveService.searchFolder(folderName, settings.rootFolderId!);
    if (!subjectFolder) {
        subjectFolder = await driveService.createFolder(folderName, settings.rootFolderId!);
    }

    // Flatten files
    const allFiles: { name: string; link: string; subfolder?: string }[] = [];
    fileGroups?.forEach(group => {
        group.files.forEach(f => {
            allFiles.push({
                name: f.name,
                link: f.link,
                subfolder: group.subfolder
            });
        });
    });

    console.log(`[Offscreen] ${subject.code}: Syncing ${allFiles.length} files`);

    // Sync files with concurrency limit
    const CONCURRENCY = DRIVE_CONSTANTS.CONCURRENCY_LIMIT;
    const queue = [...allFiles];
    const activePromises: Promise<void>[] = [];

    const processFile = async (file: typeof allFiles[0]) => {
        try {
            // Fetch file content
            const response = await fetch(file.link, { credentials: 'include' });
            if (!response.ok) {
                console.warn(`[Offscreen] Failed to download: ${file.name}`);
                return;
            }

            const blob = await response.blob();

            // Upload to Drive
            await driveService.uploadOrUpdateFile(
                blob,
                file.name,
                subjectFolder!.id,
                file.subfolder,
                blob.type || 'application/octet-stream'
            );

            // Add delay between requests
            await new Promise(resolve =>
                setTimeout(resolve, DRIVE_CONSTANTS.INTER_REQUEST_DELAY_MS)
            );
        } catch (e) {
            console.error(`[Offscreen] Failed to sync file ${file.name}:`, e);
        }
    };

    while (queue.length > 0 || activePromises.length > 0) {
        // Start new tasks up to concurrency limit
        while (queue.length > 0 && activePromises.length < CONCURRENCY) {
            const file = queue.shift()!;
            const promise = processFile(file).then(() => {
                const idx = activePromises.indexOf(promise);
                if (idx > -1) activePromises.splice(idx, 1);
            });
            activePromises.push(promise);
        }

        // Wait for at least one to complete
        if (activePromises.length > 0) {
            await Promise.race(activePromises);
        }
    }
}

// ============================================================================
// Storage Helpers
// ============================================================================

async function getStoredSubjects(): Promise<Record<string, SubjectData> | null> {
    try {
        const data = StorageService.get<Record<string, SubjectData>>(STORAGE_KEYS.SUBJECTS_DATA);
        return data;
    } catch {
        // Fallback to chrome.storage if StorageService not available
        const result = await chrome.storage.local.get([STORAGE_KEYS.SUBJECTS_DATA]);
        return (result[STORAGE_KEYS.SUBJECTS_DATA] as Record<string, SubjectData>) || null;
    }
}

async function getSubjectFiles(subjectCode: string): Promise<FileGroup[] | null> {
    const key = STORAGE_KEYS.SUBJECT_FILES_PREFIX + subjectCode;
    try {
        return StorageService.get<FileGroup[]>(key);
    } catch {
        const result = await chrome.storage.local.get([key]);
        return (result[key] as FileGroup[]) || null;
    }
}

async function updateSyncStatus(update: Partial<SyncProgress>): Promise<void> {
    const result = await chrome.storage.local.get(['driveSyncStatus']);
    const current: SyncProgress = (result.driveSyncStatus as SyncProgress) || {
        isSyncing: false,
        lastSyncTime: null,
        error: null
    };

    await chrome.storage.local.set({
        driveSyncStatus: { ...current, ...update }
    });
}

console.log('[Offscreen] Script loaded');
