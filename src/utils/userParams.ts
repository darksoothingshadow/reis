/**
 * User Parameters - Study and period IDs.
 * 
 * Read from storage (populated by syncUserParams or on first use).
 * No TTL expiry - data persists until manually refreshed.
 */

import { fetchWithAuth, BASE_URL } from "../api/client";
import { StorageService } from "../services/storage";
import { STORAGE_KEYS } from "../services/storage/keys";

export interface UserParams {
    studium: string;
    obdobi: string;
    facultyId: string;
}

/**
 * Get user params from storage.
 * If not in storage, fetches once and stores permanently.
 */
export async function getUserParams(): Promise<UserParams | null> {
    console.debug('[getUserParams] Getting user params');

    // Try to get from storage
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);

    if (cached && cached.studium && cached.obdobi && cached.facultyId) {
        console.debug('[getUserParams] Returning stored params:', cached);
        return cached;
    }

    console.debug('[getUserParams] Not in storage or incomplete, fetching from IS...');

    // Fetch from IS
    try {
        // 1. Get Studium and Obdobi from studium.pl
        const studResponse = await fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`);
        const studHtml = await studResponse.text();

        const paramRegex = /studium=(\d+);obdobi=(\d+)/;
        const paramMatch = studHtml.match(paramRegex);

        if (!paramMatch) {
            console.debug('[getUserParams] No studium/obdobi found');
            return null;
        }

        const studium = paramMatch[1];
        const obdobi = paramMatch[2];

        // 2. Get Faculty ID from moje_studium.pl
        const mojeResponse = await fetchWithAuth(`${BASE_URL}/auth/student/moje_studium.pl?lang=cz`);
        const mojeHtml = await mojeResponse.text();

        // Extract facultyId from links, prioritizing Harmonogram or Kontakt
        // Pattern: look for fakulta=(\d+) in link HREFs
        const facultyRegex = /fakulta=(\d+)/;
        const facultyMatch = mojeHtml.match(facultyRegex);
        
        const facultyId = facultyMatch ? facultyMatch[1] : '2'; // Default to PEF (2) if not found
        
        if (!facultyMatch) {
            console.warn('[getUserParams] Faculty ID not found in moje_studium.pl, defaulting to 2 (PEF)');
        }

        const params: UserParams = {
            studium,
            obdobi,
            facultyId
        };

        console.debug('[getUserParams] Parsed and stored params:', params);
        StorageService.set(STORAGE_KEYS.USER_PARAMS, params);
        return params;

    } catch (error) {
        console.error("[getUserParams] Failed to fetch user params:", error);
    }

    return null;
}

/**
 * Synchronous getter for studium from storage.
 * Returns null if not cached (caller should handle gracefully).
 * Use this for URL injection where async isn't practical.
 */
export function getStudiumSync(): string | null {
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);
    return cached?.studium ?? null;
}

export function getFacultySync(): string | null {
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);
    return cached?.facultyId ?? null;
}

