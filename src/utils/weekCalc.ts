/**
 * Week calculation utilities.
 * Extracted from calendarUtils.ts.
 */

/**
 * Smart Week Detection
 * Returns the most relevant week to display:
 * - On weekends (Sat/Sun): show NEXT week (upcoming Monday-Friday)
 * - On weekdays: show CURRENT week (this Monday-Friday)
 */
export function getSmartWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const now = new Date(referenceDate);
    const dayOfWeek = now.getDay();

    let startOfWeek: Date;

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 2;
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + daysUntilMonday);
        startOfWeek.setHours(0, 0, 0, 0);
    } else {
        const daysToSubtract = dayOfWeek - 1;
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToSubtract);
        startOfWeek.setHours(0, 0, 0, 0);
    }

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
}
