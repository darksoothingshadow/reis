import { useState, useEffect, useCallback } from 'react';
import { getStoredSuccessRates, fetchSubjectSuccessRates } from '../../api/successRate';
import { StorageService, STORAGE_KEYS } from '../../services/storage';
import type { SubjectSuccessRate } from '../../types/documents';
import { loggers } from '../../utils/logger';

export interface UseSuccessRateResult {
    stats: SubjectSuccessRate | null;
    loading: boolean;
    hasFetched: boolean;
    isGlobalLoaded: boolean;
    refresh: () => Promise<void>;
}

/**
 * Get set of course codes that have already been fetched (from localStorage).
 */
function getFetchedSubjects(): Set<string> {
    const stored = StorageService.get<string[]>(STORAGE_KEYS.SUCCESS_RATES_FETCHED);
    return new Set(stored || []);
}

/**
 * Mark a course code as fetched (in localStorage).
 */
function markAsFetched(courseCode: string): void {
    const current = getFetchedSubjects();
    current.add(courseCode);
    StorageService.set(STORAGE_KEYS.SUCCESS_RATES_FETCHED, Array.from(current));
}

/**
 * Hook to access success rate data for a specific subject.
 * Reads from localStorage synchronously. Only fetches if never fetched before.
 */
export function useSuccessRate(courseCode: string | undefined): UseSuccessRateResult {
    const [, setTick] = useState(0);
    const [loading, setLoading] = useState(false);

    // Sync read from storage
    const stats = courseCode 
        ? getStoredSuccessRates()?.data[courseCode] || null 
        : null;
    
    // Check if we've already attempted to fetch this subject
    const hasFetched = courseCode ? getFetchedSubjects().has(courseCode) : false;

    const doFetch = useCallback(async (code: string) => {
        setLoading(true);
        try {
            loggers.ui.info('[useSuccessRate] Fetching stats for:', code);
            await fetchSubjectSuccessRates([code]);
            setTick(t => t + 1); // Force re-render to pick up new data
        } catch (err) {
            loggers.ui.error('[useSuccessRate] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Only fetch if: no stats AND never fetched this subject
    useEffect(() => {
        if (!courseCode) return;
        if (stats) {
            loggers.ui.debug('[useSuccessRate] Using cached data for', courseCode);
            return;
        }
        if (getFetchedSubjects().has(courseCode)) {
            loggers.ui.debug('[useSuccessRate] Already fetched (no data) for', courseCode);
            return;
        }
        
        // CRITICAL: Mark as fetched BEFORE starting async fetch to prevent race condition
        markAsFetched(courseCode);
        loggers.ui.info('[useSuccessRate] No cached data, fetching', courseCode);
        doFetch(courseCode);
    }, [courseCode, stats, doFetch]);

    const refresh = useCallback(async () => {
        if (!courseCode) return;
        await doFetch(courseCode);
    }, [courseCode, doFetch]);

    const isGlobalLoaded = StorageService.get<boolean>(STORAGE_KEYS.SUCCESS_RATES_FETCHED) === true;

    return { stats, loading, hasFetched, isGlobalLoaded, refresh };
}

