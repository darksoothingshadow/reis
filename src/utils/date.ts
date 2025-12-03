export function formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

export function getScheduleFormat(date: Date): string {
    return formatDate(date);
}

export function getLastWeekData(): [string, string] {
    const today = new Date();
    let targetMonday: Date;

    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

    if (isWeekend) {
        const daysUntilMonday = currentDayOfWeek === 6 ? 2 : 1;
        targetMonday = new Date(today);
        targetMonday.setDate(today.getDate() + daysUntilMonday);
    } else {
        const daysSinceMonday = (today.getDay() + 6) % 7;
        targetMonday = new Date(today);
        targetMonday.setDate(today.getDate() - daysSinceMonday);
    }

    targetMonday.setHours(0, 0, 0, 0);

    const correspondingFriday = new Date(targetMonday);
    correspondingFriday.setDate(targetMonday.getDate() + 4);
    correspondingFriday.setHours(23, 59, 59, 999);

    return [getScheduleFormat(targetMonday), getScheduleFormat(correspondingFriday)];
}
export function getWeekRange(date: Date): { start: Date, end: Date } {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    return { start, end };
}
