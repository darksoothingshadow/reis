/**
 * Sync files for all subjects from IS Mendelu to storage.
 * 
 * Runs as part of background sync - fetches files for each subject
 * and stores them permanently.
 */

import { StorageService, STORAGE_KEYS } from '../storage';
import { fetchFilesFromFolder } from '../../api/documents';
import type { SubjectsData } from '../../types/documents';

// Extract folder ID from URL
function getIdFromUrl(url: string): string | null {
    const match = url.match(/[?&;]id=(\d+)/);
    return match ? match[1] : null;
}

export async function syncFiles(): Promise<void> {
    console.log('[syncFiles] Starting files sync...');

    // Get subjects from storage
    const subjectsData = StorageService.get<SubjectsData>(STORAGE_KEYS.SUBJECTS_DATA);

    if (!subjectsData || !subjectsData.data) {
        console.log('[syncFiles] No subjects data available, skipping file sync');
        return;
    }

    const subjects = Object.entries(subjectsData.data);
    console.log(`[syncFiles] Syncing files for ${subjects.length} subjects`);

    let successCount = 0;
    let errorCount = 0;

    // Sync files for each subject (sequential to avoid overwhelming the server)
    for (const [courseCode, subject] of subjects) {
        try {
            const folderId = getIdFromUrl(subject.folderUrl);
            if (!folderId) {
                console.warn(`[syncFiles] Could not extract folder ID for ${courseCode}`);
                continue;
            }

            const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;
            const files = await fetchFilesFromFolder(folderUrl);

            if (files && files.length > 0) {
                const storageKey = `${STORAGE_KEYS.SUBJECT_FILES_PREFIX}${courseCode}`;
                StorageService.set(storageKey, files);
                console.debug(`[syncFiles] Stored ${files.length} files for ${courseCode}`);
                successCount++;
            }
        } catch (error) {
            console.error(`[syncFiles] Failed to sync files for ${courseCode}:`, error);
            errorCount++;
        }
    }

    console.log(`[syncFiles] Completed: ${successCount} subjects synced, ${errorCount} errors`);
}
