import { MOCK_WEEK_SCHEDUELE, sleep } from "./calendarUtils";
import type { BlockLesson } from "../types/calendarTypes";
import { getUserId } from "./user_id_fetcher";

// You can control production/mock mode here or via an env variable
const PRODUCTION: boolean = true;

function getLastWeekData() {
    const today: Date = new Date();
    let start: string;
    let end: string;

    const currentDayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday

    // If it's Saturday (6) or Sunday (0), show next week's schedule
    const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;

    // 1. Calculate the target Monday
    // If it's weekend, we want NEXT Monday (days forward)
    // If it's weekday, we want THIS WEEK's Monday (days back)
    let targetMonday: Date;

    if (isWeekend) {
        // For weekend: calculate days until next Monday
        // Saturday (6) -> 2 days forward to Monday
        // Sunday (0) -> 1 day forward to Monday
        const daysUntilMonday = currentDayOfWeek === 6 ? 2 : 1;
        targetMonday = new Date(today);
        targetMonday.setDate(today.getDate() + daysUntilMonday);
    } else {
        // For weekday: calculate days back to this week's Monday
        // The expression (today.getDay() + 6) % 7 calculates days since Monday.
        // e.g., Mon (1) -> (1+6)%7 = 0; Tue (2) -> (2+6)%7 = 1
        const daysSinceMonday: number = (today.getDay() + 6) % 7;
        targetMonday = new Date(today);
        targetMonday.setDate(today.getDate() - daysSinceMonday);
    }

    // Set the time to the very start of the day (00:00:00)
    targetMonday.setHours(0, 0, 0, 0);
    // 2. Calculate the corresponding Friday
    // Friday is 4 days after Monday
    const correspondingFriday: Date = new Date(targetMonday);
    correspondingFriday.setDate(targetMonday.getDate() + 4);

    // Set the time to the very end of the day (23:59:59.999)
    correspondingFriday.setHours(23, 59, 59, 999);
    // 3. Format the dates
    start = getSchedueleFormat(targetMonday);
    end = getSchedueleFormat(correspondingFriday);
    return [start, end];
}

function getSchedueleFormat(date: Date) {
    const day_to_fetch: Date = date;
    const year = day_to_fetch.getFullYear();
    // getMonth() is 0-indexed, so we add 1
    const month = day_to_fetch.getMonth() + 1;
    const dayOfMonth = day_to_fetch.getDate();

    // Function to pad a single digit number with a leading zero
    const pad = (num: number): string => String(num).padStart(2, '0');

    // Format as MM.DD.YYYY
    const current_day: string = `${pad(dayOfMonth)}.${pad(month)}.${year}`;

    return current_day;
}

export async function fetchWeekScheduele(specific?: { start: Date, end: Date }): Promise<BlockLesson[] | null> {
    console.log("fetchWeekScheduele called. PRODUCTION:", PRODUCTION);
    if (PRODUCTION == false) {
        console.log("Returning MOCK_WEEK_SCHEDUELE");
        await sleep(2000);
        return MOCK_WEEK_SCHEDUELE;
    };
    const user_id = await getUserId();
    if (user_id == null) {
        console.error("[ERROR] Problem with getting the student id.");
        return null;
    }
    //
    let start: string = "";
    let end: string = "";
    if (specific != undefined) {
        start = getSchedueleFormat(specific.start);
        end = getSchedueleFormat(specific.end);
    } else {
        const week_results = getLastWeekData();
        start = week_results[0];
        end = week_results[1];
    }
    const url = `https://is.mendelu.cz/katalog/rozvrhy_view.pl?zobraz=1;vypis=1;id_obdobi=;id_predmet=;id_ucitel=;id_student=${user_id};id_katedra=;id_poslucharna=;od=${start};do=${end};rozvrh_typ=1;zpet=../katalog/rozvrhy_view.pl?zobraz=1,vypis=1,id_student=${user_id},rozvrh_typ=1`;
    console.log("Fetching URL:", url);

    try {
        const response = await fetch(url, {
            method: "GET",
            headers: {
                "Content-Type": "text/html; charset=windows-1250"
            },
            credentials: "include"
        });

        console.log("Fetch response status:", response.status);

        if (!response.ok) {
            console.error("Fetch failed with status:", response.status);
            return null;
        }

        const text = await response.text();
        console.log("Fetch response text length:", text.length);

        // Placeholder for parsing logic or just return null for now as we are debugging
        return null;

    } catch (error) {
        console.error(error);
        return null;
    }
}
