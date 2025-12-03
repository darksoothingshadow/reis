
export const SCHOOL_TIMES = [
    "07:00 - 08:50",
    "09:00 - 10:50",
    "11:00 - 12:50",
    "13:00 - 14:50",
    "15:00 - 16:50",
    "17:00 - 18:50",
]

export const TIME_LIST = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

const BRAKPOINTS = {
    0: 640,
    1: 768,
    2: 1024,
    3: 1280,
    4: 1536,
}

export function getBreakpoint(width: number): number {
    if (width <= BRAKPOINTS[0]) {
        return 0;
    }
    if (width >= BRAKPOINTS[4]) {
        return 4;
    }
    for (const entry of Object.entries(BRAKPOINTS)) {
        if (width < entry[1]) {
            return parseInt(entry[0]);
        }
    }
    return 0;
}

export function getSubjectLength(start: string, end: string) {
    const [startTime, endTime] = [timeToMinutesDefault(start), timeToMinutesDefault(end)];
    //
    const diff = endTime - startTime;
    //
    const lenght = Math.ceil(diff / 60);
    return lenght;
}

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
    // Ensure the time is within a 24-hour cycle (0 to 1439 minutes)
    const totalMinutes = time % 1440;

    // Calculate the hour (integer division)
    const hours = Math.floor(totalMinutes / 60);

    // Calculate the remaining minutes
    const minutes = totalMinutes % 60;

    // Format the minutes to always be two digits (e.g., 5 becomes "05")
    const formattedMinutes = String(minutes).padStart(2, '0');

    // Return the time in the format "hours.minutes"
    return `${hours}.${formattedMinutes}`;
}

export const DAY_NAMES = {
    0: "Ne",
    1: "Po",
    2: "Út",
    3: "St",
    4: "Čt",
    5: "Pá",
    6: "So",
}

export function GetIdFromLink(link: string): string | null {
    const pathString = link;

    // Regex: Look for 'id=' followed by one or more digits (\d+).
    // The value inside the parenthesis is the capture group.
    const match = pathString.match(/id=(\d+)/);

    // Extract the captured group (index 1) if a match was found
    const id = match ? match[1] : null;
    return id;
}

export const sleep = (delay: number) => new Promise((resolve) => setTimeout(resolve, delay));

export const MOCK_WEEK_SCHEDUELE = [
    {
        "date": "20251020",
        "isConsultation": "false",
        "room": "Q01",
        "roomStructured": {
            "name": "Q01",
            "id": "430"
        },
        "studyId": "141978",
        "endTime": "16:50",
        "facultyCode": "PEF",
        "id": "1871742",
        "startTime": "15:00",
        "isDefaultCampus": "true",
        "courseId": "157994",
        "courseName": "Podniková ekonomika 1",
        "campus": "Brno - Černá Pole",
        "isSeminar": "false",
        "teachers": [
            {
                "fullName": "Ing. Alena Melicharová, Ph.D.",
                "id": "1391",
                "shortName": "A. Melicharová"
            }
        ],
        "courseCode": "EBC-PE",
        "periodId": "801"
    },
    {
        "date": "20251021",
        "isConsultation": "false",
        "room": "Q01.48",
        "roomStructured": {
            "name": "Q01.48",
            "id": "492"
        },
        "studyId": "141978",
        "endTime": "08:50",
        "facultyCode": "PEF",
        "id": "1874128",
        "startTime": "07:00",
        "isDefaultCampus": "true",
        "courseId": "159415",
        "courseName": "Počítačové sítě",
        "campus": "Brno - Černá Pole",
        "isSeminar": "true",
        "teachers": [
            {
                "fullName": "Ing. Miroslav Jaroš",
                "id": "32865",
                "shortName": "M. Jaroš"
            }
        ],
        "courseCode": "EBC-PS",
        "periodId": "801"
    },
    {
        "date": "20251021",
        "isConsultation": "false",
        "room": "Q15",
        "roomStructured": {
            "name": "Q15",
            "id": "450"
        },
        "studyId": "141978",
        "endTime": "12:50",
        "facultyCode": "PEF",
        "id": "1879706",
        "startTime": "11:00",
        "isDefaultCampus": "true",
        "courseId": "158160",
        "courseName": "Odborná terminologie v AJ: IS/ICT",
        "campus": "Brno - Černá Pole",
        "isSeminar": "true",
        "teachers": [
            {
                "fullName": "doc. Ing. František Dařena, Ph.D.",
                "id": "1447",
                "shortName": "F. Dařena"
            },
            {
                "fullName": "Ing. Ludmila Kunderová",
                "id": "1722",
                "shortName": "L. Kunderová"
            }
        ],
        "courseCode": "EBA-OTII",
        "periodId": "801"
    },
    {
        "date": "20251022",
        "isConsultation": "false",
        "room": "Q16",
        "roomStructured": {
            "name": "Q16",
            "id": "451"
        },
        "studyId": "141978",
        "endTime": "16:50",
        "facultyCode": "PEF",
        "id": "1879841",
        "startTime": "15:00",
        "isDefaultCampus": "true",
        "courseId": "159861",
        "courseName": "Programovací jazyk Java",
        "campus": "Brno - Černá Pole",
        "isSeminar": "false",
        "teachers": [
            {
                "fullName": "Ing. Petr Jedlička, Ph.D.",
                "id": "1732",
                "shortName": "P. Jedlička"
            }
        ],
        "courseCode": "EBC-PJ",
        "periodId": "801"
    },
    {
        "date": "20251022",
        "isConsultation": "false",
        "room": "Q07",
        "roomStructured": {
            "name": "Q07",
            "id": "436"
        },
        "studyId": "141978",
        "endTime": "12:50",
        "facultyCode": "PEF",
        "id": "1879862",
        "startTime": "11:00",
        "isDefaultCampus": "true",
        "courseId": "159861",
        "courseName": "Programovací jazyk Java",
        "campus": "Brno - Černá Pole",
        "isSeminar": "true",
        "teachers": [
            {
                "fullName": "Ing. Petr Jedlička, Ph.D.",
                "id": "1732",
                "shortName": "P. Jedlička"
            }
        ],
        "courseCode": "EBC-PJ",
        "periodId": "801"
    },
    {
        "date": "20251022",
        "isConsultation": "false",
        "room": "Q02",
        "roomStructured": {
            "name": "Q02",
            "id": "431"
        },
        "studyId": "141978",
        "endTime": "16:50",
        "facultyCode": "PEF",
        "id": "1874910",
        "startTime": "15:00",
        "isDefaultCampus": "true",
        "courseId": "159413",
        "courseName": "Úvod do ICT",
        "campus": "Brno - Černá Pole",
        "isSeminar": "false",
        "teachers": [
            {
                "fullName": "Ing. Pavel Haluza, Ph.D.",
                "id": "4788",
                "shortName": "P. Haluza"
            }
        ],
        "courseCode": "EBC-UICT",
        "periodId": "801"
    },
    {
        "date": "20251023",
        "isConsultation": "false",
        "room": "Q46",
        "roomStructured": {
            "name": "Q46",
            "id": "473"
        },
        "studyId": "141978",
        "endTime": "12:50",
        "facultyCode": "PEF",
        "id": "1882531",
        "startTime": "11:00",
        "isDefaultCampus": "true",
        "courseId": "157994",
        "courseName": "Podniková ekonomika 1",
        "campus": "Brno - Černá Pole",
        "isSeminar": "true",
        "teachers": [
            {
                "fullName": "Ing. Marie Poláchová, Ph.D.",
                "id": "83974",
                "shortName": "M. Poláchová"
            }
        ],
        "courseCode": "EBC-PE",
        "periodId": "801"
    },
    {
        "date": "20251023",
        "isConsultation": "false",
        "room": "Q03",
        "roomStructured": {
            "name": "Q03",
            "id": "432"
        },
        "studyId": "141978",
        "endTime": "14:50",
        "facultyCode": "PEF",
        "id": "1871466",
        "startTime": "13:00",
        "isDefaultCampus": "true",
        "courseId": "159415",
        "courseName": "Počítačové sítě",
        "campus": "Brno - Černá Pole",
        "isSeminar": "false",
        "teachers": [
            {
                "fullName": "Ing. Igor Grellneth, Ph.D.",
                "id": "118619",
                "shortName": "I. Grellneth"
            }
        ],
        "courseCode": "EBC-PS",
        "periodId": "801"
    },
    {
        "date": "20251024",
        "isConsultation": "false",
        "room": "Q03",
        "roomStructured": {
            "name": "Q03",
            "id": "432"
        },
        "studyId": "141978",
        "endTime": "08:50",
        "facultyCode": "PEF",
        "id": "1874897",
        "startTime": "07:00",
        "isDefaultCampus": "true",
        "courseId": "159821",
        "courseName": "Vývoj webových aplikací",
        "campus": "Brno - Černá Pole",
        "isSeminar": "false",
        "teachers": [
            {
                "fullName": "Ing. Jan Turčínek, Ph.D.",
                "id": "4097",
                "shortName": "J. Turčínek"
            }
        ],
        "courseCode": "EBC-VWA",
        "periodId": "801"
    },
    {
        "date": "20251024",
        "isConsultation": "false",
        "room": "Q07",
        "roomStructured": {
            "name": "Q07",
            "id": "436"
        },
        "studyId": "141978",
        "endTime": "10:50",
        "facultyCode": "PEF",
        "id": "1875049",
        "startTime": "09:00",
        "isDefaultCampus": "true",
        "courseId": "159821",
        "courseName": "Vývoj webových aplikací",
        "campus": "Brno - Černá Pole",
        "isSeminar": "true",
        "teachers": [
            {
                "fullName": "Ing. Jan Turčínek, Ph.D.",
                "id": "4097",
                "shortName": "J. Turčínek"
            }
        ],
        "courseCode": "EBC-VWA",
        "periodId": "801"
    },
];

/**
 * Smart Week Detection
 * Returns the most relevant week to display:
 * - On weekends (Sat/Sun): show NEXT week (upcoming Monday-Friday)
 * - On weekdays: show CURRENT week (this Monday-Friday)
 * 
 * This ensures students always see their upcoming schedule, not past classes.
 */
export function getSmartWeekRange(referenceDate: Date = new Date()): { start: Date; end: Date } {
    const now = new Date(referenceDate);
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday

    let startOfWeek: Date;

    // If Saturday (6) or Sunday (0), show NEXT week
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Calculate next Monday
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday: +1 day, Saturday: +2 days
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + daysUntilMonday);
        startOfWeek.setHours(0, 0, 0, 0);
    } else {
        // Weekday: show current week (go back to this week's Monday)
        // If we are here, dayOfWeek is 1-5 (Mon-Fri).
        // If we are here, dayOfWeek is 1-5 (Mon-Fri).
        const daysToSubtract = dayOfWeek - 1;
        startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - daysToSubtract);
        startOfWeek.setHours(0, 0, 0, 0);
    }

    // End of week is always Friday (4 days after Monday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);
    endOfWeek.setHours(23, 59, 59, 999);

    return { start: startOfWeek, end: endOfWeek };
}
