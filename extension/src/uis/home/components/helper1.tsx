import type { CalendarSubject } from "./calendar/calendar";
import type { SchoolBlocks } from "./helper";

/**
 * Fills gaps in the MOCK_DATA schedule with 'EMPTY' blocks
 * based on the SCHOOL_BLOCKS start times.
 * @param {Array<object>} mockData - The original schedule data.
 * @param {object} schoolBlocks - The object defining valid block start times.
 * @returns {Array<object>} The new schedule with gaps filled.
 */
export const fillScheduleGaps = (mockData:CalendarSubject[], schoolBlocks:SchoolBlocks) => {
    // 1. Define the possible block start times in minutes
    const possibleBlockStartMinutes = Object.keys(schoolBlocks).map(h => timeToMinutes(`${h}.00`));
    // Assuming each block is 1 hour and 50 minutes (110 minutes) based on your MOCK_DATA gaps
    const BLOCK_DURATION_MINUTES = 110;

    // 2. Group and Sort the data
    const groupedData = mockData.reduce((acc, subject) => {
        // Group by day and date to handle the schedule day-by-day
        const key = `${subject.day}-${subject.date}`;
        if (!(acc as any)[key]) {
            (acc as any)[key] = [];
        }
        (acc as any)[key].push(subject);
        return acc;
    }, {});

    const sortedData = {};
    for (const key in groupedData) {
        // Sort subjects within each day by start time
        (sortedData as any)[key] = (groupedData as any)[key].sort((a:CalendarSubject, b:CalendarSubject) => 
            timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        );
    }

    // 3. Iterate through each day and fill gaps
    const filledSchedule = [];
    
    for (const key in sortedData) {
        const subjectsForDay = (sortedData as any)[key];
        const day = subjectsForDay[0].day;
        const date = subjectsForDay[0].date;

        let currentSubjectIndex = 0;
        //let nextBlockStartTime = possibleBlockStartMinutes[0]; // Start at the first possible time

        for (const blockStartMinutes of possibleBlockStartMinutes) {
            // Check if the current block time is already covered by a subject
            //let subjectStartsAtBlockTime = false;
            let currentSubject = subjectsForDay[currentSubjectIndex];

            // Look for a subject that starts at or after the current block time
            while (currentSubject && timeToMinutes(currentSubject.startTime) < blockStartMinutes) {
                 // Skip subjects that started before this block time and have finished.
                 currentSubjectIndex++;
                 currentSubject = subjectsForDay[currentSubjectIndex];
            }

            if (currentSubject && timeToMinutes(currentSubject.startTime) === blockStartMinutes) {
                // A subject aligns perfectly with the block start time
                filledSchedule.push(currentSubject);
                currentSubjectIndex++; // Move to the next subject
                //subjectStartsAtBlockTime = true;
            } else if (currentSubject && timeToMinutes(currentSubject.startTime) > blockStartMinutes) {
                // There is a gap: the subject starts *after* this block time
                const blockStartTimeString = `${Math.floor(blockStartMinutes / 60)}.${(blockStartMinutes % 60) < 10 ? '0' : ''}${blockStartMinutes % 60}`;
                filledSchedule.push(createEmptyBlock(blockStartTimeString, day, date, BLOCK_DURATION_MINUTES));
            } else if (!currentSubject) {
                // No more subjects for the day, fill the rest with empty blocks
                const blockStartTimeString = `${Math.floor(blockStartMinutes / 60)}.${(blockStartMinutes % 60) < 10 ? '0' : ''}${blockStartMinutes % 60}`;
                filledSchedule.push(createEmptyBlock(blockStartTimeString, day, date, BLOCK_DURATION_MINUTES));
            }
        }
    }

    return filledSchedule;
};

/**
 * Creates an empty block object for a given start time and day.
 * @param {string} startTime - The starting time for the empty block (e.g., "9.00").
 * @param {string} day - The day of the week (e.g., "St").
 * @param {string} date - The date (e.g., "08.10.2025").
 * @param {number} durationMinutes - The duration of the empty block in minutes (e.g., 110 for 1:50).
 * @returns {object} The empty block object.
 */
const createEmptyBlock = (startTime:string, day:string, date:string, durationMinutes:number) => {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;

    // Helper to format minutes past midnight back to "H.MM" string
    const minutesToTimeString = (minutes:number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `${hours}.${mins < 10 ? '0' : ''}${mins}`;
    };

    return {
        day: day,
        date: date,
        startTime: startTime,
        endTime: minutesToTimeString(endMinutes),
        subject: null,
        subjectCode: null,
        faculty: null,
        type: "EMPTY", // Crucial identifier for empty blocks
        room: null,
        teacher: null
    };
};


/**
 * Converts a time string (e.g., "7.00", "9.50") into minutes past midnight.
 * @param {string} timeString - The time string in "H.MM" format.
 * @returns {number} The time in minutes past midnight.
 */
const timeToMinutes = (timeString:string) => {
    // Replace the dot with a colon for standard parsing, then split.
    const [hours, minutes] = timeString.replace('.', ':').split(':').map(Number);
    return hours * 60 + minutes;
};