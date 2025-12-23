/**
 * Proxy Client for Iframe → Content Script Communication
 * 
 * This module provides fetch-like APIs that work inside the iframe by
 * proxying requests through the Content Script (which has cookie access).
 * 
 * Usage:
 *   import { fetchViaProxy } from './proxyClient';
 *   const html = await fetchViaProxy('https://is.mendelu.cz/auth/...');
 */

import type { FetchResultMessage, ActionResultMessage, ActionType } from '../types/messages';
import { Messages } from '../types/messages';
import { loggers } from '../utils/logger';

// =============================================================================
// Pending Request Tracking
// =============================================================================

interface PendingRequest<T = unknown> {
    resolve: (value: T) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
}

const pendingFetches = new Map<string, PendingRequest<string>>();
const pendingActions = new Map<string, PendingRequest<unknown>>();

const REQUEST_TIMEOUT = 30000; // 30 seconds

// =============================================================================
// Message Listener (set up once)
// =============================================================================

let listenerInitialized = false;

function initMessageListener() {
    if (listenerInitialized) return;
    listenerInitialized = true;

    window.addEventListener('message', (event: MessageEvent<unknown>) => {
        // Only process messages from parent (Content Script)
        if (event.source !== window.parent) return;

        const data = event.data as Record<string, unknown>;
        if (!data || typeof data !== 'object') return;

        // Handle fetch results
        if (data.type === 'REIS_FETCH_RESULT') {
            const msg = data as unknown as FetchResultMessage;
            const pending = pendingFetches.get(msg.id);

            if (pending) {
                clearTimeout(pending.timeout);
                pendingFetches.delete(msg.id);

                if (msg.success && msg.data !== undefined) {
                    pending.resolve(msg.data);
                } else {
                    loggers.api.error('[ProxyClient] Fetch failed:', msg.error);
                    pending.reject(new Error(msg.error || 'Fetch failed'));
                }
            }
        }

        // Handle action results
        if (data.type === 'REIS_ACTION_RESULT') {
            const msg = data as unknown as ActionResultMessage;
            const pending = pendingActions.get(msg.id);

            if (pending) {
                clearTimeout(pending.timeout);
                pendingActions.delete(msg.id);

                if (msg.success) {
                    pending.resolve(msg.data);
                } else {
                    loggers.api.error('[ProxyClient] Action failed:', msg.error);
                    pending.reject(new Error(msg.error || 'Action failed'));
                }
            }
        }
    });

    loggers.api.info('[ProxyClient] Message listener initialized');
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Fetch a URL through the Content Script proxy.
 * Returns the response body as a string.
 */
export async function fetchViaProxy(
    url: string,
    options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }
): Promise<string> {
    initMessageListener();

    const message = Messages.fetch(url, options);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingFetches.delete(message.id);
            loggers.api.error('[ProxyClient] Request timeout:', url);
            reject(new Error(`Request timeout: ${url}`));
        }, REQUEST_TIMEOUT);

        pendingFetches.set(message.id, { resolve, reject, timeout });

        // Send to Content Script
        window.parent.postMessage(message, '*');

        loggers.api.debug('[ProxyClient] Fetch request sent:', message.id, url);
    });
}

/**
 * Fetch JSON through the Content Script proxy.
 */
export async function fetchJsonViaProxy<T>(
    url: string,
    options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    }
): Promise<T> {
    const text = await fetchViaProxy(url, options);
    try {
        return JSON.parse(text) as T;
    } catch (e) {
        loggers.api.error('[ProxyClient] JSON parse error:', e);
        throw new Error('Invalid JSON response');
    }
}

/**
 * Execute an action through the Content Script.
 */
export async function executeAction<T = unknown>(
    action: ActionType,
    payload: unknown
): Promise<T> {
    initMessageListener();

    const message = Messages.action(action, payload);

    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            pendingActions.delete(message.id);
            loggers.api.error('[ProxyClient] Action timeout:', action);
            reject(new Error(`Action timeout: ${action}`));
        }, REQUEST_TIMEOUT);

        pendingActions.set(message.id, {
            resolve: resolve as (value: unknown) => void,
            reject,
            timeout
        });

        // Send to Content Script
        window.parent.postMessage(message, '*');

        loggers.api.debug('[ProxyClient] Action request sent:', message.id, action);
    });
}

/**
 * Request initial data from Content Script.
 */
export function requestData(dataType: 'schedule' | 'exams' | 'subjects' | 'files' | 'all'): void {
    const message = Messages.requestData(dataType);
    window.parent.postMessage(message, '*');
    loggers.api.debug('[ProxyClient] Data request sent:', dataType);
}

/**
 * Signal to Content Script that iframe is ready.
 */
export function signalReady(): void {
    const message = Messages.ready();
    window.parent.postMessage(message, '*');
    loggers.api.info('[ProxyClient] Ready signal sent');
}

// =============================================================================
// Utility: Check if we're in an iframe
// =============================================================================

export function isInIframe(): boolean {
    try {
        return window.self !== window.parent;
    } catch {
        // Cross-origin error means we're in an iframe
        return true;
    }
}
