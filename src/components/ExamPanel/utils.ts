/**
 * ExamPanel Shared Utilities
 */

/**
 * Get day of week abbreviation from date string.
 */
export function getDayOfWeek(dateString: string): string {
    const [day, month, year] = dateString.split('.').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'];
    return days[date.getDay()];
}

/**
 * Parse capacity string (e.g., "18/20") to percentage.
 */
export function capacityToPercent(capacity?: string): number {
    if (!capacity) return 0;
    const [occupied, total] = capacity.split('/').map(Number);
    if (isNaN(occupied) || isNaN(total) || total === 0) return 0;
    return Math.min(100, (occupied / total) * 100);
}

/**
 * Format timestamp to relative time string.
 */
export function formatRelativeTime(timestamp: number | null): string {
    if (!timestamp) return 'Neznámý čas';

    const now = Date.now();
    const diffMs = now - timestamp;
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);

    if (diffMinutes < 1) return 'Právě teď';
    if (diffMinutes < 60) return `Před ${diffMinutes} min`;
    if (diffHours < 24) return `Před ${diffHours} h`;

    const date = new Date(timestamp);
    return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
}
