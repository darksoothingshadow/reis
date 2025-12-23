/**
 * Success Rate API Client
 * 
 * Fetches success rates from the server API.
 * No more local DOM scraping - server handles everything.
 */

import { StorageService, STORAGE_KEYS } from "../services/storage";
import type { SubjectSuccessRate, SuccessRateData } from "../types/documents";

// JSDelivr CDN for GitHub-hosted data
// In development, you can run a local server: npx serve server/dist-data -l 8080
// and set CDN_BASE_URL = "http://localhost:8080"
const CDN_BASE_URL = "https://raw.githubusercontent.com/darksoothingshadow/reis-data/main";
const CACHE_EXPIRY = 30 * 24 * 60 * 60 * 1000; // 30 days

/**
 * Retrieves success rates from local storage.
 */
export function getStoredSuccessRates(): SuccessRateData | null {
    return StorageService.get<SuccessRateData>(STORAGE_KEYS.SUCCESS_RATES_DATA);
}

/**
 * Saves success rates to local storage.
 */
export function saveSuccessRates(data: SuccessRateData): void {
    StorageService.set(STORAGE_KEYS.SUCCESS_RATES_DATA, data);
}

/**
 * Check if cache is still valid for a given course code.
 */
function isCacheValid(courseCode: string): boolean {
    const lastSync = StorageService.get<Record<string, number>>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) || {};
    const lastSyncTime = lastSync[courseCode];
    if (!lastSyncTime) return false;
    return (Date.now() - lastSyncTime) < CACHE_EXPIRY;
}

/**
 * Mark a course code as synced.
 */
function markAsSynced(courseCodes: string[]): void {
    const lastSync = StorageService.get<Record<string, number>>(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC) || {};
    const now = Date.now();
    for (const code of courseCodes) {
        lastSync[code] = now;
    }
    StorageService.set(STORAGE_KEYS.GLOBAL_STATS_LAST_SYNC, lastSync);
}

/**
 * Fetches success rates for the given list of target course codes.
 * Uses GitHub-hosted static JSON files via JSDelivr CDN.
 * Returns a SuccessRateData object and saves it to storage.
 */
export async function fetchSubjectSuccessRates(targetCodes: string[]): Promise<SuccessRateData> {
    console.log(`[SuccessRate] Fetching ${targetCodes.length} courses from CDN...`);
    
    // 1. Check cache for each code
    const existing = getStoredSuccessRates();
    const results: Record<string, SubjectSuccessRate> = { ...(existing?.data || {}) };
    
    const codesToFetch = targetCodes.filter(code => {
        const cached = results[code];
        const hasCached = cached && cached.stats && cached.stats.length > 0;
        const cacheValid = isCacheValid(code);
        
        // Force re-fetch if data is missing the new sourceUrl metadata (Legacy data)
        const isLegacy = hasCached && cached.stats.some(s => !s.sourceUrl);
        
        return !hasCached || !cacheValid || isLegacy;
    });

    if (codesToFetch.length === 0) {
        console.log('[SuccessRate] All codes found in valid cache');
        return { lastUpdated: existing?.lastUpdated || new Date().toISOString(), data: results };
    }

    console.log(`[SuccessRate] Fetching ${codesToFetch.length} codes from CDN: ${codesToFetch.join(', ')}`);

    // 2. Fetch each course from CDN (parallel)
    const fetchPromises = codesToFetch.map(async (code) => {
        const url = `${CDN_BASE_URL}/subjects/${code}.json`;
        try {
            const response = await fetch(url);
            if (!response.ok) {
                if (response.status === 404) {
                    console.warn(`[SuccessRate] Course ${code} not found in CDN (404)`);
                    return null;
                }
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return await response.json() as SubjectSuccessRate;
        } catch (error) {
            console.error(`[SuccessRate] Failed to fetch ${code}:`, error);
            return null;
        }
    });

    const fetchedData = await Promise.all(fetchPromises);
    
    // 3. Merge with existing cache
    const successfulCodes: string[] = [];
    codesToFetch.forEach((code, i) => {
        if (fetchedData[i]) {
            results[code] = fetchedData[i]!;
            successfulCodes.push(code);
        }
    });

    // 4. Mark fetched codes as synced
    if (successfulCodes.length > 0) {
        markAsSynced(successfulCodes);
    }

    const finalResult: SuccessRateData = {
        lastUpdated: new Date().toISOString(),
        data: results
    };

    // 5. Save to storage
    saveSuccessRates(finalResult);
    console.log(`[SuccessRate] Cached ${successfulCodes.length}/${codesToFetch.length} courses from CDN`);

    return finalResult;
}

/**
 * Fetch global success rates (legacy compat - now just calls main function)
 */
export async function fetchGlobalSuccessRates(): Promise<SuccessRateData | null> {
    // This is now a no-op since we fetch on-demand per course
    // Kept for backwards compatibility
    return getStoredSuccessRates();
}
