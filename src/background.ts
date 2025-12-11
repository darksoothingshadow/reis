/**
 * Background service worker for Chrome extension.
 *
 * Responsibilities:
 * - OAuth2 via chrome.identity.launchWebAuthFlow (implicit flow)
 * - Token storage and management via chrome.storage.local
 * - Auto-sync alarm (every 5 minutes)
 * - Offscreen document coordination for background sync
 * 
 * NOTE: Using implicit flow because the OAuth client is configured as "Web application".
 * For PKCE authorization code flow with refresh tokens, reconfigure the OAuth client
 * as "Desktop application" in Google Cloud Console (no client_secret required).
 */

import { DRIVE_CONSTANTS } from "./constants/drive";

console.log("[Background] Service worker started");

// ============================================================================
// Types
// ============================================================================

interface DriveAuth {
  email?: string;
  isAuthorized?: boolean;
}

interface DriveToken {
  accessToken: string;
  expiresAt: number; // Unix timestamp in ms
}

interface AuthResponse {
  token?: string;
  error?: string;
}

// ============================================================================
// OAuth2 via launchWebAuthFlow (Implicit Flow)
// ============================================================================

/**
 * Get the redirect URL for this extension.
 * Format: https://<extension-id>.chromiumapp.org/
 */
const REDIRECT_URL = chrome.identity.getRedirectURL();
console.log("[Background] Redirect URL:", REDIRECT_URL);

/**
 * Handle OAuth using launchWebAuthFlow (implicit flow).
 * This works with "Web application" OAuth clients.
 * 
 * NOTE: Implicit flow does not provide refresh tokens.
 * Users will need to re-authenticate when tokens expire (after ~1 hour).
 * To enable refresh tokens, reconfigure OAuth client as "Desktop application".
 */
async function handleOAuthFlow(interactive: boolean): Promise<AuthResponse> {
  console.log(
    `[Background] handleOAuthFlow called (interactive: ${interactive})`
  );

  try {
    // Build the Google OAuth authorization URL (implicit flow)
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", DRIVE_CONSTANTS.CLIENT_ID);
    authUrl.searchParams.set("redirect_uri", REDIRECT_URL);
    authUrl.searchParams.set("response_type", "token"); // Implicit flow
    authUrl.searchParams.set("scope", DRIVE_CONSTANTS.SCOPES.join(" "));
    authUrl.searchParams.set("prompt", interactive ? "consent" : "none");

    console.log("[Background] Launching OAuth flow...");

    // Launch the OAuth flow
    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive,
    });

    if (!responseUrl) {
      throw new Error("No response from OAuth flow");
    }

    console.log("[Background] OAuth response received");

    // Extract token from URL fragment (format: #access_token=...&expires_in=...)
    const url = new URL(responseUrl);
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const token = hashParams.get("access_token");
    const expiresIn = hashParams.get("expires_in");

    if (!token) {
      const error = hashParams.get("error");
      throw new Error(error || "No token in response");
    }

    // Calculate expiration time (default 3600 seconds = 1 hour)
    const expiresAt = Date.now() + parseInt(expiresIn || "3600") * 1000;

    // Store token
    await chrome.storage.local.set({
      driveToken: { accessToken: token, expiresAt } as DriveToken,
    });

    console.log("[Background] Token obtained and stored (expires in:", expiresIn, "seconds)");

    // Fetch user email for display
    let email: string | undefined;
    try {
      const userInfo = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      if (userInfo.ok) {
        const info = await userInfo.json();
        email = info.email;
        console.log("[Background] User email:", email);
      }
    } catch {
      // Non-critical, continue without email
    }

    // Store auth status (driveAuth for internal use, driveSettings for UI hook)
    await chrome.storage.local.set({
      driveAuth: { email, isAuthorized: true } as DriveAuth,
      driveSettings: {
        isAuthorized: true,
        rootFolderId: null,
        rootFolderName: null,
        accountEmail: email,
      },
    });

    // Trigger immediate sync after initial auth
    console.log("[Background] 🚀 Triggering immediate sync after auth...");
    try {
      // Get sync data from content script
      const syncData = await getFileDataFromContentScript();
      if (!syncData) {
        console.log("[Background] No sync data available for immediate sync");
      } else {
        await setupOffscreenDocument();
        // Wait for offscreen script to load and register listeners
        await new Promise((resolve) => setTimeout(resolve, 500));
        console.log("[Background] Sending EXECUTE_DRIVE_SYNC to offscreen...");
        chrome.runtime.sendMessage({
          type: "EXECUTE_DRIVE_SYNC",
          target: "offscreen",
          payload: syncData,
        });
      }
    } catch (e) {
      console.error("[Background] Failed to trigger immediate sync:", e);
    }

    return { token };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[Background] OAuth flow error:", message);
    return { error: message };
  }
}

/**
 * Get a valid access token from storage.
 * Throws if not authenticated or token is expired.
 * 
 * NOTE: With implicit flow, there's no refresh token.
 * When token expires, user must re-authenticate.
 */
async function getValidAccessToken(): Promise<string> {
  const result = await chrome.storage.local.get(["driveToken"]);
  const tokenData = result.driveToken as DriveToken | undefined;

  if (!tokenData?.accessToken) {
    throw new Error("Not authenticated");
  }

  // Check if token is expired (with 5 min buffer)
  if (tokenData.expiresAt < Date.now() + DRIVE_CONSTANTS.TOKEN_REFRESH_BUFFER_MS) {
    // Token expired - clear auth state and throw
    console.log("[Background] Token expired, clearing auth state");
    await chrome.storage.local.set({
      driveAuth: { isAuthorized: false },
      driveSettings: { isAuthorized: false, rootFolderId: null, rootFolderName: null },
    });
    throw new Error("Token expired - please re-authenticate");
  }

  return tokenData.accessToken;
}

/**
 * Get stored auth info from chrome.storage.local
 */
async function getStoredAuth(): Promise<DriveAuth | null> {
  const result = await chrome.storage.local.get(["driveAuth"]);
  return (result.driveAuth as DriveAuth) || null;
}

/**
 * Revoke tokens and clear stored data.
 */
async function revokeDriveTokens(): Promise<void> {
  try {
    // Get current token to revoke
    const result = await chrome.storage.local.get(["driveToken"]);
    const tokenData = result.driveToken as DriveToken | undefined;

    if (tokenData?.accessToken) {
      // Revoke at Google
      await fetch(
        `https://oauth2.googleapis.com/revoke?token=${tokenData.accessToken}`,
        {
          method: "POST",
        }
      );
      console.log("[Background] Token revoked at Google");
    }
  } catch (e) {
    console.error("[Background] Failed to revoke token:", e);
  }

  // Clear stored auth data
  await chrome.storage.local.remove([
    "driveAuth",
    "driveSettings",
    "driveToken",
  ]);
  console.log("[Background] Drive auth and settings cleared");
}

// ============================================================================
// Offscreen Document Management
// ============================================================================

const OFFSCREEN_DOC_PATH = "offscreen.html";
let creatingOffscreen: Promise<void> | null = null;

/**
 * Ensure offscreen document exists for background operations.
 */
async function setupOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOC_PATH);

  // Check if already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT" as chrome.runtime.ContextType],
    documentUrls: [offscreenUrl],
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
      justification: "Sync files to Google Drive in background",
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }

  console.log("[Background] Offscreen document created");
}

// ============================================================================
// Content Script Communication
// ============================================================================

interface SyncData {
  subjects: Record<
    string,
    { code: string; fullName: string; folderUrl?: string }
  > | null;
  files: Record<string, unknown[]> | null;
}

/**
 * Request sync data from the content script.
 * Returns subjects and files data for Drive sync.
 */
async function getFileDataFromContentScript(): Promise<SyncData | null> {
  try {
    // Find active is.mendelu.cz tab
    const tabs = await chrome.tabs.query({ url: "https://is.mendelu.cz/*" });

    if (tabs.length === 0) {
      console.log("[Background] No IS Mendelu tab found for sync data");
      return null;
    }

    const tabId = tabs[0].id;
    if (!tabId) {
      console.log("[Background] Tab has no ID");
      return null;
    }

    console.log("[Background] Requesting sync data from content script...");

    // Request data from content script
    const response = await chrome.tabs.sendMessage(tabId, {
      type: "GET_SYNC_DATA",
    });

    if (response && (response.subjects || response.files)) {
      const subjectCount = response.subjects
        ? Object.keys(response.subjects).length
        : 0;
      const fileCount = response.files ? Object.keys(response.files).length : 0;
      console.log(
        `[Background] Got ${subjectCount} subjects, ${fileCount} file groups`
      );
      return response as SyncData;
    }

    console.log("[Background] No data returned from content script");
    return null;
  } catch (e) {
    console.error(
      "[Background] Failed to get sync data from content script:",
      e
    );
    return null;
  }
}

// ============================================================================
// Feature Flag for Google Drive Sync (set to false to make dormant)
// ============================================================================

const DRIVE_SYNC_ENABLED = false;

// ============================================================================
// Auto-Sync Alarm
// ============================================================================

// Set up auto-sync alarm on install (only if Drive sync is enabled)
chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] Extension installed/updated");
  if (DRIVE_SYNC_ENABLED) {
    chrome.alarms.create("drive-auto-sync", {
      periodInMinutes: DRIVE_CONSTANTS.SYNC_INTERVAL_MINUTES,
    });
    console.log(
      `[Background] Auto-sync alarm created (every ${DRIVE_CONSTANTS.SYNC_INTERVAL_MINUTES} minutes)`
    );
  } else {
    console.log("[Background] Drive sync is dormant, skipping alarm creation");
  }
});

// Handle auto-sync alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "drive-auto-sync") {
    console.log("[Background] Auto-sync alarm fired");

    // Check if Drive sync is enabled
    const auth = await getStoredAuth();
    if (!auth?.isAuthorized) {
      console.log("[Background] Drive not authorized, skipping auto-sync");
      return;
    }

    try {
      // Get sync data from content script
      const syncData = await getFileDataFromContentScript();
      if (!syncData) {
        console.log("[Background] No sync data available, skipping");
        return;
      }

      await setupOffscreenDocument();
      // Wait for offscreen script to load
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Send sync request with data payload
      chrome.runtime.sendMessage({
        type: "EXECUTE_DRIVE_SYNC",
        target: "offscreen",
        payload: syncData,
      });
    } catch (e) {
      console.error("[Background] Failed to trigger sync:", e);
    }
  }
});

// ============================================================================
// Message Handlers
// ============================================================================

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("[Background] Received message:", request.type);

  // OAuth flow
  if (request.type === "AUTH_GOOGLE_DRIVE") {
    handleOAuthFlow(request.interactive ?? false)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true; // Async response
  }

  // Get valid token
  if (request.type === "GET_DRIVE_TOKEN") {
    getValidAccessToken()
      .then((token) => sendResponse({ token }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Revoke tokens
  if (request.type === "REVOKE_DRIVE_TOKEN") {
    revokeDriveTokens()
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Get stored auth (for checking connection status)
  if (request.type === "GET_DRIVE_STATUS") {
    getStoredAuth()
      .then((auth) =>
        sendResponse({
          isAuthenticated: !!auth?.isAuthorized,
          email: auth?.email,
        })
      )
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Trigger manual sync
  if (request.type === "TRIGGER_DRIVE_SYNC") {
    setupOffscreenDocument()
      .then(() => {
        chrome.runtime.sendMessage({
          type: "EXECUTE_DRIVE_SYNC",
          target: "offscreen",
        });
        sendResponse({ success: true });
      })
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Proxy File Download (Offscreen -> Background -> Content Script)
  if (request.type === "PROXY_DOWNLOAD_FILE") {
    chrome.tabs.query({ url: "https://is.mendelu.cz/*" }).then((tabs) => {
      if (!tabs.length || !tabs[0].id) {
        sendResponse({ error: "No active IS Mendelu tab found" });
        return;
      }
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: "DOWNLOAD_FILE",
          url: request.url,
        })
        .then(sendResponse)
        .catch((e) => sendResponse({ error: e.message }));
    });
    return true;
  }

  // ========================================================================
  // Storage Proxy for Offscreen Document
  // (Offscreen documents don't have direct chrome.storage access)
  // ========================================================================

  // Generic storage get
  if (request.type === "GET_STORAGE") {
    chrome.storage.local
      .get(request.keys)
      .then(sendResponse)
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Generic storage set
  if (request.type === "SET_STORAGE") {
    chrome.storage.local
      .set(request.data)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Generic storage remove
  if (request.type === "REMOVE_STORAGE") {
    chrome.storage.local
      .remove(request.keys)
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  // Get Drive settings (used by offscreen sync)
  if (request.type === "GET_DRIVE_SETTINGS") {
    chrome.storage.local.get(["driveSettings"]).then((result) => {
      const settings = (result.driveSettings as {
        isAuthorized?: boolean;
        rootFolderId?: string | null;
        rootFolderName?: string | null;
        accountEmail?: string;
      }) || {
        isAuthorized: false,
        rootFolderId: null,
        rootFolderName: null,
      };
      sendResponse(settings);
    });
    return true;
  }

  // Save Drive settings (used by offscreen sync after folder creation)
  if (request.type === "SAVE_DRIVE_SETTINGS") {
    chrome.storage.local
      .set({ driveSettings: request.settings })
      .then(() => sendResponse({ success: true }))
      .catch((e) => sendResponse({ error: e.message }));
    return true;
  }

  return false;
});

console.log("[Background] Service worker initialized");
