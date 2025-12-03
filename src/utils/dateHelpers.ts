export function parseDate(dateStr: string, timeStr: string): Date {
    // dateStr: "15.01." or "15.01.2025"
    // timeStr: "10:00"
    const currentYear = new Date().getFullYear();
    const parts = dateStr.split('.');
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1;
    const year = parts[2] ? parseInt(parts[2]) : currentYear;

    const [hours, minutes] = timeStr.split(':').map(Number);

    return new Date(year, month, day, hours, minutes);
}
