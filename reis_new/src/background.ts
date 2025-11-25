// Background script for handling Google Drive authentication and auto-sync

console.log('[Background] Service worker started');

// Set up auto-sync alarm (5 minutes)
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Background] Extension installed/updated - Setting up auto-sync alarm');
    chrome.alarms.create('auto-sync', { periodInMinutes: 5 });
    console.log('[Background] ✅ Auto-sync alarm created (fires every 5 minutes)');
    console.log('[Background] ⏰ First sync will occur in 5 minutes');
});

// Auto-sync alarm listener
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'auto-sync') {
        const timestamp = new Date().toLocaleTimeString('cs-CZ');
        console.log(`[Background] ⏰ Auto-sync alarm fired at ${timestamp}`);

        // Trigger sync via message to content script
        chrome.tabs.query({ url: 'https://is.mendelu.cz/auth/*' }, (tabs) => {
            if (tabs.length === 0) {
                console.log('[Background] ⚠️ No IS Mendelu tabs open - sync skipped');
                return;
            }

            console.log(`[Background] 📡 Sending AUTO_SYNC message to ${tabs.length} tab(s)`);
            tabs.forEach((tab, index) => {
                if (tab.id) {
                    console.log(`[Background] → Sending to tab ${index + 1}: ${tab.url}`);
                    chrome.tabs.sendMessage(tab.id, { type: 'AUTO_SYNC' });
                }
            });
        });
    }
});


chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    console.log('[Background] Received message:', request.type);
    if (request.type === 'AUTH_GOOGLE_DRIVE') {
        console.log('[Background] Starting auth flow (launchWebAuthFlow)...');

        try {
            const manifest = chrome.runtime.getManifest();
            const clientId = manifest.oauth2?.client_id;
            const scopes = manifest.oauth2?.scopes?.join(' ');
            const redirectUri = chrome.identity.getRedirectURL();

            if (!clientId || !scopes) {
                throw new Error("Missing OAuth configuration in manifest");
            }

            const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
            authUrl.searchParams.set('client_id', clientId);
            authUrl.searchParams.set('response_type', 'token');
            authUrl.searchParams.set('redirect_uri', redirectUri);
            authUrl.searchParams.set('scope', scopes);

            console.log('[Background] Auth URL:', authUrl.toString());

            chrome.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true
            }, (redirectUrl) => {
                if (chrome.runtime.lastError) {
                    console.error("[Background] Auth error:", chrome.runtime.lastError);
                    sendResponse({ error: chrome.runtime.lastError.message });
                    return;
                }

                if (redirectUrl) {
                    console.log("[Background] Auth successful, redirect URL received");
                    const url = new URL(redirectUrl);
                    const params = new URLSearchParams(url.hash.substring(1)); // Remove #
                    const token = params.get('access_token');

                    if (token) {
                        sendResponse({ token });
                    } else {
                        sendResponse({ error: "No access token found in redirect" });
                    }
                } else {
                    sendResponse({ error: "Auth failed, no redirect URL" });
                }
            });
        } catch (e: any) {
            console.error("[Background] Exception:", e);
            sendResponse({ error: e.message });
        }
        return true; // Will respond asynchronously
    }

    if (request.type === 'REVOKE_TOKEN') {
        console.log('[Background] Revoking token...');
        const token = request.token;
        if (token) {
            const url = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;
            fetch(url).then(() => {
                chrome.identity.removeCachedAuthToken({ token }, () => {
                    console.log('[Background] Token revoked');
                    sendResponse({ success: true });
                });
            });
            return true;
        }
    }
});
