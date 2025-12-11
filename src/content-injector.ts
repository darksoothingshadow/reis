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

// =============================================================================
// Configuration
// =============================================================================

const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes
const IFRAME_ID = "reis-app-frame";

// API imports for data fetching (these work because content script has cookie access)
// Note: We import the API functions directly here since we're in the same origin context
import { fetchWeekSchedule } from "./api/schedule";
import { fetchExamData } from "./api/exams";
import { fetchSubjects } from "./api/subjects";
import { fetchFilesFromFolder } from "./api/documents";
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
// This runs at document_start, often before <body> exists.
// We use MutationObserver to inject the iframe the microsecond <body> appears.

console.log("[REIS Content] Script loaded (document_start)");

// Hide page immediately to prevent flash of university content
if (document.documentElement) {
  document.documentElement.style.visibility = "hidden";
}

// The main injection function
function injectAndInitialize() {
  // Avoid double injection
  if (document.getElementById(IFRAME_ID)) {
    console.log("[REIS Content] Iframe already exists, skipping");
    return;
  }

  // Check for login page (need to wait for body content)
  // We defer login check to after body exists
  if (document.body?.innerHTML.includes("/system/login.pl")) {
    console.log("[REIS Content] Login page detected, showing original page");
    document.documentElement.style.visibility = "visible";
    return;
  }

  console.log("[REIS Content] Injecting iframe...");

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
    // Body already exists (rare with document_start, but possible)
    console.log("[REIS Content] Body exists, injecting immediately");
    injectAndInitialize();
  } else {
    // Watch for <body> to be created
    console.log("[REIS Content] Waiting for body via MutationObserver...");
    const observer = new MutationObserver((_mutations, obs) => {
      if (document.body) {
        console.log("[REIS Content] Body appeared, injecting now");
        obs.disconnect();
        injectAndInitialize();
      }
    });

    // Observe the <html> element for new children
    observer.observe(document.documentElement, { childList: true });
  }
}

// Start the sniper immediately
startInjection();

// =============================================================================
// Iframe Injection
// =============================================================================

function injectIframe() {
  console.log("[REIS Content] Injecting iframe...");

  // Clear existing content
  document.body.replaceChildren();
  document.head.replaceChildren();

  // Inject favicon
  const favicon = document.createElement("link");
  favicon.rel = "icon";
  favicon.type = "image/png";
  favicon.href = chrome.runtime.getURL("mendelu_logo_128.png");
  document.head.appendChild(favicon);

  // Inject Inter font for the iframe content
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
    backgroundColor: "#f8fafc", // slate-50 as loading background
  });

  // Security sandbox - allow scripts, same-origin for postMessage, and popups for links
  iframeElement.setAttribute(
    "sandbox",
    "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-downloads"
  );

  // Allow all features the app might need
  iframeElement.setAttribute("allow", "clipboard-write");

  document.body.appendChild(iframeElement);

  // Style body to remove any margins
  document.body.style.cssText = "margin: 0; padding: 0; overflow: hidden;";
  document.documentElement.style.cssText =
    "margin: 0; padding: 0; overflow: hidden;";

  // Show page
  document.documentElement.style.visibility = "visible";

  console.log("[REIS Content] Iframe injected successfully");
}

// =============================================================================
// Message Handling
// =============================================================================

async function handleMessage(event: MessageEvent) {
  // Only accept messages from our iframe
  if (event.source !== iframeElement?.contentWindow) {
    return;
  }

  const data = event.data;

  // Validate message format
  if (!isIframeMessage(data)) {
    return;
  }

  console.debug("[REIS Content] Received message:", data.type);

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
  console.log("[REIS Content] Iframe is ready");

  // If we have cached data, push it immediately
  if (cachedData.lastSync > 0) {
    sendToIframe(Messages.syncUpdate(cachedData));
  }
}

async function handleDataRequest(dataType: DataRequestType) {
  console.log("[REIS Content] Data request:", dataType);

  try {
    if (dataType === "all") {
      // Return all cached data, or fetch if needed
      if (cachedData.lastSync === 0) {
        await syncAllData();
      }
      sendToIframe(Messages.data("all", cachedData));
    } else {
      // Fetch specific data type
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
          // Files are fetched per-subject, return cached
          data = cachedData.files;
          break;
      }

      sendToIframe(Messages.data(dataType, data));
    }
  } catch (error) {
    console.error("[REIS Content] Data request failed:", error);
    sendToIframe(Messages.data(dataType, null, String(error)));
  }
}

async function handleFetchRequest(
  id: string,
  url: string,
  options?: { method?: string; headers?: Record<string, string>; body?: string }
) {
  console.debug("[REIS Content] Fetch proxy:", id, url);

  try {
    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers: options?.headers,
      body: options?.body,
      credentials: "include", // Include cookies!
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const text = await response.text();
    sendToIframe(Messages.fetchResult(id, true, text));
  } catch (error) {
    console.error("[REIS Content] Fetch proxy error:", error);
    sendToIframe(Messages.fetchResult(id, false, undefined, String(error)));
  }
}

async function handleAction(id: string, action: string, payload: unknown) {
  console.log("[REIS Content] Action:", action, payload);

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

      case "toggle_outlook_sync": {
        // TODO: Implement Outlook sync toggle
        result = { success: true };
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    sendToIframe(Messages.actionResult(id, true, result));
  } catch (error) {
    console.error("[REIS Content] Action error:", error);
    sendToIframe(Messages.actionResult(id, false, undefined, String(error)));
  }
}

// =============================================================================
// Iframe Communication
// =============================================================================

function sendToIframe(message: ContentToIframeMessage) {
  if (!iframeElement?.contentWindow) {
    console.warn("[REIS Content] Cannot send message, iframe not ready");
    return;
  }

  iframeElement.contentWindow.postMessage(message, "*");
}

// =============================================================================
// Sync Service
// =============================================================================

function startSyncService() {
  console.log("[REIS Content] Starting sync service...");

  // Initial sync
  syncAllData();

  // Periodic sync
  syncIntervalId = setInterval(() => {
    syncAllData();
  }, SYNC_INTERVAL);
}

async function syncAllData() {
  console.log("[REIS Content] Syncing all data...");
  const startTime = Date.now();

  try {
    // Fetch schedule, exams, subjects in parallel
    const [schedule, exams, subjects] = await Promise.allSettled([
      fetchScheduleData(),
      fetchExamData(),
      fetchSubjects(),
    ]);

    // Build initial cached data object
    cachedData = {
      schedule: schedule.status === "fulfilled" ? schedule.value : null,
      exams: exams.status === "fulfilled" ? exams.value : null,
      subjects: subjects.status === "fulfilled" ? subjects.value : null,
      files: {},
      lastSync: Date.now(),
    };

    // Log any errors
    if (schedule.status === "rejected") {
      console.error("[REIS Content] Schedule sync failed:", schedule.reason);
    }
    if (exams.status === "rejected") {
      console.error("[REIS Content] Exams sync failed:", exams.reason);
    }
    if (subjects.status === "rejected") {
      console.error("[REIS Content] Subjects sync failed:", subjects.reason);
    }

    // Push initial data to iframe (without files, so UI can render)
    sendToIframe(Messages.syncUpdate(cachedData));

    const initialDuration = Date.now() - startTime;
    console.log(
      `[REIS Content] Initial sync complete in ${initialDuration}ms, now syncing files...`
    );

    // Now sync files for all subjects (runs after initial sync so UI is responsive)
    if (subjects.status === "fulfilled" && subjects.value) {
      const subjectsData = subjects.value as SubjectsData;
      const files: Record<string, ParsedFile[]> = {};
      const subjectEntries = Object.entries(subjectsData.data);

      console.log(
        `[REIS Content] Syncing files for ${subjectEntries.length} subjects...`
      );

      // Fetch files for each subject sequentially to avoid overwhelming server
      for (const [courseCode, subject] of subjectEntries) {
        if (subject.folderUrl) {
          try {
            const subjectFiles = await fetchFilesFromFolder(subject.folderUrl);
            files[courseCode] = subjectFiles;
            console.log(
              `[REIS Content] Files for ${courseCode}: ${subjectFiles.length} items`
            );
          } catch (e) {
            console.warn(
              `[REIS Content] Failed to fetch files for ${courseCode}:`,
              e
            );
          }
        }
      }

      // Update cached data with files
      cachedData.files = files;
      cachedData.lastSync = Date.now();

      // Push updated data with files to iframe
      sendToIframe(Messages.syncUpdate(cachedData));

      const totalDuration = Date.now() - startTime;
      console.log(
        `[REIS Content] Full sync with files complete in ${totalDuration}ms`
      );
    }
  } catch (error) {
    console.error("[REIS Content] Sync failed:", error);
    cachedData.error = String(error);
  }
}

async function fetchScheduleData() {
  // Determine semester boundaries (same logic as syncSchedule.ts)
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

// =============================================================================
// Background Service Worker Communication
// =============================================================================
// Handle requests from the background service worker (for Drive sync)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_SYNC_DATA") {
    console.log("[REIS Content] Background requested sync data");

    // Return cached subjects and files for Drive sync
    const subjects = cachedData.subjects;
    const files = cachedData.files;

    const subjectCount = subjects
      ? Object.keys((subjects as any).data || {}).length
      : 0;
    const fileCount = files ? Object.keys(files).length : 0;

    console.log(
      `[REIS Content] Returning ${subjectCount} subjects, ${fileCount} file groups`
    );

    sendResponse({
      subjects: (subjects as any)?.data || null,
      files: files || null,
    });
    return true; // Async response
  }

  if (message.type === "DOWNLOAD_FILE") {
    const url = message.url;
    console.log(`[REIS Content] Downloading file via Content Script: ${url}`);

    fetch(url)
      .then((r) => r.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          sendResponse({ success: true, dataUrl: reader.result });
        };
        reader.onerror = () => {
          sendResponse({ success: false, error: "Failed to read blob" });
        };
        reader.readAsDataURL(blob);
      })
      .catch((e) => {
        console.error("[REIS Content] Download failed:", e);
        sendResponse({ success: false, error: e.message });
      });

    return true; // Async response
  }

  return false;
});

// =============================================================================
// Cleanup (for HMR during development)
// =============================================================================

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (syncIntervalId) {
      clearInterval(syncIntervalId);
    }
    window.removeEventListener("message", handleMessage);
  });
}
