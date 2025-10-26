import { MOCK_DAY_SCHEDUELE, MOCK_WEEK_SCHEDUELE, sleep } from "./helper";
import type { BlockLesson, ScheduleData } from "./scheduele/scheduele";
import { getUserId } from "./user_id_fetcher";
import { PRODUCTION } from "./variables";
function getLastWeekData(){
    const today:Date = new Date();
    let start:string;
    let end:string;
    // 1. Calculate the last Monday (including today if it's Monday)
    // new Date().getDay() returns 0 for Sunday, 1 for Monday, ..., 6 for Saturday.
    // We want Monday (1) to result in 0 days back, Tuesday (2) in 1 day back, ..., 
    // Sunday (0) in 6 days back.
    // The expression (today.getDay() + 6) % 7 calculates days since Monday.
    // e.g., Mon (1) -> (1+6)%7 = 0; Tue (2) -> (2+6)%7 = 1; Sun (0) -> (0+6)%7 = 6
    const daysSinceMonday:number = (today.getDay() + 6) % 7;
    
    // Clone today's date and set it back to the Monday
    const lastMonday:Date = new Date(today);
    lastMonday.setDate(today.getDate() - daysSinceMonday);
    
    // Set the time to the very start of the day (00:00:00)
    lastMonday.setHours(0, 0, 0, 0);
    // 2. Calculate the corresponding Friday
    // Friday is 4 days after Monday
    const correspondingFriday:Date = new Date(lastMonday);
    correspondingFriday.setDate(lastMonday.getDate() + 4); 
    
    // Set the time to the very end of the day (23:59:59.999)
    correspondingFriday.setHours(23, 59, 59, 999);
    // 3. Format the dates
    start = getSchedueleFormat(lastMonday);
    end = getSchedueleFormat(correspondingFriday);
    return [start,end];
}
function getSchedueleFormat(date:Date){
    const day_to_fetch:Date = date;
    const year = day_to_fetch.getFullYear();
    // getMonth() is 0-indexed, so we add 1
    const month = day_to_fetch.getMonth() + 1;
    const dayOfMonth = day_to_fetch.getDate();

    // Function to pad a single digit number with a leading zero
    const pad = (num: number): string => String(num).padStart(2, '0');

    // Format as MM.DD.YYYY
    const current_day: string = `${pad(dayOfMonth)}.${pad(month)}.${year}`;

    // Example of how you might use current_day
    // console.log(`Fetching schedule for: ${current_day}`);
    
    // ... rest of your function logic
    return current_day;
}

export async function fetchDayScheduele(day?:Date):Promise<BlockLesson[]|null>{
    if(PRODUCTION == false){
        return MOCK_DAY_SCHEDUELE;
    };
    const user_id = await getUserId();
    if(user_id == null){
        console.error("[ERROR] Problem with getting the student id.");
        return null;
    }
    //
    console.log("[ID] Student id:",user_id);
    //
    const day_to_fetch:string = getSchedueleFormat(day??new Date());
    console.log("[TIMESTAMP] Day format:",day_to_fetch);
    //
    try {
        const f = await fetch("https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl", {
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "sec-ch-ua": "\"Microsoft Edge\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": "\"Android\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        },
        "referrer": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl",
        "body": `rozvrh_student=${user_id}&zpet=..%2Fstudent%2Fmoje_studium.pl%3F_m%3D3110%2Cstudium%3D141978%2Cobdobi%3D801&rezervace=0&poznamky_base=1&poznamky_parovani=1&poznamky_jiny_areal=1&poznamky_dl_omez=1&typ_vypisu=konani&konani_od=${day_to_fetch}&konani_do=${day_to_fetch}&format=json&nezvol_all=2&poznamky=1&poznamky_zmeny=1&poznamky_dalsi_ucit=1&zobraz=1&zobraz2=Zobrazit`,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
        });
        //
        const r:ScheduleData = await f.json();
        return r.blockLessons;
        //
    } catch (error) {
        console.error(error);
        return [];
    };
}
export async function fetchWeekScheduele(specific?:{start:Date,end:Date}):Promise<BlockLesson[]|null>{
    if(PRODUCTION == false){
        await sleep(2000);
        return MOCK_WEEK_SCHEDUELE;
    };
    const user_id = await getUserId();
    if(user_id == null){
        console.error("[ERROR] Problem with getting the student id.");
        return null;
    }
    //
    let start:string = "";
    let end:string = "";
    if(specific != undefined){
        start = getSchedueleFormat(specific.start);
        end = getSchedueleFormat(specific.end);
    }else{
        const week_results = getLastWeekData();
        start = week_results[0];
        end = week_results[1];
    }
    //
    try {
        const f = await fetch("https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl", {
        "headers": {
            "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "accept-language": "cs,en;q=0.9,en-GB;q=0.8,en-US;q=0.7",
            "cache-control": "max-age=0",
            "content-type": "application/x-www-form-urlencoded",
            "sec-ch-ua": "\"Microsoft Edge\";v=\"141\", \"Not?A_Brand\";v=\"8\", \"Chromium\";v=\"141\"",
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": "\"Android\"",
            "sec-fetch-dest": "document",
            "sec-fetch-mode": "navigate",
            "sec-fetch-site": "same-origin",
            "sec-fetch-user": "?1",
            "upgrade-insecure-requests": "1"
        },
        "referrer": "https://is.mendelu.cz/auth/katalog/rozvrhy_view.pl",
        "body": `rozvrh_student=${user_id}&zpet=..%2Fstudent%2Fmoje_studium.pl%3F_m%3D3110%2Cstudium%3D141978%2Cobdobi%3D801&rezervace=0&poznamky_base=1&poznamky_parovani=1&poznamky_jiny_areal=1&poznamky_dl_omez=1&typ_vypisu=konani&konani_od=${start}&konani_do=${end}&format=json&nezvol_all=2&poznamky=1&poznamky_zmeny=1&poznamky_dalsi_ucit=1&zobraz=1&zobraz2=Zobrazit`,
        "method": "POST",
        "mode": "cors",
        "credentials": "include"
        });
        const r:ScheduleData = await f.json();
        return r.blockLessons;
        //
    } catch (error) {
        console.error(error);
        return [];
    };
}