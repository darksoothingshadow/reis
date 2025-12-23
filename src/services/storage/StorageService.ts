/**
 * StorageService - Abstraction over localStorage and chrome.storage for type-safe data persistence.
 * 
 * Pattern: Stale-while-revalidate
 * - Read from storage immediately (instant UI)
 * - Sync updates in background every 5 minutes
 * 
 * Use sync methods (get/set) for simple data.
 * Use async methods (getAsync/setAsync) for extension-persistent data (survives page reload).
 */

export const StorageService = {
    // ==========================================
    // SYNC METHODS (localStorage)
    // ==========================================

    /**
     * Get a value from localStorage, parsed as JSON.
     * Returns null if key doesn't exist or parsing fails.
     */
    get<T>(key: string): T | null {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return null;
            return JSON.parse(item) as T;
        } catch (error) {
            console.warn(`[StorageService] Failed to parse key "${key}":`, error);
            return null;
        }
    },

    /**
     * Set a value in localStorage as JSON.
     */
    set<T>(key: string, value: T): void {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`[StorageService] Failed to set key "${key}":`, error);
            // Could be quota exceeded - handle gracefully
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
                console.warn('[StorageService] Storage quota exceeded. Consider clearing old data.');
            }
        }
    },

    /**
     * Remove a key from localStorage.
     */
    remove(key: string): void {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn(`[StorageService] Failed to remove key "${key}":`, error);
        }
    },

    /**
     * Check if a key exists in localStorage.
     */
    has(key: string): boolean {
        return localStorage.getItem(key) !== null;
    },

    /**
     * Get all keys matching a prefix.
     * Useful for iterating over subject files.
     */
    getKeysWithPrefix(prefix: string): string[] {
        const keys: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                keys.push(key);
            }
        }
        return keys;
    },

    /**
     * Clear all reis-related keys from storage.
     * Useful for logout or data reset.
     */
    clearAll(): void {
        const keysToRemove = this.getKeysWithPrefix('reis_');
        keysToRemove.forEach(key => localStorage.removeItem(key));
        console.log(`[StorageService] Cleared ${keysToRemove.length} keys`);
    },

    // ==========================================
    // ASYNC METHODS (chrome.storage.local)
    // Use for data that must persist across extension contexts
    // ==========================================

    /**
     * Check if chrome.storage is available.
     */
    isChromeStorageAvailable(): boolean {
        return typeof chrome !== 'undefined' && !!chrome.storage?.local;
    },

    /**
     * Get a value from chrome.storage.local, parsed as JSON.
     * Returns null if key doesn't exist or chrome.storage is unavailable.
     */
    async getAsync<T>(key: string): Promise<T | null> {
        if (!this.isChromeStorageAvailable()) {
            console.debug('[StorageService] chrome.storage unavailable, falling back to localStorage');
            return this.get<T>(key);
        }

        try {
            const result = await chrome.storage.local.get(key);
            return (result[key] as T) ?? null;
        } catch (error) {
            console.warn(`[StorageService] Failed to get async key "${key}":`, error);
            return null;
        }
    },

    /**
     * Set a value in chrome.storage.local.
     */
    async setAsync<T>(key: string, value: T): Promise<void> {
        if (!this.isChromeStorageAvailable()) {
            console.debug('[StorageService] chrome.storage unavailable, falling back to localStorage');
            this.set(key, value);
            return;
        }

        try {
            await chrome.storage.local.set({ [key]: value });
        } catch (error) {
            console.error(`[StorageService] Failed to set async key "${key}":`, error);
        }
    },

    /**
     * Remove a key from chrome.storage.local.
     */
    async removeAsync(key: string): Promise<void> {
        if (!this.isChromeStorageAvailable()) {
            this.remove(key);
            return;
        }

        try {
            await chrome.storage.local.remove(key);
        } catch (error) {
            console.warn(`[StorageService] Failed to remove async key "${key}":`, error);
        }
    },

    /**
     * Subscribe to changes in chrome.storage.local.
     */
    onChanged(callback: (changes: { [key: string]: chrome.storage.StorageChange }) => void): () => void {
        if (!this.isChromeStorageAvailable()) return () => { };

        chrome.storage.local.onChanged.addListener(callback);
        return () => {
            chrome.storage.local.onChanged.removeListener(callback);
        };
    }
};
