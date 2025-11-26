import { GoogleDriveService } from "./google_drive";
import { getFilesFromId, getStoredSubject, getAllStoredSubjects } from "../utils/apiUtils";
import { resolveFinalFileUrl } from "../utils/fileUtils";

import { GetIdFromLink } from "../utils/calendarUtils";

interface DriveSettings {
    isAuthorized: boolean;
    rootFolderId: string | null;
    rootFolderName: string | null;
}

export interface SyncStatus {
    courseCode: string;
    status: 'idle' | 'syncing' | 'synced' | 'error';
    lastSync?: number;
    error?: string;
    totalFiles?: number;
    syncedFiles?: number;
}

export class SyncService {
    private static instance: SyncService;
    private driveService: GoogleDriveService;

    private constructor() {
        this.driveService = GoogleDriveService.getInstance();
    }

    public static getInstance(): SyncService {
        if (!SyncService.instance) {
            SyncService.instance = new SyncService();
        }
        return SyncService.instance;
    }

    /**
     * Get current Drive settings from storage
     */
    public async getSettings(): Promise<DriveSettings> {
        const result = await chrome.storage.local.get(['driveSettings']);
        return (result.driveSettings as DriveSettings) || {
            isAuthorized: false,
            rootFolderId: null,
            rootFolderName: null
        };
    }

    /**
     * Save Drive settings
     */
    public async saveSettings(settings: DriveSettings): Promise<void> {
        await chrome.storage.local.set({ driveSettings: settings });
    }

    /**
     * Clear Drive settings (disconnect)
     */
    public async clearSettings(): Promise<void> {
        await chrome.storage.local.remove(['driveSettings']);
    }

    /**
     * Sync a specific subject
     */
    public async syncSubject(courseCode: string, onProgress?: (status: SyncStatus) => void): Promise<void> {
        const settings = await this.getSettings();
        if (!settings.isAuthorized || !settings.rootFolderId) {
            throw new Error("Google Drive not configured");
        }

        const updateStatus = (status: Partial<SyncStatus>) => {
            if (onProgress) {
                onProgress({
                    courseCode,
                    status: 'syncing',
                    ...status
                });
            }
        };

        try {
            updateStatus({ status: 'syncing' });

            // 1. Get subject data
            const subject = await getStoredSubject(courseCode);
            if (!subject) throw new Error("Subject not found");

            // 2. Get files from IS Mendelu
            const isFiles = await getFilesFromId(GetIdFromLink(subject.folderUrl));
            if (!isFiles) {
                updateStatus({ status: 'synced', totalFiles: 0, syncedFiles: 0 });
                return;
            }

            // Flatten file structure
            const allFiles: { name: string, link: string, subfolder?: string }[] = [];
            isFiles.forEach(group => {
                group.files.forEach(f => {
                    allFiles.push({
                        name: f.name,
                        link: f.link,
                        subfolder: group.subfolder
                    });
                });
            });

            updateStatus({ totalFiles: allFiles.length, syncedFiles: 0 });

            // 3. Get or create subject folder in Drive
            let subjectFolder = await this.driveService.searchFolder(subject.fullName, settings.rootFolderId);
            if (!subjectFolder) {
                subjectFolder = await this.driveService.createFolder(subject.fullName, settings.rootFolderId);
            }

            // 4. Sync files with concurrency limit
            const CONCURRENCY_LIMIT = 3;
            const filesToSync = [...allFiles];
            let syncedCount = 0;
            let activeSyncs = 0;
            let currentIndex = 0;

            const syncFile = async (file: typeof allFiles[0]) => {
                try {
                    // Resolve actual download URL
                    const downloadUrl = await resolveFinalFileUrl(file.link);

                    // Fetch file content
                    const response = await fetch(downloadUrl);
                    if (!response.ok) return; // Skip if download fails

                    const blob = await response.blob();

                    // Use uploadOrUpdateFile which handles duplicates and subfolders automatically
                    await this.driveService.uploadOrUpdateFile(
                        blob,
                        file.name,
                        subjectFolder.id,
                        file.subfolder, // Pass subfolder path
                        blob.type
                    );

                    syncedCount++;
                    updateStatus({ syncedFiles: syncedCount });
                } catch (e) {
                    console.error(`Failed to sync file ${file.name}:`, e);
                }
            };

            // Simple concurrency loop
            const runBatch = async () => {
                const promises: Promise<void>[] = [];
                while (currentIndex < filesToSync.length) {
                    if (activeSyncs >= CONCURRENCY_LIMIT) {
                        await Promise.race(promises);
                    }

                    const file = filesToSync[currentIndex++];
                    const p = syncFile(file).then(() => {
                        activeSyncs--;
                        promises.splice(promises.indexOf(p), 1);
                    });

                    activeSyncs++;
                    promises.push(p);
                }
                await Promise.all(promises);
            };

            await runBatch();

            updateStatus({ status: 'synced', lastSync: Date.now() });

        } catch (error) {
            console.error("Sync failed:", error);
            updateStatus({ status: 'error', error: (error as Error).message });
            throw error;
        }
    }
    /**
     * Sync all stored subjects
     * Sync all subjects
     */
    public async syncAllSubjects(): Promise<void> {
        console.log('[SyncService] 🚀 Starting global sync...');

        // Set syncing status
        await chrome.storage.local.set({
            syncStatus: { isSyncing: true, lastSyncTime: null, error: null }
        });

        const subjects = await getAllStoredSubjects();
        const subjectsArray = Object.values(subjects);
        console.log(`[SyncService] Found ${subjectsArray.length} subjects to sync`);

        try {
            for (let i = 0; i < subjectsArray.length; i++) {
                const subject = subjectsArray[i];
                if (!subject.code) continue;

                console.log(`[SyncService] [${i + 1}/${subjectsArray.length}] Syncing: ${subject.fullName}`);
                try {
                    await this.syncSubject(subject.code);
                    console.log(`[SyncService]  ✅ ${subject.fullName} synced`);
                } catch (e) {
                    console.error(`[SyncService] ❌ Failed to sync ${subject.fullName}:`, e);
                }
            }

            // Set success status
            await chrome.storage.local.set({
                syncStatus: { isSyncing: false, lastSyncTime: Date.now(), error: null }
            });
            console.log('[SyncService] ✅ Global sync completed successfully');
        } catch (e: any) {
            console.error('[SyncService] ❌ Global sync failed:', e);
            // Set error status
            await chrome.storage.local.set({
                syncStatus: { isSyncing: false, lastSyncTime: null, error: e.message }
            });
            throw e;
        }
    }

    /**
     * Check if setup was dismissed
     */
    public async isSetupDismissed(): Promise<boolean> {
        const result = await chrome.storage.local.get(['driveSetupDismissed']);
        return !!result.driveSetupDismissed;
    }

    /**
     * Dismiss setup
     */
    public async dismissSetup(): Promise<void> {
        await chrome.storage.local.set({ driveSetupDismissed: true });
    }
}
