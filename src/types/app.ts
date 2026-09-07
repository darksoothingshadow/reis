/**
 * Every view the app can be on. The single source of truth: `AppView` is
 * derived from it, so a view cannot be added to one and forgotten in the
 * other. `src/api/suggestions.ts` used to hand-maintain a parallel copy.
 */
export const APP_VIEWS = [
  'calendar',
  'exams',
  'settings',
  'timeline-demo',
  'subjects',
  'studyPlan',
  'erasmus',
  'map',
] as const;

export type AppView = (typeof APP_VIEWS)[number];

/**
 * Validates a value that came from storage rather than from code.
 *
 * `meta.reis_current_view` is written by one build and read by the next, so a
 * view removed in between comes back as a string nothing renders — the app
 * boots to blank content until the student picks another screen. Casting the
 * stored value straight to `AppView` cannot catch that; this can.
 */
export function isAppView(v: unknown): v is AppView {
  return typeof v === 'string' && (APP_VIEWS as readonly string[]).includes(v);
}

export interface SelectedSubject {
  courseCode: string;
  courseName: string;
  courseId: string;
  id: string;
  isFromSearch?: boolean;
  facultyCode?: string;
  initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';
  isFulfilled?: boolean;
}
