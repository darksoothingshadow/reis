import React, { useState } from 'react';
import { RefreshCw, Check, AlertCircle, Cloud } from 'lucide-react';
import { SyncService } from '../services/sync_service';
import type { SyncStatus } from '../services/sync_service';

interface SyncStatusIndicatorProps {
    courseCode: string;
}

export function SyncStatusIndicator({ courseCode }: SyncStatusIndicatorProps) {
    const [status, setStatus] = useState<SyncStatus['status']>('idle');
    const [details, setDetails] = useState<Partial<SyncStatus>>({});

    const syncService = SyncService.getInstance();

    const handleSync = async (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();

        try {
            setStatus('syncing');
            await syncService.syncSubject(courseCode, (progress) => {
                setStatus(progress.status);
                setDetails(progress);
            });
            setStatus('synced');
        } catch (error) {
            setStatus('error');
            console.error(error);
        }
    };

    // Initial sync on mount if not synced recently? 
    // For now, we just show the button/status. 
    // Ideally we'd check if it was synced recently.

    return (
        <div
            className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-100 transition-colors cursor-pointer group relative"
            onClick={handleSync}
            title={status === 'error' ? 'Chyba synchronizace' : 'Synchronizovat s Google Drive'}
        >
            {status === 'idle' && (
                <Cloud size={18} className="text-gray-500 group-hover:text-[#8DC843]" />
            )}

            {status === 'syncing' && (
                <RefreshCw size={18} className="text-[#8DC843] animate-spin" />
            )}

            {status === 'synced' && (
                <Check size={18} className="text-[#8DC843]" />
            )}

            {status === 'error' && (
                <AlertCircle size={18} className="text-red-500" />
            )}

            {/* Tooltip/Status Text */}
            <span className="text-xs text-gray-500 hidden group-hover:block absolute top-full mt-1 bg-white border border-gray-200 p-2 rounded shadow-lg z-50 whitespace-nowrap">
                {status === 'idle' && "Synchronizovat s Google Drive"}
                {status === 'syncing' && `Synchronizace... ${details.syncedFiles || 0}/${details.totalFiles || '?'} souborů`}
                {status === 'synced' && "Synchronizováno"}
                {status === 'error' && "Chyba synchronizace"}
            </span>
        </div>
    );
}
