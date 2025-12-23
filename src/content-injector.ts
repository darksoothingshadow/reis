/**
 * Content Script Injector for REIS Chrome Extension
 * 
 * Clean version: STRICTLY for DOM injection and message relay.
 * Data logic moved to SyncManager.ts.
 */

import { Messages, isIframeMessage } from "./types/messages";
import type { ContentToIframeMessage, DataRequestType } from "./types/messages";
import { SyncManager } from "./services/SyncManager";
import { registerExam, unregisterExam, fetchExamData } from "./api/exams";
import { fetchSubjects } from "./api/subjects";

const SYNC_INTERVAL = 5 * 60 * 1000;
const IFRAME_ID = "reis-app-frame";

let iframeElement: HTMLIFrameElement | null = null;
let syncManager: SyncManager | null = null;

// =============================================================================
// DOM Injection Logic
// =============================================================================

if (document.documentElement) {
    document.documentElement.style.visibility = "hidden";
}

function injectAndInitialize() {
    if (document.getElementById(IFRAME_ID)) return;
    if (document.body?.innerHTML.includes("/system/login.pl")) {
        document.documentElement.style.visibility = "visible";
        return;
    }

    injectIframe();
    window.addEventListener("message", handleMessage);
    
    syncManager = new SyncManager((data) => {
        sendToIframe(Messages.syncUpdate(data));
    });
    syncManager.start(SYNC_INTERVAL);
}

function startInjection() {
    if (document.body) injectAndInitialize();
    else {
        const observer = new MutationObserver((_, obs) => {
            if (document.body) {
                obs.disconnect();
                injectAndInitialize();
            }
        });
        observer.observe(document.documentElement, { childList: true });
    }
}

startInjection();

function injectIframe() {
    document.body.replaceChildren();
    document.head.replaceChildren();

    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.href = chrome.runtime.getURL("mendelu_logo_128.png");
    document.head.appendChild(favicon);

    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = chrome.runtime.getURL("fonts/inter.css");
    document.head.appendChild(fontLink);

    iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("index.html");
    Object.assign(iframeElement.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        border: "none", margin: "0", padding: "0", overflow: "hidden", zIndex: "2147483647",
        backgroundColor: "#f8fafc",
    });

    iframeElement.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads");
    iframeElement.setAttribute("allow", "clipboard-write");
    document.body.appendChild(iframeElement);
    document.body.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.visibility = "visible";
}

// =============================================================================
// Message Handling
// =============================================================================

async function handleMessage(event: MessageEvent) {
    if (event.source !== iframeElement?.contentWindow) return;
    const data = event.data;
    if (!isIframeMessage(data)) return;

    switch (data.type) {
        case "REIS_READY":
            if (syncManager?.getCachedData().lastSync) {
                sendToIframe(Messages.syncUpdate(syncManager.getCachedData()));
            }
            break;
        case "REIS_REQUEST_DATA":
            await handleDataRequest(data.dataType);
            break;
        case "REIS_FETCH":
            await handleFetchRequest(data.id, data.url, data.options);
            break;
        case "REIS_ACTION":
            await handleAction(data.id, data.action, data.payload);
            break;
    }
}

async function handleDataRequest(dataType: DataRequestType) {
    try {
        if (dataType === "all") {
            if (!syncManager?.getCachedData().lastSync) await syncManager?.syncAllData();
            sendToIframe(Messages.data("all", syncManager?.getCachedData()));
        } else {
            let result: unknown = null;
            if (dataType === "exams") result = await fetchExamData();
            else if (dataType === "subjects") result = await fetchSubjects();
            else if (dataType === "files") result = syncManager?.getCachedData().files;
            sendToIframe(Messages.data(dataType, result));
        }
    } catch (e) {
        sendToIframe(Messages.data(dataType, null, String(e)));
    }
}

async function handleFetchRequest(id: string, url: string, options?: { method?: string; headers?: Record<string, string>; body?: string }) {
    try {
        const response = await fetch(url, { ...options, credentials: "include" });
        const text = await response.text();
        sendToIframe(Messages.fetchResult(id, true, text));
    } catch (e) {
        sendToIframe(Messages.fetchResult(id, false, undefined, String(e)));
    }
}

async function handleAction(id: string, action: string, payload: unknown) {
    try {
        let result: unknown = null;
        if (action === "register_exam") result = { success: await registerExam((payload as { termId: string }).termId) };
        else if (action === "unregister_exam") result = { success: await unregisterExam((payload as { termId: string }).termId) };
        sendToIframe(Messages.actionResult(id, true, result));
    } catch (e) {
        sendToIframe(Messages.actionResult(id, false, undefined, String(e)));
    }
}

function sendToIframe(message: ContentToIframeMessage) {
    iframeElement?.contentWindow?.postMessage(message, "*");
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        syncManager?.stop();
        window.removeEventListener("message", handleMessage);
    });
}
