/**
 * Time-related utility functions for calendar calculations.
 * Extracted from calendarUtils.ts.
 */

export const SCHOOL_TIMES = [
    "07:00 - 08:50",
    "09:00 - 10:50",
    "11:00 - 12:50",
    "13:00 - 14:50",
    "15:00 - 16:50",
    "17:00 - 18:50",
];

export const TIME_LIST = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

export function timeToMinutes(time: string): number {
    const parts = time.split(":");
    if (parts.length == 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
        return 0;
    }
}

export function timeToMinutesDefault(time: string): number {
    const parts = time.split(".");
    if (parts.length == 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else {
        return 0;
    }
}

export function minutesToTimeDefault(time: number): string {
    const totalMinutes = time % 1440;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const formattedMinutes = String(minutes).padStart(2, '0');
    return `${hours}.${formattedMinutes}`;
}

export function getSubjectLength(start: string, end: string) {
    const [startTime, endTime] = [timeToMinutesDefault(start), timeToMinutesDefault(end)];
    const diff = endTime - startTime;
    const length = Math.ceil(diff / 60);
    return length;
}

export const DAY_NAMES: Record<number, string> = {
    0: "Ne",
    1: "Po",
    2: "Út",
    3: "St",
    4: "Čt",
    5: "Pá",
    6: "So",
};
