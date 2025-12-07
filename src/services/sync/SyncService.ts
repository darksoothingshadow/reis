/**
 * SyncService - Background data synchronization orchestrator.
 * 
 * Pattern: Stale-while-revalidate
 * - Components show stored data immediately
 * - Sync runs in background every 5 minutes
 * - Subscribers are notified when new data is available
 */

import { StorageService, STORAGE_KEYS } from '../storage';
import { syncExams } from './syncExams';
import { syncSchedule } from './syncSchedule';
import { syncSubjects } from './syncSubjects';
import { syncFiles } from './syncFiles';

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export type SyncStatus = {
    isSyncing: boolean;
    lastSync: number | null;
    error: string | null;
};

class SyncServiceClass {
    private intervalId: ReturnType<typeof setInterval> | null = null;
    private listeners: Set<() => void> = new Set();
    private isSyncing = false;

    /**
     * Start the background sync service.
     * Performs initial sync and schedules periodic syncs.
     */
    start(): void {
        if (this.intervalId) {
            console.warn('[SyncService] Already running');
            return;
        }

        console.log('[SyncService] Starting background sync (every 5 minutes)');

        // Initial sync (background, don't block UI)
        this.syncAll();

        // Schedule periodic sync
        this.intervalId = setInterval(() => {
            this.syncAll();
        }, SYNC_INTERVAL);
    }

    /**
     * Stop the background sync service.
     */
    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[SyncService] Stopped');
        }
    }

    /**
     * Force an immediate sync of all data.
     */
    async syncAll(): Promise<void> {
        if (this.isSyncing) {
            console.log('[SyncService] Sync already in progress, skipping');
            return;
        }

        this.isSyncing = true;
        StorageService.set(STORAGE_KEYS.SYNC_IN_PROGRESS, true);

        console.log('[SyncService] Starting sync...');
        const startTime = Date.now();

        try {
            // Run schedule, exams, subjects in parallel
            const results = await Promise.allSettled([
                syncSchedule(),
                syncExams(),
                syncSubjects(),
            ]);

            // Log any failures
            results.forEach((result, index) => {
                const syncNames = ['schedule', 'exams', 'subjects'];
                if (result.status === 'rejected') {
                    console.error(`[SyncService] ${syncNames[index]} sync failed:`, result.reason);
                }
            });

            // Sync files AFTER subjects (files depend on subjects data)
            try {
                await syncFiles();
            } catch (filesError) {
                console.error('[SyncService] files sync failed:', filesError);
            }

            // Update sync metadata
            StorageService.set(STORAGE_KEYS.LAST_SYNC, Date.now());
            StorageService.remove(STORAGE_KEYS.SYNC_ERROR);

            const duration = Date.now() - startTime;
            console.log(`[SyncService] Sync completed in ${duration}ms`);

            // Notify all subscribers
            this.notifyListeners();

        } catch (error) {
            console.error('[SyncService] Sync failed:', error);
            StorageService.set(STORAGE_KEYS.SYNC_ERROR, error instanceof Error ? error.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
            StorageService.remove(STORAGE_KEYS.SYNC_IN_PROGRESS);
        }
    }

    /**
     * Subscribe to sync updates.
     * Callback is called whenever new data is synced.
     * Returns unsubscribe function.
     */
    subscribe(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    /**
     * Get current sync status.
     */
    getStatus(): SyncStatus {
        return {
            isSyncing: this.isSyncing,
            lastSync: StorageService.get<number>(STORAGE_KEYS.LAST_SYNC),
            error: StorageService.get<string>(STORAGE_KEYS.SYNC_ERROR),
        };
    }

    /**
     * Notify all subscribers of data update.
     */
    private notifyListeners(): void {
        this.listeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.error('[SyncService] Listener error:', error);
            }
        });
    }
}

// Singleton instance
export const syncService = new SyncServiceClass();
