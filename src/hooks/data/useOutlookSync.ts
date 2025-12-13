/**
 * useOutlookSync - Hook for Outlook calendar sync status.
 * 
 * Provides current sync status and toggle function.
 */

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { outlookSyncService } from '../../services/sync';

export interface UseOutlookSyncResult {
    /** Current sync status (null = still loading) */
    isEnabled: boolean | null;
    /** Whether status is being checked/updated */
    isLoading: boolean;
    /** Toggle sync on/off */
    toggle: () => Promise<void>;
}

export function useOutlookSync(): UseOutlookSyncResult {
    const [isEnabled, setIsEnabled] = useState<boolean | null>(
        outlookSyncService.getStatus()
    );
    const [isLoading, setIsLoading] = useState(
        outlookSyncService.isRefreshing()
    );

    useEffect(() => {
        // Subscribe to status changes
        const unsubscribe = outlookSyncService.subscribe((status) => {
            setIsEnabled(status);
            setIsLoading(outlookSyncService.isRefreshing());
        });

        // Poll for loading state changes
        const interval = setInterval(() => {
            setIsLoading(outlookSyncService.isRefreshing());
        }, 500);

        return () => {
            unsubscribe();
            clearInterval(interval);
        };
    }, []);

    const toggle = useCallback(async () => {
        const wasEnabled = outlookSyncService.getStatus();
        setIsLoading(true);
        await outlookSyncService.toggle();
        setIsLoading(false);
        
        // Show success toast when enabling
        const nowEnabled = outlookSyncService.getStatus();
        if (!wasEnabled && nowEnabled) {
            toast.success('Do 15 minut uvidíš své hodiny a zkoušky v Outlooku', {
                duration: 6000,
                icon: '📅',
            });
        } else if (wasEnabled && !nowEnabled) {
            toast.info('Synchronizace s Outlookem vypnuta', {
                duration: 4000,
            });
        }
    }, []);

    return { isEnabled, isLoading, toggle };
}
