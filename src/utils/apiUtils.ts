import type { FileObject, StoredSubject } from "../types/calendarTypes";
import { fetchSubjects } from "../api/subjects";
import { fetchFilesFromFolder } from "../api/documents";
import { encryptData, decryptData } from "./encryption";

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Helper to get data from Chrome storage
async function getChromeStorageData<T>(key: string): Promise<T | null> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        return null;
    }

    try {
        const result = await chrome.storage.local.get(key);
        return (result[key] as T) || null;
    } catch (error) {
        console.error(`Error reading from Chrome storage (${key}):`, error);
        return null;
    }
}

// Helper to set data in Chrome storage
async function setChromeStorageData(key: string, value: any): Promise<void> {
    if (typeof chrome === 'undefined' || !chrome.storage) {
        return;
    }

    try {
        await chrome.storage.local.set({ [key]: value });
    } catch (error) {
        console.error(`Error writing to Chrome storage (${key}):`, error);
    }
}

export async function getStoredSubject(courseCode: string): Promise<StoredSubject | null> {
    try {
        const now = Date.now();
        const STORAGE_KEY = 'subjects_cache';

        // Try to load from Chrome storage first (data is now encrypted string)
        let subjectsCache = await getChromeStorageData<{ data: string, timestamp: number }>(STORAGE_KEY);

        // Check if cache is valid
        if (!subjectsCache || (now - subjectsCache.timestamp > CACHE_DURATION)) {
            const subjectsData = await fetchSubjects();

            if (!subjectsData) {
                return null;
            }

            // Encrypt data before storing
            const encryptedData = await encryptData(JSON.stringify(subjectsData.data));
            subjectsCache = {
                data: encryptedData,
                timestamp: now
            };
            await setChromeStorageData(STORAGE_KEY, subjectsCache);
        }

        try {
            // Decrypt data when reading from cache
            const decryptedData = await decryptData(subjectsCache.data);
            const parsedData = JSON.parse(decryptedData);
            const subject = parsedData[courseCode];

            if (!subject) {
                console.warn(`Subject ${courseCode} not found in subjects data`);
                return null;
            }

            return {
                fullName: subject.fullName,
                folderUrl: subject.folderUrl
            };
        } catch (error) {
            console.warn("Cache corruption detected (decryption/parse failed), clearing cache...", error);
            await setChromeStorageData(STORAGE_KEY, null);
            return null;
        }
    } catch (error) {
        console.error("Error fetching stored subject:", error);
        return null;
    }
}

export async function getFilesFromId(folderId: string | null): Promise<FileObject[] | null> {
    if (!folderId) return null;

    try {
        const now = Date.now();
        const STORAGE_KEY = `files_cache_${folderId}`;

        // Try to load from Chrome storage first (files now encrypted as string)
        const cachedData = await getChromeStorageData<{ files: string, timestamp: number }>(STORAGE_KEY);

        // If we have valid cache (5 minutes for files - fresh during lectures)
        const FILE_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (was 1 hour)
        if (cachedData && (now - cachedData.timestamp < FILE_CACHE_DURATION)) {
            // Check if data is encrypted (string) or legacy (array)
            if (typeof cachedData.files === 'string') {
                try {
                    // Decrypt cached files
                    const decryptedFiles = await decryptData(cachedData.files);
                    return JSON.parse(decryptedFiles);
                } catch (error) {
                    console.warn("Cache corruption detected (files), clearing cache...", error);
                    await setChromeStorageData(STORAGE_KEY, null);
                    // Fall through to fetch
                }
            }
        }

        // Construct the folder URL from the ID
        const folderUrl = `https://is.mendelu.cz/auth/dok_server/slozka.pl?id=${folderId}`;

        const files = await fetchFilesFromFolder(folderUrl);

        if (!files || files.length === 0) {
            return [];
        }

        // Encrypt files before storing
        const encryptedFiles = await encryptData(JSON.stringify(files));
        await setChromeStorageData(STORAGE_KEY, {
            files: encryptedFiles,
            timestamp: now
        });

        return files;
    } catch (error) {
        console.error("Error fetching files:", error);
        return null;
    }
}
