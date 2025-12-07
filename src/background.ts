/**
 * Background service worker for Chrome extension.
 * 
 * Responsibilities:
 * - OAuth2 PKCE flow for Google Drive authentication
 * - Token management (storage, refresh, revocation)
 * - Auto-sync alarm (every 5 minutes)
 * - Offscreen document coordination for background sync
 */

import { generateCodeVerifier, generateCodeChallenge } from './utils/pkce';
import { DRIVE_CONSTANTS } from './constants/drive';

console.log('[Background] Service worker started');

// ============================================================================
// Types
// ============================================================================

interface DriveTokens {
    access_token: string;
    refresh_token: string;
    expires_at: number;
    email?: string;
}

interface AuthResponse {
    token?: string;
    error?: string;
}

// ============================================================================
// OAuth2 PKCE Flow
// ============================================================================

/**
 * Handle the complete OAuth2 PKCE flow.
 */
async function handleOAuthFlow(interactive: boolean): Promise<AuthResponse> {
    console.log(`[Background] handleOAuthFlow called (interactive: ${interactive})`);

    // Check for existing valid token first
    const existing = await getStoredTokens();
    if (existing && existing.expires_at > Date.now() + 60000) {
        console.log('[Background] Using cached token (still valid)');
        return { token: existing.access_token };
    }

    // Try refresh if we have refresh token
    if (existing?.refresh_token) {
        try {
            console.log('[Background] Attempting token refresh...');
            const refreshed = await refreshAccessToken(existing.refresh_token);
            return { token: refreshed.access_token };
        } catch (e) {
            console.log('[Background] Refresh failed:', e);
            // Clear invalid tokens
            await chrome.storage.local.remove(['driveTokens']);
        }
    }

    // Need new authorization
    if (!interactive) {
        return { error: 'No valid token. Interactive auth required.' };
    }

    try {
        // Generate PKCE verifier/challenge
        const codeVerifier = generateCodeVerifier();
        const codeChallenge = await generateCodeChallenge(codeVerifier);

        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2?.client_id;
        const scopes = manifest.oauth2?.scopes?.join(' ');
        const redirectUri = chrome.identity.getRedirectURL();

        if (!clientId || !scopes) {
            return { error: 'Missing OAuth2 configuration in manifest' };
        }

        console.log('[Background] Redirect URI:', redirectUri);

        const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', redirectUri);
        authUrl.searchParams.set('scope', scopes);
        authUrl.searchParams.set('access_type', 'offline');
        authUrl.searchParams.set('prompt', 'consent'); // Force new refresh token
        authUrl.searchParams.set('code_challenge', codeChallenge);
        authUrl.searchParams.set('code_challenge_method', 'S256');

        console.log('[Background] Launching auth flow...');

        const resultUrl = await chrome.identity.launchWebAuthFlow({
            url: authUrl.toString(),
            interactive: true
        });

        if (!resultUrl) {
            return { error: 'Auth flow cancelled' };
        }

        // Extract authorization code
        const url = new URL(resultUrl);
        const code = url.searchParams.get('code');
        if (!code) {
            return { error: 'No authorization code received' };
        }

        console.log('[Background] Got authorization code, exchanging for tokens...');

        // Exchange code for tokens
        const tokens = await exchangeCodeForTokens(code, codeVerifier, redirectUri, clientId);

        // Store tokens
        await chrome.storage.local.set({ driveTokens: tokens });
        console.log('[Background] Tokens stored successfully');

        return { token: tokens.access_token };

    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Background] OAuth flow error:', message);
        return { error: message };
    }
}

/**
 * Exchange authorization code for access and refresh tokens.
 */
async function exchangeCodeForTokens(
    code: string,
    codeVerifier: string,
    redirectUri: string,
    clientId: string
): Promise<DriveTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code,
            client_id: clientId,
            code_verifier: codeVerifier,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            client_secret: DRIVE_CONSTANTS.CLIENT_SECRET
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    // Optionally fetch user email
    let email: string | undefined;
    try {
        const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (userInfo.ok) {
            const info = await userInfo.json();
            email = info.email;
        }
    } catch {
        // Non-critical, continue without email
    }

    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000),
        email
    };
}

/**
 * Refresh an access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<DriveTokens> {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2?.client_id;

    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId!,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_secret: DRIVE_CONSTANTS.CLIENT_SECRET
        })
    });

    if (!response.ok) {
        throw new Error('Refresh token expired or revoked');
    }

    const data = await response.json();

    // Get existing tokens for email
    const existing = await getStoredTokens();

    const tokens: DriveTokens = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken, // May not return new refresh
        expires_at: Date.now() + (data.expires_in * 1000),
        email: existing?.email
    };

    await chrome.storage.local.set({ driveTokens: tokens });
    console.log('[Background] Token refreshed successfully');
    return tokens;
}

/**
 * Get a valid access token, refreshing if necessary.
 */
async function getValidAccessToken(): Promise<string> {
    const tokens = await getStoredTokens();

    if (!tokens) {
        throw new Error('Not authenticated');
    }

    // Check if token is about to expire (1 min buffer)
    if (tokens.expires_at < Date.now() + 60000) {
        const refreshed = await refreshAccessToken(tokens.refresh_token);
        return refreshed.access_token;
    }

    return tokens.access_token;
}

/**
 * Get stored tokens from chrome.storage.local
 */
async function getStoredTokens(): Promise<DriveTokens | null> {
    const result = await chrome.storage.local.get(['driveTokens']);
    return (result.driveTokens as DriveTokens) || null;
}

/**
 * Revoke tokens and clear stored data.
 */
async function revokeDriveTokens(): Promise<void> {
    const tokens = await getStoredTokens();
    if (tokens?.access_token) {
        try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${tokens.access_token}`, {
                method: 'POST'
            });
            console.log('[Background] Token revoked at Google');
        } catch (e) {
            console.error('[Background] Failed to revoke token:', e);
        }
    }
    await chrome.storage.local.remove(['driveTokens', 'driveSettings']);
    console.log('[Background] Drive tokens and settings cleared');
}

// ============================================================================
// Offscreen Document Management
// ============================================================================

const OFFSCREEN_DOC_PATH = 'offscreen.html';
let creatingOffscreen: Promise<void> | null = null;

/**
 * Ensure offscreen document exists for background operations.
 */
async function setupOffscreenDocument(): Promise<void> {
    const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOC_PATH);

    // Check if already exists
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT' as chrome.runtime.ContextType],
        documentUrls: [offscreenUrl]
    });

    if (existingContexts.length > 0) {
        return;
    }

    // Avoid race conditions
    if (creatingOffscreen) {
        await creatingOffscreen;
    } else {
        creatingOffscreen = chrome.offscreen.createDocument({
            url: OFFSCREEN_DOC_PATH,
            reasons: [chrome.offscreen.Reason.BLOBS],
            justification: 'Sync files to Google Drive in background'
        });
        await creatingOffscreen;
        creatingOffscreen = null;
    }

    console.log('[Background] Offscreen document created');
}

// ============================================================================
// Auto-Sync Alarm
// ============================================================================

// Set up auto-sync alarm on install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed/updated');
    chrome.alarms.create('drive-auto-sync', {
        periodInMinutes: DRIVE_CONSTANTS.SYNC_INTERVAL_MINUTES
    });
    console.log(`[Background] Auto-sync alarm created (every ${DRIVE_CONSTANTS.SYNC_INTERVAL_MINUTES} minutes)`);
});

// Handle auto-sync alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'drive-auto-sync') {
        console.log('[Background] Auto-sync alarm fired');

        // Check if Drive sync is enabled
        const result = await chrome.storage.local.get(['driveSettings']);
        const driveSettings = result.driveSettings as { isAuthorized?: boolean } | undefined;
        if (!driveSettings?.isAuthorized) {
            console.log('[Background] Drive not authorized, skipping auto-sync');
            return;
        }

        try {
            await setupOffscreenDocument();

            // Send sync request to offscreen document
            chrome.runtime.sendMessage({
                type: 'EXECUTE_DRIVE_SYNC',
                target: 'offscreen'
            });
        } catch (e) {
            console.error('[Background] Failed to trigger sync:', e);
        }
    }
});

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('[Background] Received message:', request.type);

    // OAuth flow
    if (request.type === 'AUTH_GOOGLE_DRIVE') {
        handleOAuthFlow(request.interactive ?? false)
            .then(sendResponse)
            .catch(e => sendResponse({ error: e.message }));
        return true; // Async response
    }

    // Get valid token
    if (request.type === 'GET_DRIVE_TOKEN') {
        getValidAccessToken()
            .then(token => sendResponse({ token }))
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }

    // Revoke tokens
    if (request.type === 'REVOKE_DRIVE_TOKEN') {
        revokeDriveTokens()
            .then(() => sendResponse({ success: true }))
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }

    // Get stored tokens (for checking connection status)
    if (request.type === 'GET_DRIVE_STATUS') {
        getStoredTokens()
            .then(tokens => sendResponse({
                isAuthenticated: !!tokens,
                email: tokens?.email
            }))
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }

    // Trigger manual sync
    if (request.type === 'TRIGGER_DRIVE_SYNC') {
        setupOffscreenDocument()
            .then(() => {
                chrome.runtime.sendMessage({
                    type: 'EXECUTE_DRIVE_SYNC',
                    target: 'offscreen'
                });
                sendResponse({ success: true });
            })
            .catch(e => sendResponse({ error: e.message }));
        return true;
    }

    return false;
});

console.log('[Background] Service worker initialized');
