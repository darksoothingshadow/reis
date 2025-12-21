/**
 * SyncService - Background data synchronization orchestrator.
 * 
 * Pattern: Stale-while-revalidate
 * - Components show stored data immediately
 * - Sync runs periodically while the page is open
 * - Subscribers are notified when new data is available
 */

import { StorageService, STORAGE_KEYS } from '../storage';
import { loggers } from '../../utils/logger';
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
     */
    start(): void {
        if (this.intervalId) {
            loggers.system.warn('[SyncService] Already running');
            return;
        }

        loggers.system.info('[SyncService] Starting background sync');
        this.syncAll();
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
            loggers.system.info('[SyncService] Stopped');
        }
    }

    /**
     * Force an immediate sync of all data.
     */
    async syncAll(): Promise<void> {
        if (this.isSyncing) {
            loggers.system.info('[SyncService] Sync already in progress, skipping');
            return;
        }

        this.isSyncing = true;
        StorageService.set(STORAGE_KEYS.SYNC_IN_PROGRESS, true);

        loggers.system.info('[SyncService] Starting sync...');
        const startTime = Date.now();

        try {
            const results = await Promise.allSettled([
                syncSchedule(),
                syncExams(),
                syncSubjects(),
            ]);

            results.forEach((result, index) => {
                const syncNames = ['schedule', 'exams', 'subjects'];
                if (result.status === 'rejected') {
                    loggers.system.error(`[SyncService] ${syncNames[index]} sync failed:`, result.reason);
                }
            });

            try {
                await syncFiles();
            } catch (filesError) {
                loggers.system.error('[SyncService] files sync failed:', filesError);
            }

            StorageService.set(STORAGE_KEYS.LAST_SYNC, Date.now());
            StorageService.remove(STORAGE_KEYS.SYNC_ERROR);

            const duration = Date.now() - startTime;
            loggers.system.info(`[SyncService] Sync completed in ${duration}ms`);

            this.notifyListeners();

        } catch (error) {
            loggers.system.error('[SyncService] Sync failed:', error);
            StorageService.set(STORAGE_KEYS.SYNC_ERROR, error instanceof Error ? error.message : 'Unknown error');
        } finally {
            this.isSyncing = false;
            StorageService.remove(STORAGE_KEYS.SYNC_IN_PROGRESS);
        }
    }

    subscribe(callback: () => void): () => void {
        this.listeners.add(callback);
        return () => {
            this.listeners.delete(callback);
        };
    }

    getStatus(): SyncStatus {
        return {
            isSyncing: this.isSyncing,
            lastSync: StorageService.get<number>(STORAGE_KEYS.LAST_SYNC),
            error: StorageService.get<string>(STORAGE_KEYS.SYNC_ERROR),
        };
    }

    triggerRefresh(): void {
        loggers.system.debug('[SyncService] triggerRefresh called, notifying listeners');
        this.notifyListeners();
    }

    private notifyListeners(): void {
        this.listeners.forEach(callback => {
            try {
                callback();
            } catch (error) {
                loggers.system.error('[SyncService] Listener error:', error);
            }
        });
    }
}

export const syncService = new SyncServiceClass();
