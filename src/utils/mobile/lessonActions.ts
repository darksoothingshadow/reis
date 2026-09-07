import type { BlockLesson } from '../../types/calendarTypes';
import type { MobileSheet } from '../../store/types';

/**
 * What a lesson row can do, as data. Both used to live inside
 * `EventDetailSheet`, which is gone: the row holds the day's own lesson, so
 * there is nothing to look up and no id/day matching to get wrong.
 */
export function subjectSheetFor(
  lesson: BlockLesson
): Extract<MobileSheet, { kind: 'subjectDrawer' }> {
  return { kind: 'subjectDrawer', courseCode: lesson.courseCode, courseName: lesson.courseName };
}

/** The room as the map knows it: IS appends " (Campus)" that `focusRoomByCode` does not want. */
export function roomCodeFor(lesson: BlockLesson): string {
  return lesson.room.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
