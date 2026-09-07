/**
 * Language-resolution predicate for a lesson's dual-language fields
 * (`courseName`/`courseNameCs`/`courseNameEn`, `room`/`roomCs`/`roomEn`).
 *
 * Desktop's `CalendarEventCard` (`getLocalizedCourseName`/`getLocalizedRoom`)
 * is the canonical chain: in English mode, prefer the `*En` variant; otherwise
 * (or when it's missing/empty) fall back to the `*Cs` variant, then the base
 * field. Uses `||`, not `??`, so an empty-string localized value falls through
 * too, and — critically — an English-mode lesson with no `*En` translation
 * still falls back to `*Cs` rather than skipping straight to the (Czech) base
 * field. Shared by mobile (`AgendaEvent`, `NowNextCard`)
 * so the predicate can't drift into three subtly different copies again.
 */
export interface LocalizedLessonFields {
  courseName: string;
  courseNameCs?: string;
  courseNameEn?: string;
  room: string;
  roomCs?: string;
  roomEn?: string;
}

export function localizedCourseName(lesson: LocalizedLessonFields, language: string): string {
  if (language === 'en' && lesson.courseNameEn) return lesson.courseNameEn;
  return lesson.courseNameCs || lesson.courseName;
}

export function localizedRoom(lesson: LocalizedLessonFields, language: string): string {
  if (language === 'en' && lesson.roomEn) return lesson.roomEn;
  return lesson.roomCs || lesson.room;
}
