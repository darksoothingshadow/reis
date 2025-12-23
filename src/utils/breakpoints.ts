/**
 * Breakpoint utilities for responsive design.
 * Extracted from calendarUtils.ts.
 */

const BREAKPOINTS: Record<number, number> = {
    0: 640,
    1: 768,
    2: 1024,
    3: 1280,
    4: 1536,
};

export function getBreakpoint(width: number): number {
    if (width <= BREAKPOINTS[0]) {
        return 0;
    }
    if (width >= BREAKPOINTS[4]) {
        return 4;
    }
    for (const entry of Object.entries(BREAKPOINTS)) {
        if (width < entry[1]) {
            return parseInt(entry[0]);
        }
    }
    return 0;
}
