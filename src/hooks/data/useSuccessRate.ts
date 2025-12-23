/**
 * Hook to access success rate data for a specific subject.
 * Simplified: reads from storage, fetches from API if not cached.
 */
import { useState, useEffect, useCallback } from 'react';
import { getStoredSuccessRates, fetchSubjectSuccessRates } from '../../api/successRate';
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
 * Hook to access success rate data for a specific subject.
 * Reads from storage, fetches from API if not cached or expired.
 */
export function useSuccessRate(courseCode: string | undefined): UseSuccessRateResult {
    const [loading, setLoading] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    // Read from storage
    const stats = courseCode 
        ? getStoredSuccessRates()?.data[courseCode] || null 
        : null;

    const doFetch = useCallback(async (code: string) => {
        setLoading(true);
        try {
            loggers.ui.info('[useSuccessRate] Fetching stats for:', code);
            await fetchSubjectSuccessRates([code]);
            setHasFetched(true);
        } catch (err) {
            loggers.ui.error('[useSuccessRate] Fetch failed:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch if no cached data
    useEffect(() => {
        if (!courseCode) return;
        if (stats) {
            loggers.ui.debug('[useSuccessRate] Using cached data for', courseCode);
            setHasFetched(true);
            return;
        }
        if (hasFetched) return; // Already tried
        
        loggers.ui.info('[useSuccessRate] No cached data, fetching from API', courseCode);
        doFetch(courseCode);
    }, [courseCode, stats, hasFetched, doFetch]);

    const refresh = useCallback(async () => {
        if (!courseCode) return;
        await doFetch(courseCode);
    }, [courseCode, doFetch]);

    const isGlobalLoaded = !!getStoredSuccessRates();

    return { stats, loading, hasFetched: hasFetched || !!stats, isGlobalLoaded, refresh };
}
