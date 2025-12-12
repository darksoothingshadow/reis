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
}

/**
 * Get user params from storage.
 * If not in storage, fetches once and stores permanently.
 */
export async function getUserParams(): Promise<UserParams | null> {
    console.debug('[getUserParams] Getting user params');

    // Try to get from storage
    const cached = StorageService.get<UserParams>(STORAGE_KEYS.USER_PARAMS);

    if (cached && cached.studium && cached.obdobi) {
        console.debug('[getUserParams] Returning stored params:', cached);
        return cached;
    }

    console.debug('[getUserParams] Not in storage, fetching from IS...');

    // Fetch from IS (only if not in storage)
    try {
        const response = await fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`);
        const html = await response.text();

        const regex = /studium=(\d+);obdobi=(\d+)/;
        const match = html.match(regex);

        if (match && match[1] && match[2]) {
            const params: UserParams = {
                studium: match[1],
                obdobi: match[2]
            };

            console.debug('[getUserParams] Parsed and stored params:', params);
            StorageService.set(STORAGE_KEYS.USER_PARAMS, params);
            return params;
        }

        console.debug('[getUserParams] No params found in HTML response');
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

