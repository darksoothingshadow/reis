/**
 * Calendar utilities - barrel file.
 * Re-exports from modular helper files for backward compatibility.
 * 
 * Original file was 430 lines, now decomposed into:
 * - timeHelpers.ts: Time conversion functions
 * - weekCalc.ts: Smart week range calculation
 * - breakpoints.ts: Responsive breakpoint utilities
 * - urlHelpers.ts: URL parsing and misc utilities
 * - __mocks__/mockScheduleData.ts: Mock data for testing
 */

// Time helpers
export {
    SCHOOL_TIMES,
    TIME_LIST,
    DAY_NAMES,
    timeToMinutes,
    timeToMinutesDefault,
    minutesToTimeDefault,
    getSubjectLength
} from './timeHelpers';

// Week calculations
export { getSmartWeekRange } from './weekCalc';

// Breakpoints
export { getBreakpoint } from './breakpoints';

// URL helpers
export { GetIdFromLink, sleep } from './urlHelpers';

// Mock data (for backward compatibility, though this should be imported directly in tests)
export { MOCK_WEEK_SCHEDULE as MOCK_WEEK_SCHEDUELE } from './__mocks__/mockScheduleData';
