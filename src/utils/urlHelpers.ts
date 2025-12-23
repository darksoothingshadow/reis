/**
 * URL parsing utilities.
 * Extracted from calendarUtils.ts.
 */

export function GetIdFromLink(link: string): string | null {
    const match = link.match(/id=(\d+)/);
    return match ? match[1] : null;
}

export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));
