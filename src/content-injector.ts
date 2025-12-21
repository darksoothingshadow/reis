/**
 * Content Script Injector for REIS Chrome Extension
 *
 * This script runs on is.mendelu.cz and:
 * 1. Injects an iframe containing the React app
 * 2. Handles postMessage communication with the iframe
 * 3. Proxies authenticated fetch requests for the iframe
 * 4. Runs the SyncService to push data updates to the iframe
 *
 * Architecture:
 * - Host Page (is.mendelu.cz) → Content Script → Iframe (chrome-extension://...)
 * - Content Script has access to cookies, iframe has isolated CSS
 */

import type {
    ContentToIframeMessage,
    DataRequestType,
    SyncedData,
} from "./types/messages";
import { Messages, isIframeMessage } from "./types/messages";
import { loggers } from "./utils/logger";

// =============================================================================
// Configuration
// =============================================================================

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const IFRAME_ID = "reis-app-frame";

// API imports for data fetching (these work because content script has cookie access)
import { fetchWeekSchedule } from "./api/schedule";
import { fetchExamData } from "./api/exams";
import { fetchSubjects } from "./api/subjects";
import { fetchFilesFromFolder } from "./api/documents";
import { fetchSubjectSuccessRates } from "./api/successRate";
import { registerExam, unregisterExam } from "./api/exams";
import type { SubjectsData } from "./types/documents";
import type { ParsedFile } from "./types/documents";

// =============================================================================
// State
// =============================================================================

let iframeElement: HTMLIFrameElement | null = null;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;
let cachedData: SyncedData = { lastSync: 0 };

// =============================================================================
// DOM Sniper Pattern - Earliest Possible Iframe Injection
// =============================================================================

loggers.system.info("[REIS Content] Script loaded (document_start)");

// Hide page immediately to prevent flash of university content
if (document.documentElement) {
    document.documentElement.style.visibility = "hidden";
}

// The main injection function
function injectAndInitialize() {
    // Avoid double injection
    if (document.getElementById(IFRAME_ID)) {
        loggers.system.info("[REIS Content] Iframe already exists, skipping");
        return;
    }

    // Check for login page
    if (document.body?.innerHTML.includes("/system/login.pl")) {
        loggers.system.info("[REIS Content] Login page detected, showing original page");
        document.documentElement.style.visibility = "visible";
        return;
    }

    loggers.system.info("[REIS Content] Injecting iframe...");

    // Inject the iframe
    injectIframe();

    // Set up message listener
    window.addEventListener("message", handleMessage);

    // Start sync service
    startSyncService();
}

// DOM Sniper Logic - Watch for <body> to appear
function startInjection() {
    if (document.body) {
        loggers.system.info("[REIS Content] Body exists, injecting immediately");
        injectAndInitialize();
    } else {
        loggers.system.info("[REIS Content] Waiting for body via MutationObserver...");
        const observer = new MutationObserver((_mutations, obs) => {
            if (document.body) {
                loggers.system.info("[REIS Content] Body appeared, injecting now");
                obs.disconnect();
                injectAndInitialize();
            }
        });

        observer.observe(document.documentElement, { childList: true });
    }
}

// Start the sniper immediately
startInjection();

// =============================================================================
// Iframe Injection
// =============================================================================

function injectIframe() {
    loggers.system.info("[REIS Content] Injecting iframe...");

    // Clear existing content
    document.body.replaceChildren();
    document.head.replaceChildren();

    // Inject favicon
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.href = chrome.runtime.getURL("mendelu_logo_128.png");
    document.head.appendChild(favicon);

    // Inject Inter font
    const fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href = chrome.runtime.getURL("fonts/inter.css");
    document.head.appendChild(fontLink);

    // Create iframe
    iframeElement = document.createElement("iframe");
    iframeElement.id = IFRAME_ID;
    iframeElement.src = chrome.runtime.getURL("index.html");

    // Fullscreen styling
    Object.assign(iframeElement.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        border: "none",
        margin: "0",
        padding: "0",
        overflow: "hidden",
        zIndex: "2147483647",
        backgroundColor: "#f8fafc",
    });

    iframeElement.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
    );
    iframeElement.setAttribute("allow", "clipboard-write");

    document.body.appendChild(iframeElement);

    document.body.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
    document.documentElement.style.cssText = "margin: 0; padding: 0; overflow: hidden;";

    document.documentElement.style.visibility = "visible";

    loggers.system.info("[REIS Content] Iframe injected successfully");
}

// =============================================================================
// Message Handling
// =============================================================================

async function handleMessage(event: MessageEvent) {
    if (event.source !== iframeElement?.contentWindow) {
        return;
    }

    const data = event.data;

    if (!isIframeMessage(data)) {
        return;
    }

    loggers.system.debug("[REIS Content] Received message:", data.type);

    switch (data.type) {
        case "REIS_READY":
            handleReady();
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

function handleReady() {
    loggers.system.info("[REIS Content] Iframe is ready");
    if (cachedData.lastSync > 0) {
        sendToIframe(Messages.syncUpdate(cachedData));
    }
}

async function handleDataRequest(dataType: DataRequestType) {
    loggers.system.info("[REIS Content] Data request:", dataType);

    try {
        if (dataType === "all") {
            if (cachedData.lastSync === 0) {
                await syncAllData();
            }
            sendToIframe(Messages.data("all", cachedData));
        } else {
            let data: unknown = null;
            switch (dataType) {
                case "schedule":
                    data = await fetchScheduleData();
                    break;
                case "exams":
                    data = await fetchExamData();
                    break;
                case "subjects":
                    data = await fetchSubjects();
                    break;
                case "files":
                    data = cachedData.files;
                    break;
            }
            sendToIframe(Messages.data(dataType, data));
        }
    } catch (error) {
        loggers.system.error("[REIS Content] Data request failed:", error);
        sendToIframe(Messages.data(dataType, null, String(error)));
    }
}

async function handleFetchRequest(
    id: string,
    url: string,
    options?: { method?: string; headers?: Record<string, string>; body?: string }
) {
    try {
        const response = await fetch(url, {
            method: options?.method ?? "GET",
            headers: options?.headers,
            body: options?.body,
            credentials: "include",
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const text = await response.text();
        sendToIframe(Messages.fetchResult(id, true, text));
    } catch (error) {
        loggers.system.error("[REIS Content] Fetch proxy error:", error);
        sendToIframe(Messages.fetchResult(id, false, undefined, String(error)));
    }
}

async function handleAction(id: string, action: string, payload: unknown) {
    try {
        let result: unknown = null;
        switch (action) {
            case "register_exam": {
                const termId = (payload as { termId: string }).termId;
                const success = await registerExam(termId);
                result = { success };
                break;
            }
            case "unregister_exam": {
                const termId = (payload as { termId: string }).termId;
                const success = await unregisterExam(termId);
                result = { success };
                break;
            }
            default:
                throw new Error(`Unknown action: ${action}`);
        }
        sendToIframe(Messages.actionResult(id, true, result));
    } catch (error) {
        loggers.system.error("[REIS Content] Action error:", error);
        sendToIframe(Messages.actionResult(id, false, undefined, String(error)));
    }
}

function sendToIframe(message: ContentToIframeMessage) {
    if (!iframeElement?.contentWindow) {
        return;
    }
    iframeElement.contentWindow.postMessage(message, "*");
}

// =============================================================================
// Sync Service
// =============================================================================

function startSyncService() {
    loggers.system.info("[REIS Content] Starting sync service...");
    syncAllData();
    syncIntervalId = setInterval(() => {
        syncAllData();
    }, SYNC_INTERVAL);
}

async function syncAllData() {
    loggers.system.info("[REIS Content] Syncing all data...");
    const startTime = Date.now();

    try {
        const [schedule, exams, subjects] = await Promise.allSettled([
            fetchScheduleData(),
            fetchExamData(),
            fetchSubjects(),
        ]);

        cachedData = {
            schedule: schedule.status === "fulfilled" ? schedule.value : null,
            exams: exams.status === "fulfilled" ? exams.value : null,
            subjects: subjects.status === "fulfilled" ? subjects.value : null,
            files: {},
            lastSync: Date.now(),
        };

        sendToIframe(Messages.syncUpdate(cachedData));

        if (subjects.status === "fulfilled" && subjects.value) {
            const subjectsData = subjects.value as SubjectsData;
            const files: Record<string, ParsedFile[]> = {};
            const subjectEntries = Object.entries(subjectsData.data);

            for (const [courseCode, subject] of subjectEntries) {
                if (subject.folderUrl) {
                    try {
                        const subjectFiles = await fetchFilesFromFolder(subject.folderUrl);
                        files[courseCode] = subjectFiles;
                    } catch (e) {
                        loggers.system.warn(`[REIS Content] Failed to fetch files for ${courseCode}:`, e);
                    }
                }
            }

            cachedData.files = files;
            cachedData.lastSync = Date.now();
            sendToIframe(Messages.syncUpdate(cachedData));

            const totalDuration = Date.now() - startTime;
            loggers.system.info(
                `[REIS Content] Pre-stats sync complete in ${totalDuration}ms`
            );

            // --- Success Rate Sync (Throttled 30 days) ---
            const syncSuccessRates = async () => {
                try {
                    const STATS_LAST_SYNC_KEY = 'reis_last_stats_sync';
                    const lastStatsSyncStr = localStorage.getItem(STATS_LAST_SYNC_KEY);
                    const lastStatsSync = parseInt(lastStatsSyncStr || '0', 10);
                    const now = Date.now();
                    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
                    
                    if (now - lastStatsSync > THIRTY_DAYS) {
                        loggers.system.info('[REIS Content] Syncing success rates (throttled check passed)...');
                        const codes = Object.keys(subjectsData.data);
                        
                        if (codes.length > 0) {
                            const stats = await fetchSubjectSuccessRates(codes);
                            cachedData.successRates = stats;
                            cachedData.successRatesFetched = true;
                            localStorage.setItem(STATS_LAST_SYNC_KEY, now.toString());
                            localStorage.setItem('reis_success_rates', JSON.stringify(stats));
                            localStorage.setItem('reis_success_rates_fetched', 'true');
                            
                            sendToIframe(Messages.syncUpdate(cachedData));
                            loggers.system.info(`[REIS Content] Success rates synced for ${codes.length} subjects`);
                        }
                    } else {
                        loggers.system.info('[REIS Content] Success rate sync throttled. Loading from cache...');
                        const storedStats = localStorage.getItem('reis_success_rates');
                        const storedFetched = localStorage.getItem('reis_success_rates_fetched');
                        
                        if (storedStats) {
                            cachedData.successRates = JSON.parse(storedStats);
                            cachedData.successRatesFetched = storedFetched === 'true';
                            sendToIframe(Messages.syncUpdate(cachedData));
                            loggers.system.info('[REIS Content] Loaded success rates from local cache');
                        }
                    }
                } catch (statsError) {
                    loggers.system.warn('[REIS Content] Success rate sync failed:', statsError);
                }
            };

            // Start success rate sync in parallel
            syncSuccessRates();

            loggers.system.info(
                `[REIS Content] Full sync including success rates triggered in ${Date.now() - startTime}ms`
            );
        }
    } catch (error) {
        loggers.system.error("[REIS Content] Sync failed:", error);
        cachedData.error = String(error);
    }
}

async function fetchScheduleData() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    let start: Date;
    let end: Date;

    if (currentMonth >= 8) {
        start = new Date(currentYear, 8, 1);
        end = new Date(currentYear + 1, 1, 28);
    } else if (currentMonth <= 1) {
        start = new Date(currentYear - 1, 8, 1);
        end = new Date(currentYear, 1, 28);
    } else {
        start = new Date(currentYear, 1, 1);
        end = new Date(currentYear, 7, 31);
    }

    return fetchWeekSchedule({ start, end });
}

if (import.meta.hot) {
    import.meta.hot.dispose(() => {
        if (syncIntervalId) {
            clearInterval(syncIntervalId);
        }
        window.removeEventListener("message", handleMessage);
    });
}
