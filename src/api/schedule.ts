import { fetchWithAuth, BASE_URL } from "./client";
import { getUserId } from "./user";
import { getLastWeekData, getScheduleFormat } from "../utils/date";
import { getUserParams } from "../utils/userParams";
import type { BlockLesson, ScheduleData } from "../types/schedule";

const SCHEDULE_URL = `${BASE_URL}/auth/katalog/rozvrhy_view.pl`;

export async function fetchWeekSchedule(specific?: { start: Date, end: Date }): Promise<BlockLesson[] | null> {
    const userId = await getUserId();
    if (!userId) {
        console.error("User ID not found");
        return null;
    }

    const userParams = await getUserParams();

    if (!userParams) {
        console.error("User params not found for schedule fetch");
        return null;
    }

    const studiumId = userParams.studium;
    const obdobiId = userParams.obdobi;

    let start: string;
    let end: string;

    if (specific) {
        start = getScheduleFormat(specific.start);
        end = getScheduleFormat(specific.end);
    } else {
        [start, end] = getLastWeekData();
    }

    const body = new URLSearchParams({
        rozvrh_student: userId,
        zpet: `../student/moje_studium.pl?_m=3110,studium=${studiumId},obdobi=${obdobiId}`,
        rezervace: "0",
        poznamky_base: "1",
        poznamky_parovani: "1",
        poznamky_jiny_areal: "1",
        poznamky_dl_omez: "1",
        typ_vypisu: "konani",
        konani_od: start,
        konani_do: end,
        format: "json",
        nezvol_all: "2",
        poznamky: "1",
        poznamky_zmeny: "1",
        poznamky_dalsi_ucit: "1",
        zobraz: "1",
        zobraz2: "Zobrazit"
    });

    try {
        const response = await fetchWithAuth(SCHEDULE_URL, {
            method: "POST",
            body: body,
        });

        const data: ScheduleData = await response.json();
        return data.blockLessons;
    } catch (error) {
        console.error("Failed to fetch schedule:", error);
        return null;
    }
}
