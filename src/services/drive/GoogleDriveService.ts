/**
 * Google Drive API service for file and folder operations.
 * 
 * Uses the background service worker for OAuth token management.
 * Implements rate limit handling with exponential backoff and jitter.
 */

import { DRIVE_CONSTANTS } from '../../constants/drive';

// ============================================================================
// Types
// ============================================================================

export interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    modifiedTime?: string;
}

export interface DriveSettings {
    isAuthorized: boolean;
    rootFolderId: string | null;
    rootFolderName: string | null;
    accountEmail?: string;
}

// ============================================================================
// GoogleDriveService
// ============================================================================

export class GoogleDriveService {
    private static instance: GoogleDriveService;

    private constructor() { }

    public static getInstance(): GoogleDriveService {
        if (!GoogleDriveService.instance) {
            GoogleDriveService.instance = new GoogleDriveService();
        }
        return GoogleDriveService.instance;
    }

    // ========================================================================
    // Authentication
    // ========================================================================

    /**
     * Authenticate with Google Drive (interactive - shows OAuth popup).
     */
    public async authenticate(): Promise<string> {
        return this.sendMessage({ type: 'AUTH_GOOGLE_DRIVE', interactive: true });
    }

    /**
     * Get a valid access token (silent - uses cached or refreshed token).
     */
    public async getToken(): Promise<string> {
        return this.sendMessage({ type: 'GET_DRIVE_TOKEN' });
    }

    /**
     * Sign out and revoke tokens.
     */
    public async signOut(): Promise<void> {
        await this.sendMessageRaw({ type: 'REVOKE_DRIVE_TOKEN' });
    }

    /**
     * Check authentication status.
     */
    public async getAuthStatus(): Promise<{ isAuthenticated: boolean; email?: string }> {
        return this.sendMessageRaw({ type: 'GET_DRIVE_STATUS' });
    }

    /**
     * Send message to background and extract token.
     */
    private async sendMessage(message: object): Promise<string> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                if (response?.token) {
                    resolve(response.token);
                } else {
                    reject(new Error('No token received'));
                }
            });
        });
    }

    /**
     * Send message to background and return raw response.
     */
    private async sendMessageRaw<T>(message: object): Promise<T> {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response?.error) {
                    reject(new Error(response.error));
                    return;
                }
                resolve(response as T);
            });
        });
    }

    // ========================================================================
    // API Helpers
    // ========================================================================

    /**
     * Perform authenticated fetch with retry logic for rate limits and auth errors.
     */
    private async fetchWithAuth(
        url: string,
        options: RequestInit = {},
        retries = 5
    ): Promise<Response> {
        const token = await this.getToken();

        const response = await fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                Authorization: `Bearer ${token}`
            }
        });

        // Rate limit handling (429 Too Many Requests or 403 User Rate Limit Exceeded)
        if ((response.status === 429 || response.status === 403) && retries > 0) {
            const retryAfter = response.headers.get('Retry-After');
            const baseDelay = retryAfter
                ? parseInt(retryAfter) * 1000
                : Math.pow(2, 5 - retries) * 1000;

            // Add jitter (0-25% of delay) to prevent thundering herd
            const jitter = Math.random() * baseDelay * 0.25;
            const delay = baseDelay + jitter;

            console.log(`[GoogleDrive] Rate limited (${response.status}). Retry in ${Math.round(delay)}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.fetchWithAuth(url, options, retries - 1);
        }

        // Token expired - try to refresh
        if (response.status === 401 && retries > 0) {
            console.log('[GoogleDrive] Token invalid, retrying...');
            return this.fetchWithAuth(url, options, retries - 1);
        }

        return response;
    }

    // ========================================================================
    // Folder Operations
    // ========================================================================

    /**
     * Search for a folder by name within a parent folder.
     */
    public async searchFolder(name: string, parentId: string = 'root'): Promise<DriveFile | null> {
        const query = `mimeType = '${DRIVE_CONSTANTS.MIME_TYPE_FOLDER}' and name = '${name.replace(/'/g, "\\'")}' and '${parentId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)`;

        const response = await this.fetchWithAuth(url);

        if (!response.ok) {
            throw new Error(`Failed to search folder: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    }

    /**
     * Create a new folder.
     */
    public async createFolder(name: string, parentId: string = 'root'): Promise<DriveFile> {
        const metadata = {
            name,
            mimeType: DRIVE_CONSTANTS.MIME_TYPE_FOLDER,
            parents: [parentId]
        };

        const response = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) {
            throw new Error(`Failed to create folder: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Ensure a folder exists (search or create).
     */
    public async ensureFolder(name: string, parentId: string): Promise<DriveFile> {
        const existing = await this.searchFolder(name, parentId);
        if (existing) return existing;
        return await this.createFolder(name, parentId);
    }

    /**
     * Validate that a folder ID exists and is accessible.
     */
    public async validateFolderId(folderId: string): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`
            );

            if (!response.ok) return false;

            const file = await response.json();
            return file.mimeType === DRIVE_CONSTANTS.MIME_TYPE_FOLDER;
        } catch {
            return false;
        }
    }

    /**
     * List files in a folder.
     */
    public async listFiles(folderId: string): Promise<DriveFile[]> {
        const query = `'${folderId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)`;

        const response = await this.fetchWithAuth(url);

        if (!response.ok) {
            throw new Error(`Failed to list files: ${response.statusText}`);
        }

        const data = await response.json();
        return data.files || [];
    }

    // ========================================================================
    // File Operations
    // ========================================================================

    /**
     * Upload a file to Drive (multipart upload for metadata + content).
     */
    public async uploadFile(
        fileBlob: Blob,
        name: string,
        parentId: string,
        mimeType: string = 'application/octet-stream'
    ): Promise<DriveFile> {
        const metadata = {
            name,
            mimeType,
            parents: [parentId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob);

        const response = await this.fetchWithAuth(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: 'POST',
                body: form
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to upload file: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Update an existing file's content.
     */
    public async updateFile(fileId: string, fileBlob: Blob): Promise<DriveFile> {
        const response = await this.fetchWithAuth(
            `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
            {
                method: 'PATCH',
                headers: { 'Content-Type': fileBlob.type || 'application/octet-stream' },
                body: fileBlob
            }
        );

        if (!response.ok) {
            throw new Error(`Failed to update file: ${response.statusText}`);
        }

        return await response.json();
    }

    /**
     * Upload or update a file (checks for existing file first).
     */
    public async uploadOrUpdateFile(
        fileBlob: Blob,
        name: string,
        parentId: string,
        subfolderPath?: string,
        mimeType: string = 'application/octet-stream'
    ): Promise<DriveFile> {
        // Handle subfolder creation if path provided
        let targetFolderId = parentId;
        if (subfolderPath && subfolderPath.trim()) {
            const folders = subfolderPath.split('/').filter(f => f.trim());
            for (const folderName of folders) {
                const folder = await this.ensureFolder(folderName, targetFolderId);
                targetFolderId = folder.id;
            }
        }

        // Check if file already exists
        const escapedName = name.replace(/'/g, "\\'");
        const query = `name='${escapedName}' and '${targetFolderId}' in parents and trashed=false`;
        const response = await this.fetchWithAuth(
            `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`
        );

        if (!response.ok) {
            throw new Error(`Failed to search for existing file: ${response.statusText}`);
        }

        const data = await response.json();
        const existingFile = data.files?.[0];

        if (existingFile) {
            // File exists, update it
            return await this.updateFile(existingFile.id, fileBlob);
        } else {
            // File doesn't exist, upload new
            return await this.uploadFile(fileBlob, name, targetFolderId, mimeType);
        }
    }

    // ========================================================================
    // Settings Management
    // ========================================================================

    /**
     * Get Drive settings from storage.
     */
    public async getSettings(): Promise<DriveSettings> {
        const result = await chrome.storage.local.get(['driveSettings']);
        return (result.driveSettings as DriveSettings) || {
            isAuthorized: false,
            rootFolderId: null,
            rootFolderName: null
        };
    }

    /**
     * Save Drive settings to storage.
     */
    public async saveSettings(settings: DriveSettings): Promise<void> {
        await chrome.storage.local.set({ driveSettings: settings });
    }

    /**
     * Clear Drive settings (disconnect).
     */
    public async clearSettings(): Promise<void> {
        await chrome.storage.local.remove(['driveSettings']);
    }
}
