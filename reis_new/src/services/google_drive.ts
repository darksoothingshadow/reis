

// Scopes required for the application


interface DriveFile {
    id: string;
    name: string;
    mimeType: string;
    parents?: string[];
    modifiedTime?: string;
}

export class GoogleDriveService {
    private static instance: GoogleDriveService;
    private token: string | null = null;

    private constructor() { }

    public static getInstance(): GoogleDriveService {
        if (!GoogleDriveService.instance) {
            GoogleDriveService.instance = new GoogleDriveService();
        }
        return GoogleDriveService.instance;
    }

    /**
     * Authenticate with Google Drive using Chrome Identity API (via background script)
     */
    public async authenticate(): Promise<string> {
        console.log('[GoogleDrive] Sending auth request to background...');
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'AUTH_GOOGLE_DRIVE' }, (response) => {
                console.log('[GoogleDrive] Response received:', response);
                if (chrome.runtime.lastError) {
                    console.error('[GoogleDrive] Runtime error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                if (response && response.error) {
                    console.error('[GoogleDrive] Auth error from background:', response.error);
                    reject(new Error(response.error));
                    return;
                }
                if (response && response.token) {
                    console.log('[GoogleDrive] Token received successfully');
                    this.token = response.token;
                    resolve(response.token);
                } else {
                    console.error('[GoogleDrive] No token in response');
                    reject(new Error("No token received"));
                }
            });
        });
    }

    /**
     * Get the current valid token, refreshing if necessary (handled by Chrome)
     */
    public async getToken(): Promise<string> {
        if (this.token) return this.token;
        return this.authenticate();
    }

    /**
     * Revoke the current token (logout)
     */
    public async signOut(): Promise<void> {
        if (!this.token) return;

        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'REVOKE_TOKEN', token: this.token }, () => {
                this.token = null;
                resolve();
            });
        });
    }

    /**
     * Helper to perform authenticated fetch with retry logic (401 auth, 429/403 rate limit)
     */
    private async fetchWithAuth(url: string, options: RequestInit = {}, retries = 3): Promise<Response> {
        let token = await this.getToken();

        const makeRequest = async (t: string) => {
            return fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${t}`
                }
            });
        };

        let response = await makeRequest(token);

        // Handle Rate Limiting (429 Too Many Requests or 403 User Rate Limit Exceeded)
        if ((response.status === 429 || response.status === 403) && retries > 0) {
            const delay = Math.pow(2, 4 - retries) * 1000; // 2s, 4s, 8s
            console.log(`Rate limit hit (${response.status}). Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.fetchWithAuth(url, options, retries - 1);
        }

        // Handle Auth Expiration (401 Unauthorized)
        if (response.status === 401) {
            console.log("Token expired, refreshing...");
            await new Promise<void>((resolve) => {
                chrome.identity.removeCachedAuthToken({ token }, () => resolve());
            });
            this.token = null;
            token = await this.getToken();
            response = await makeRequest(token);
        }

        return response;
    }

    /**
     * List files in a specific folder
     */
    public async listFiles(folderId: string): Promise<DriveFile[]> {
        const query = `'${folderId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime)`;

        const response = await this.fetchWithAuth(url);

        if (!response.ok) throw new Error(`Failed to list files: ${response.statusText}`);

        const data = await response.json();
        return data.files || [];
    }

    /**
     * Search for a folder by name within a parent folder
     */
    public async searchFolder(name: string, parentId: string = 'root'): Promise<DriveFile | null> {
        const query = `mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and '${parentId}' in parents and trashed = false`;
        const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,parents)`;

        const response = await this.fetchWithAuth(url);

        if (!response.ok) throw new Error(`Failed to search folder: ${response.statusText}`);

        const data = await response.json();
        return data.files && data.files.length > 0 ? data.files[0] : null;
    }

    /**
     * Create a new folder
     */
    public async createFolder(name: string, parentId: string = 'root'): Promise<DriveFile> {
        const metadata = {
            name,
            mimeType: 'application/vnd.google-apps.folder',
            parents: [parentId]
        };

        const response = await this.fetchWithAuth('https://www.googleapis.com/drive/v3/files', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        });

        if (!response.ok) throw new Error(`Failed to create folder: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Create a folder or return existing folder ID
     */
    public async ensureFolder(name: string, parentId: string): Promise<DriveFile> {
        // Search for existing folder
        const existing = await this.searchFolder(name, parentId);
        if (existing) return existing;

        // Create new folder
        return await this.createFolder(name, parentId);
    }

    /**
     * Upload file or update if it already exists
     * Handles subfolder creation automatically
     */
    public async uploadOrUpdateFile(
        fileBlob: Blob,
        name: string,
        parentId: string,
        subfolderPath?: string,
        mimeType: string = 'application/pdf'
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

        // Check if file already exists in target folder
        const query = `name='${name.replace(/'/g, "\\'")}' and '${targetFolderId}' in parents and trashed=false`;
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

    /**
     * Upload a file to Drive (Multipart upload for metadata + content)
     */
    public async uploadFile(
        fileBlob: Blob,
        name: string,
        parentId: string,
        mimeType: string = 'application/pdf'
    ): Promise<DriveFile> {
        const metadata = {
            name,
            mimeType,
            parents: [parentId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', fileBlob);

        const response = await this.fetchWithAuth('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            body: form
        });

        if (!response.ok) throw new Error(`Failed to upload file: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Update an existing file's content
     */
    public async updateFile(
        fileId: string,
        fileBlob: Blob
    ): Promise<DriveFile> {
        // Simple upload for content update
        const response = await this.fetchWithAuth(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, {
            method: 'PATCH',
            headers: {
                'Content-Type': fileBlob.type
            },
            body: fileBlob
        });

        if (!response.ok) throw new Error(`Failed to update file: ${response.statusText}`);
        return await response.json();
    }

    /**
     * Validate that a folder ID exists and is accessible
     */
    public async validateFolderId(folderId: string): Promise<boolean> {
        try {
            const response = await this.fetchWithAuth(
                `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`
            );

            if (!response.ok) return false;

            const file = await response.json();
            // Must be a folder
            return file.mimeType === 'application/vnd.google-apps.folder';
        } catch (e) {
            console.error('[GoogleDrive] Failed to validate folder ID:', e);
            return false;
        }
    }
}
