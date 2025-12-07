/**
 * useDriveSync - Hook for Google Drive sync status and control.
 * 
 * Provides current auth status and toggle function.
 */

import { useState, useEffect, useCallback } from 'react';
import { GoogleDriveService } from '../../services/drive/GoogleDriveService';

export interface UseDriveSyncResult {
    /** Whether Drive is authenticated and enabled */
    isEnabled: boolean;
    /** Whether status is being updated (auth flow in progress) */
    isLoading: boolean;
    /** Toggle sync on/off (triggers auth flow) */
    toggle: () => Promise<void>;
}

export function useDriveSync(): UseDriveSyncResult {
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const driveService = GoogleDriveService.getInstance();

    // Initial check
    useEffect(() => {
        checkStatus();
    }, []);

    // Listen for storage changes to update UI across tabs/popups
    useEffect(() => {
        const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
            if (changes.driveSettings) {
                const settings = changes.driveSettings.newValue as { isAuthorized?: boolean } | undefined;
                setIsEnabled(!!settings?.isAuthorized);
            }
        };

        chrome.storage.local.onChanged.addListener(handleStorageChange);
        return () => {
            chrome.storage.local.onChanged.removeListener(handleStorageChange);
        };
    }, []);

    const checkStatus = async () => {
        try {
            const settings = await driveService.getSettings();
            setIsEnabled(!!settings.isAuthorized);
        } catch (e) {
            console.error('[useDriveSync] Failed to check status:', e);
        } finally {
            setIsLoading(false);
        }
    };

    const toggle = useCallback(async () => {
        setIsLoading(true);
        try {
            if (isEnabled) {
                // Disable: Sign out
                await driveService.signOut();
                // State update handled by storage listener
            } else {
                // Enable: Authenticate
                await driveService.authenticate();
                // If successful, prompt for folder setup? 
                // For now, authenticate handles default setup.
                // State update handled by storage listener
            }
        } catch (error) {
            console.error('[useDriveSync] Toggle failed:', error);
            // Re-check status in case of partial failure
            await checkStatus();
        } finally {
            setIsLoading(false);
        }
    }, [isEnabled, driveService]);

    return { isEnabled, isLoading, toggle };
}
