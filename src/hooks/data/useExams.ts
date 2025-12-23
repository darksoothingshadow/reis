/**
 * useExams - Hook to access exam data from storage.
 * 
 * Returns stored data immediately (stale-while-revalidate pattern).
 * Subscribes to sync updates for automatic refresh.
 * Includes error state for better UX feedback.
 */

import { useState, useEffect, useCallback } from 'react';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
import { syncService } from '../../services/sync';
import type { ExamSubject } from '../../types/exams';

export interface UseExamsResult {
    exams: ExamSubject[];
    isLoaded: boolean;
    error: string | null;
    lastSync: number | null;
    retry: () => void;
}

export function useExams(): UseExamsResult {
    const [exams, setExams] = useState<ExamSubject[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSync, setLastSync] = useState<number | null>(null);

    const loadFromStorage = useCallback(() => {
        try {
            const storedData = StorageService.get<ExamSubject[]>(STORAGE_KEYS.EXAMS_DATA);
            const storedLastSync = StorageService.get<number>(STORAGE_KEYS.LAST_SYNC);

            if (storedData && storedData.length > 0) {
                setExams(storedData);
                setError(null);
            } else {
                // No data yet - not an error, just empty
                setExams([]);
            }
            setLastSync(storedLastSync);
            setIsLoaded(true);
        } catch (err) {
            console.error('[useExams] Failed to load from storage:', err);
            setError('Nepodařilo se načíst data zkoušek.');
            setIsLoaded(true);
        }
    }, []);

    const retry = useCallback(() => {
        setIsLoaded(false);
        setError(null);
        loadFromStorage();
    }, [loadFromStorage]);

    useEffect(() => {
        loadFromStorage();

        // Subscribe to sync updates
        const unsubscribe = syncService.subscribe(() => {
            loadFromStorage();
        });

        return unsubscribe;
        // eslint-disable-next-line react-hooks/set-state-in-effect
    }, [loadFromStorage]);

    return { exams, isLoaded, error, lastSync, retry };
}

