import { fetchWithAuth, BASE_URL } from "../api/client";

export interface UserParams {
    studium: string;
    obdobi: string;
}

const STORAGE_KEY = 'reis_user_params';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export async function getUserParams(): Promise<UserParams | null> {
    // 1. Try to get from cache
    try {
        const result = await chrome.storage.local.get(STORAGE_KEY);
        const cached = result[STORAGE_KEY] as { data: UserParams, timestamp: number };

        if (cached && cached.timestamp && (Date.now() - cached.timestamp < CACHE_DURATION)) {
            return cached.data;
        }
    } catch (e) {
        console.warn("Failed to read user params from cache", e);
    }

    // 2. Fetch from IS
    try {
        // Fetching the main auth page usually redirects or contains links with the current period and study ID
        // A reliable place to find these is often the "Student" page or similar.
        // Let's try fetching the main student page which usually has these links.
        const response = await fetchWithAuth(`${BASE_URL}/auth/student/studium.pl`);
        const html = await response.text();

        // Parse the HTML to find links containing studium=...;obdobi=...
        // Example: .../auth/student/terminy_seznam.pl?studium=XXXXXX;obdobi=XXX;lang=cz
        const regex = /studium=(\d+);obdobi=(\d+)/;
        const match = html.match(regex);

        if (match && match[1] && match[2]) {
            const params: UserParams = {
                studium: match[1],
                obdobi: match[2]
            };

            // Cache the result
            await chrome.storage.local.set({
                [STORAGE_KEY]: {
                    data: params,
                    timestamp: Date.now()
                }
            });

            return params;
        }
    } catch (error) {
        console.error("Failed to fetch user params:", error);
    }

    return null;
}
