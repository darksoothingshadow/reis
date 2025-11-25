import { createRoot } from 'react-dom/client';
import css from './index.css?inline';
import App from './App';
import { SyncService } from './services/sync_service';

// ⚡ BLOCK IS Mendelu scripts from executing
const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node.nodeName === 'SCRIPT') {
                (node as HTMLScriptElement).type = 'javascript/blocked';
            }
        }
    }
});

observer.observe(document.documentElement, {
    childList: true,
    subtree: true
});

// ⚡ IMMEDIATELY hide the original page to prevent flash
document.documentElement.style.visibility = 'hidden';

// ✨ 1. Inject locally bundled DM Sans font
// function injectDmSansFont() {
//     const fontLink = document.createElement('link');
//     fontLink.rel = 'stylesheet';
//     // Load from local extension bundle instead of Google CDN
//     fontLink.href = chrome.runtime.getURL('fonts/dm-sans.css');

//     // Append the link to the document's head
//     document.head.appendChild(fontLink);
// }

async function firstLoad() {
    //LOGIN CHECK
    const contains = document.body.innerHTML.includes("/system/login.pl");
    if (contains) {
        console.log("[INFO] Login detected.");
        document.documentElement.style.visibility = 'visible'; // Show original login page
        return;
    }

    // 404 CHECK
    if (document.title.includes("Page not found") || document.body.textContent?.includes("Page not found")) {
        console.log("[INFO] 404 Page not found detected. Redirecting to dashboard.");
        window.location.href = "https://is.mendelu.cz/auth/";
        return;
    }

    //
    // Remove all existing content (safer than innerHTML = '')
    document.body.replaceChildren();
    document.head.replaceChildren();

    // Stop blocking scripts (we've cleared everything)
    observer.disconnect();

    // ✨ 2. Call the function to add the font link to the new, empty head.
    // injectDmSansFont(); // Disabled due to corrupt font files

    document.documentElement.style.fontFamily = '"DM Sans", sans-serif';

    // Create container for shadow root
    const host = document.createElement('div');
    host.id = 'custom-extension-root';
    document.body.appendChild(host);

    // Attach Shadow DOM
    const shadow = host.attachShadow({ mode: 'open' });

    // Inject CSS inside the shadow root
    const style = document.createElement('style');
    style.textContent = css;
    shadow.appendChild(style);

    // Create root element for React inside shadow DOM
    const app = document.createElement('div');
    app.id = 'app';
    shadow.appendChild(app);

    // Render React app into shadow DOM
    const reactRoot = createRoot(app);
    reactRoot.render(<App />);

    // ⚡ Show the page after React is rendered
    document.documentElement.style.visibility = 'visible';
}

// Run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', firstLoad);
} else {
    firstLoad();
}

// Listen for auto-sync messages from background script
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'AUTO_SYNC') {
        const timestamp = new Date().toLocaleTimeString('cs-CZ');
        console.log(`[Content] 🔄 Auto-sync message received at ${timestamp}`);

        // CRITICAL: Check if authorized first to prevent auth loop
        chrome.storage.local.get(['driveSettings'], (result: { driveSettings?: { isAuthorized: boolean } }) => {
            if (!result.driveSettings?.isAuthorized) {
                console.log('[Content] ⚠️ Not authorized - skipping auto-sync');
                return;
            }

            const syncService = SyncService.getInstance();
            console.log('[Content] → Starting syncAllSubjects()...');

            syncService.syncAllSubjects()
                .then(() => {
                    const endTime = new Date().toLocaleTimeString('cs-CZ');
                    console.log(`[Content] ✅ Auto-sync completed successfully at ${endTime}`);
                })
                .catch(err => {
                    console.error('[Content] ❌ Auto-sync failed:', err);
                    console.error('[Content] Error details:', err.message);
                });
        });
    }
});
