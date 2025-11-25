import { useState, useEffect } from 'react';
import { CloudOff, Check, AlertCircle, Loader2 } from 'lucide-react';
import { SyncService } from '../services/sync_service';

interface SyncStatus {
    isSyncing: boolean;
    lastSyncTime: number | null;
    error: string | null;
}

export function GlobalSyncIndicator() {
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSync, setLastSync] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        checkStatus();
        const interval = setInterval(checkStatus, 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const checkStatus = async () => {
        const syncService = SyncService.getInstance();
        const settings = await syncService.getSettings();
        setIsAuthorized(settings.isAuthorized);

        // Check sync status from storage
        const status = await chrome.storage.local.get(['syncStatus']);
        if (status.syncStatus) {
            const syncStatus = status.syncStatus as SyncStatus;
            setIsSyncing(syncStatus.isSyncing);
            setLastSync(syncStatus.lastSyncTime);
            setError(syncStatus.error);
        }
    };

    const handleManualSync = async () => {
        if (!isAuthorized || isSyncing) return;

        setIsSyncing(true);
        setError(null);

        try {
            const syncService = SyncService.getInstance();
            await syncService.syncAllSubjects();
            await chrome.storage.local.set({
                syncStatus: { isSyncing: false, lastSyncTime: Date.now(), error: null }
            });
            setLastSync(Date.now());
        } catch (e: any) {
            setError(e.message);
            await chrome.storage.local.set({
                syncStatus: { isSyncing: false, lastSyncTime: lastSync, error: e.message }
            });
        } finally {
            setIsSyncing(false);
        }
    };

    const getTimeSinceLastSync = () => {
        if (!lastSync) return 'nikdy';
        const minutes = Math.floor((Date.now() - lastSync) / 60000);
        if (minutes < 1) return 'právě teď';
        if (minutes < 60) return `před ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        return `před ${hours}h`;
    };

    if (!isAuthorized) {
        return (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
                <CloudOff size={18} />
                <span className="hidden lg:inline">Nepřipojeno</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="flex items-center gap-2 text-sm hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            title={`Poslední synchronizace: ${getTimeSinceLastSync()}`}
        >
            {isSyncing ? (
                <Loader2 size={18} className="animate-spin text-blue-500" />
            ) : error ? (
                <AlertCircle size={18} className="text-red-500" />
            ) : (
                <Check size={18} className="text-green-500" />
            )}
            <span className="hidden lg:inline text-gray-600">
                {getTimeSinceLastSync()}
            </span>
        </button>
    );
}
