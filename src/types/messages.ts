/**
 * Message Protocol Types for Content Script ↔ Iframe Communication
 * 
 * This module defines the structured message types used for postMessage
 * communication between the Content Script (runs on is.mendelu.cz) and
 * the Iframe (runs the React app in isolated chrome-extension:// origin).
 */

// =============================================================================
// Data Types
// =============================================================================

/** Types of data that can be requested/synced */
export type DataRequestType = 'schedule' | 'exams' | 'subjects' | 'files' | 'all';

/** Actions that can be triggered from iframe */
export type ActionType =
    | 'register_exam'
    | 'unregister_exam'
    | 'toggle_outlook_sync'
    | 'download_file';

/** Synced data structure pushed from Content Script */
export interface SyncedData {
    schedule?: unknown;
    exams?: unknown;
    subjects?: unknown;
    files?: unknown;
    successRates?: unknown;
    successRatesFetched?: boolean;
    lastSync: number;
    error?: string;
}

// =============================================================================
// Iframe → Content Script Messages
// =============================================================================

/** Iframe signals it has loaded and is ready to receive data */
export interface ReadyMessage {
    type: 'REIS_READY';
}

/** Iframe requests specific data from Content Script */
export interface RequestDataMessage {
    type: 'REIS_REQUEST_DATA';
    dataType: DataRequestType;
}

/** Iframe requests a proxied fetch through Content Script (for cookie auth) */
export interface FetchRequestMessage {
    type: 'REIS_FETCH';
    id: string;
    url: string;
    options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string;
    };
}

/** Iframe triggers an action (exam registration, etc.) */
export interface ActionRequestMessage {
    type: 'REIS_ACTION';
    id: string;
    action: ActionType;
    payload: unknown;
}

/** Union of all messages from Iframe → Content Script */
export type IframeToContentMessage =
    | ReadyMessage
    | RequestDataMessage
    | FetchRequestMessage
    | ActionRequestMessage;

// =============================================================================
// Content Script → Iframe Messages
// =============================================================================

/** Content Script sends requested data to Iframe */
export interface DataResponseMessage {
    type: 'REIS_DATA';
    dataType: DataRequestType;
    data: unknown;
    error?: string;
}

/** Content Script sends result of proxied fetch */
export interface FetchResultMessage {
    type: 'REIS_FETCH_RESULT';
    id: string;
    success: boolean;
    data?: string;
    error?: string;
}

/** Content Script sends result of action */
export interface ActionResultMessage {
    type: 'REIS_ACTION_RESULT';
    id: string;
    success: boolean;
    data?: unknown;
    error?: string;
}

/** Content Script pushes sync update to Iframe */
export interface SyncUpdateMessage {
    type: 'REIS_SYNC_UPDATE';
    data: SyncedData;
}

/** Union of all messages from Content Script → Iframe */
export type ContentToIframeMessage =
    | DataResponseMessage
    | FetchResultMessage
    | ActionResultMessage
    | SyncUpdateMessage;

// =============================================================================
// Type Guards (for runtime type checking)
// =============================================================================

export function isIframeMessage(data: unknown): data is IframeToContentMessage {
    if (typeof data !== 'object' || data === null) return false;
    const msg = data as { type?: string };
    return ['REIS_READY', 'REIS_REQUEST_DATA', 'REIS_FETCH', 'REIS_ACTION'].includes(msg.type ?? '');
}

export function isContentMessage(data: unknown): data is ContentToIframeMessage {
    if (typeof data !== 'object' || data === null) return false;
    const msg = data as { type?: string };
    return ['REIS_DATA', 'REIS_FETCH_RESULT', 'REIS_ACTION_RESULT', 'REIS_SYNC_UPDATE'].includes(msg.type ?? '');
}

// =============================================================================
// Message Constructors (helpers to create typed messages)
// =============================================================================

export const Messages = {
    // Iframe → Content Script
    ready: (): ReadyMessage => ({ type: 'REIS_READY' }),

    requestData: (dataType: DataRequestType): RequestDataMessage => ({
        type: 'REIS_REQUEST_DATA',
        dataType
    }),

    fetch: (url: string, options?: FetchRequestMessage['options']): FetchRequestMessage => ({
        type: 'REIS_FETCH',
        id: crypto.randomUUID(),
        url,
        options
    }),

    action: (action: ActionType, payload: unknown): ActionRequestMessage => ({
        type: 'REIS_ACTION',
        id: crypto.randomUUID(),
        action,
        payload
    }),

    // Content Script → Iframe
    data: (dataType: DataRequestType, data: unknown, error?: string): DataResponseMessage => ({
        type: 'REIS_DATA',
        dataType,
        data,
        error
    }),

    fetchResult: (id: string, success: boolean, data?: string, error?: string): FetchResultMessage => ({
        type: 'REIS_FETCH_RESULT',
        id,
        success,
        data,
        error
    }),

    actionResult: (id: string, success: boolean, data?: unknown, error?: string): ActionResultMessage => ({
        type: 'REIS_ACTION_RESULT',
        id,
        success,
        data,
        error
    }),

    syncUpdate: (data: SyncedData): SyncUpdateMessage => ({
        type: 'REIS_SYNC_UPDATE',
        data
    })
};
