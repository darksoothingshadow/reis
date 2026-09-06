import type { StateCreator } from 'zustand';
import type { PreferredMapApp } from '../utils/venueMapUrl';
import type { BlockLesson, HiddenItems, CalendarCustomEvent } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyncDomain } from '../types/messages/base';
import type {
  SyllabusRequirements,
  ParsedFile,
  SubjectsData,
  SubjectSuccessRate,
  SubjectAttendance,
} from '../types/documents';
import type { ClassmatesData, Classmate } from '../types/classmates';
import type { DualLanguageStudyPlan, StudyStats, StudyComparison } from '../types/studyPlan';
import type { GradeHistory } from '../types/documents';
import type { CvicnyTest } from '../api/cvicneTests';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { SyncStatus } from '../services/sync';
import type { ErasmusCountryData, ErasmusConfig, University } from '../types/erasmus';
import type { BulletinPost } from '../types/bulletin';
import type { OutletMenu } from '../types/menuTypes';
import type { PageCategory } from '../data/pages/types';
import type { SpolekNotification } from '../services/spolky/types';
import type { SubjectZaznamnik } from '../types/zaznamnik';
import type {
  RoomsCollection,
  MapSelection,
  PoiProperties,
  RoomProperties,
} from '../types/campusMap';
import type { MapEvent } from '../types/events';

export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Theme = 'mendelu' | 'mendelu-dark';
export type Language = 'cz' | 'en';

export interface CourseDeadline {
  week: number;
  label: string;
}

export interface ScheduleSlice {
  schedule: {
    data: BlockLesson[];
    status: Status;
  };
  fetchSchedule: () => Promise<void>;
  setSchedule: (data: BlockLesson[]) => void;
}

export interface ExamSlice {
  exams: {
    data: ExamSubject[];
    status: Status;
    error: string | null;
  };
  lastExamsFetchedAt: number | null;
  examsRefreshing: boolean;
  fetchExams: () => Promise<void>;
  setExams: (data: ExamSubject[]) => void;
  triggerExamsRefresh: () => void;
  /** terminId → flat classmate list */
  examClassmates: Record<string, Classmate[]>;
  examClassmatesLoading: Record<string, boolean>;
  lastExamClassmatesFetchedAt: Record<string, number>;
  examClassmatesError: Record<string, string>;
  fetchExamClassmatesPriority: (terminId: string) => Promise<void>;
  refreshExamClassmatesForTermin: (terminId: string) => Promise<void>;
  fetchAllExamClassmates: () => Promise<void>;
  hydrateLastExamClassmatesFetchedAt: () => Promise<void>;
  /** terminId → teacher's Poznámka (always fetched in CZ; teacher-authored text is shown as-is to all UI languages). null = fetched-no-note. undefined = not fetched. In-memory only (session-bound TTL). */
  examNotes: Record<string, import('../api/terminyInfo').TermNote | null>;
  examNotesLoading: Record<string, boolean>;
  examNotesError: Record<string, string>;
  lastExamNotesFetchedAt: Record<string, number>;
  fetchExamNotePriority: (terminId: string) => Promise<void>;
}

export interface ZaznamnikSlice {
  zaznamnik: Record<string, SubjectZaznamnik | null>;
  zaznamnikHydrated: boolean;
  setZaznamnikBatch: (data: Record<string, SubjectZaznamnik | null>) => void;
  fetchZaznamnik: () => Promise<void>;
}

export interface SyllabusSlice {
  syllabuses: {
    cache: Record<string, SyllabusRequirements>;
    loading: Record<string, boolean>;
  };
  fetchSyllabus: (courseCode: string, courseId?: string, subjectName?: string) => Promise<void>;
}

export interface FilesSlice {
  files: Record<string, ParsedFile[]>;
  filesLoading: Record<string, boolean>;
  lastFilesFetchedAt: Record<string, number>;
  fetchFiles: (courseCode: string) => Promise<void>;
  fetchFilesPriority: (courseCode: string) => Promise<void>;
  fetchAllFiles: () => Promise<void>;
  refreshFiles: (courseCode: string) => Promise<void>;
  refreshFilesForSubject: (courseCode: string) => Promise<void>;
  hydrateLastFilesFetchedAt: () => Promise<void>;
  prefetchTodaySubjects: () => void;
  speculativeRefreshFiles: (courseCode: string) => void;
}

export interface NotesSlice {
  documentNotes: Record<string, string>;
  documentNotesLoading: Record<string, boolean>;
  documentNotesSaving: Record<string, boolean>;
  documentNotesError: Record<string, boolean>;
  fetchDocumentNote: (courseCode: string, fileLink: string) => Promise<void>;
  setDocumentNote: (courseCode: string, fileLink: string, value: string, fileName: string) => void;
  flushDocumentNotes: () => void;
  /** Push a snapshot of all notes to the content script for Drive backup. */
}

export interface ClassmatesSlice {
  /** courseCode → flat list of seminar classmates */
  classmates: Record<string, ClassmatesData>;
  classmatesLoading: Record<string, boolean>;
  lastClassmatesFetchedAt: Record<string, number>;
  classmatesError: Record<string, string>;
  fetchClassmatesPriority: (courseCode: string) => Promise<void>;
  fetchAllClassmates: () => Promise<void>;
  refreshClassmatesForSubject: (courseCode: string) => Promise<void>;
  hydrateLastClassmatesFetchedAt: () => Promise<void>;
}

export interface SubjectsSlice {
  subjects: SubjectsData | null;
  subjectsLoading: boolean;
  courseNicknames: Record<string, string>;
  courseDeadlines: Record<string, CourseDeadline[]>;
  attendance: Record<string, SubjectAttendance[]>;
  pastAttendance: Record<string, SubjectAttendance[]>;
  fetchSubjects: () => Promise<void>;
  setAttendance: (data: Record<string, SubjectAttendance[]>) => void;
  setPastAttendance: (data: Record<string, SubjectAttendance[]>) => void;
  setCourseNickname: (courseCode: string, nickname: string | null) => void;
  setCourseDeadlines: (courseCode: string, deadlines: CourseDeadline[] | null) => void;
}

export interface SyncSlice {
  syncStatus: SyncStatus;
  isSyncing: boolean;
  /**
   * Whether a sync has run to completion since the app started.
   *
   * `handshakeDone` cannot answer that question: it flips on the FIRST status
   * message, and a sync posts one as it starts. Screens that show "you have
   * nothing" need to know the difference between nothing and not-yet.
   */
  firstSyncSettled: boolean;
  /**
   * Per-domain arrival, so one screen need not wait for the whole crawl.
   *
   * `firstSyncSettled` alone is too coarse: a student with no lessons and no
   * exams — every summer — would sit on two loading screens for the twenty
   * seconds the full crawl takes, to be told nothing twice.
   */
  syncLoaded: Partial<Record<SyncDomain, boolean>>;
  markSyncLoaded: (domains: SyncDomain[]) => void;
  fetchSyncStatus: () => Promise<void>;
  setSyncStatus: (status: Partial<SyncStatus>) => void;
}

export interface ThemeSlice {
  theme: Theme;
  isThemeLoading: boolean;
  setTheme: (theme: Theme) => Promise<void>;
  loadTheme: () => Promise<void>;
}

export interface I18nSlice {
  language: Language;
  isLanguageLoading: boolean;
  setLanguage: (lang: Language) => Promise<void>;
  loadLanguage: () => Promise<void>;
}

export interface SuccessRateSlice {
  successRates: Record<string, SubjectSuccessRate>;
  successRatesLoading: Record<string, boolean>;
  successRatesGlobalLoaded: boolean;
  fetchSuccessRate: (courseCode: string) => Promise<void>;
  fetchSuccessRateBatch: (courseCodes: string[]) => Promise<void>;
}

export interface EduroamSlice {
  isEduroamOpen: boolean;
  setIsEduroamOpen: (open: boolean) => void;
}

export interface DocumentsSlice {
  isDocumentsOpen: boolean;
  setIsDocumentsOpen: (open: boolean) => void;
}

export interface FeedbackSlice {
  feedbackEligible: boolean;
  feedbackDismissed: boolean;
  loadFeedbackState: () => Promise<void>;
  submitNps: (rating: number, reason?: string) => Promise<void>;
  dismissFeedback: () => Promise<void>;
}

export interface StudyPlanSlice {
  studyPlanDual: DualLanguageStudyPlan | null;
  /** true once the first fetchStudyPlan() call has fully resolved */
  studyPlanLoaded: boolean;
  studyStats: StudyStats | null;
  studyComparison: StudyComparison | null;
  gradeHistory: GradeHistory | null;
  fetchStudyPlan: () => Promise<void>;
  fetchStudyStats: () => Promise<void>;
  setStudyStats: (stats: StudyStats) => void;
  fetchStudyComparison: () => Promise<void>;
  setStudyComparison: (c: StudyComparison) => void;
  loadGradeHistory: () => Promise<void>;
  setGradeHistory: (g: GradeHistory) => void;
}

export interface ErasmusStudentInfo {
  firstName: string;
  lastName: string;
  dob: string;
  studyCode: string;
  semester: 'WS' | 'SS' | '';
  studentId: string;
}

export interface ErasmusUniversityOption {
  id: string;
  institutionName: string;
  erasmusCode: string;
  country: string;
  link: string;
  courses: { code: string; name: string; credits: number }[];
}

export interface ErasmusSlice {
  erasmusData: ErasmusCountryData | null;
  erasmusLoading: boolean;
  erasmusCountryFile: string;
  erasmusConfig: ErasmusConfig | null;
  erasmusTableBCourses: Record<string, string[]>;
  erasmusTableBManualCourses: Record<string, { code: string; name: string; credits: number }[]>;
  erasmusStudentInfo: ErasmusStudentInfo;
  erasmusTableAOptions: ErasmusUniversityOption[];
  erasmusPdfAssignments: Record<string, string>; // courseCode → filename
  erasmusPinnedUniversities: string[];
  erasmusUploadedPdfs: Record<string, { text: string; base64: string }>; // filename → extracted text + raw base64
  erasmusActiveTab: 'plan' | 'explore';
  erasmusPlanPhase: 'select' | 'review';
  universities: Record<string, University[]>;
  universitiesLoading: Record<string, boolean>;
  fetchUniversities: (alpha2: string) => Promise<void>;
  addErasmusUploadedPdf: (filename: string, text: string, base64: string) => void;
  removeErasmusUploadedPdf: (filename: string) => void;
  clearErasmusUploadedPdfs: () => void;
  setErasmusPdfAssignment: (courseCode: string, filename: string | null) => void;
  setErasmusCountry: (file: string) => Promise<void>;
  setErasmusActiveTab: (tab: 'plan' | 'explore') => void;
  setErasmusPlanPhase: (phase: 'select' | 'review') => void;
  fetchErasmusReports: () => Promise<void>;
  fetchErasmusConfig: () => Promise<void>;
  toggleErasmusTableBCourse: (optionId: string, code: string) => void;
  reorderErasmusTableBCourse: (optionId: string, fromIndex: number, toIndex: number) => void;
  setErasmusStudentInfo: (data: Partial<ErasmusStudentInfo>) => void;
  initErasmusStudentInfo: (params: {
    fullName?: string;
    studyProgram?: string;
    studentId?: string;
  }) => void;
  pinErasmusUniversity: (name: string) => void;
  unpinErasmusUniversity: (name: string) => void;
  addErasmusTableAOption: () => void;
  removeErasmusTableAOption: (id: string) => void;
  updateErasmusTableAOptionHeader: (
    id: string,
    data: Partial<Omit<ErasmusUniversityOption, 'id' | 'courses'>>
  ) => void;
  addErasmusTableACourse: (
    optionId: string,
    course: { code: string; name: string; credits: number }
  ) => void;
  removeErasmusTableACourse: (optionId: string, index: number) => void;
  reorderErasmusTableACourse: (optionId: string, fromIndex: number, toIndex: number) => void;
  addErasmusTableBManualCourse: (
    optionId: string,
    course: { code: string; name: string; credits: number }
  ) => void;
  removeErasmusTableBManualCourse: (optionId: string, index: number) => void;
  reorderErasmusTableBManualCourse: (optionId: string, fromIndex: number, toIndex: number) => void;
  loadErasmusState: () => Promise<void>;
}

export interface CvicneTestsSlice {
  cvicneTests: CvicnyTest[];
  cvicneTestsStatus: Status;
  fetchCvicneTests: () => Promise<void>;
  setCvicneTests: (tests: CvicnyTest[]) => void;
  odevzdavarny: Odevzdavarna[];
  odevzdavarnyStatus: Status;
  fetchOdevzdavarny: () => Promise<void>;
  setOdevzdavarny: (assignments: Odevzdavarna[]) => void;
}

export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  isLoading: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export interface MenuSlice {
  menu: OutletMenu[] | null;
  menuLoading: boolean;
  menuError: boolean;
  fetchMenu: () => Promise<void>;
}

export interface HiddenItemsSlice {
  hiddenItems: HiddenItems;
  loadHiddenItems: () => Promise<void>;
  hideCourse: (
    courseCode: string,
    courseName: string,
    type?: 'lecture' | 'seminar' | 'all'
  ) => Promise<void>;
  unhideCourse: (courseCode: string, type?: 'lecture' | 'seminar' | 'all') => Promise<void>;
  hideEvent: (id: string, courseCode: string, courseName: string, date: string) => Promise<void>;
  unhideEvent: (id: string) => Promise<void>;
}

export interface TeachingWeekSlice {
  teachingWeekData: { weeks: { week: number; from: string; to: string }[]; total: number } | null;
  fetchTeachingWeek: () => Promise<void>;
}

export interface NavPagesSlice {
  navPages: PageCategory[] | null;
  setNavPages: (pages: PageCategory[]) => void;
}

export interface ContextSlice {
  studiumId: string | null;
  studentId: string | null;
  obdobiId: string | null;
  facultyId: string | null;
  userFaculty: string | null;
  userSemester: string | null;
  isErasmus: boolean;
  fullName: string | null;
  userEmail: string | null;
  loadContext: () => Promise<void>;
}

export interface CalendarCustomEventsSlice {
  customEvents: CalendarCustomEvent[];
  loadCalendarCustomEvents: () => Promise<void>;
  addCalendarCustomEvent: (event: CalendarCustomEvent) => Promise<void>;
  updateCalendarCustomEvent: (id: string, patch: Partial<CalendarCustomEvent>) => Promise<void>;
  removeCalendarCustomEvent: (id: string) => Promise<void>;
}

export interface PulseSlice {
  now: Date;
  updatePulse: () => void;
}

export interface NotificationSlice {
  notifications: {
    data: SpolekNotification[];
    readIds: Set<string>;
    viewedIds: Set<string>;
    seenDeadlineAlertIds: Set<string>;
    status: Status;
  };
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (ids: string[]) => Promise<void>;
  markNotificationViewed: (id: string) => Promise<void>;
  markDeadlineAlertsSeen: (ids: string[]) => Promise<void>;
  loadNotificationState: () => Promise<void>;
}

export interface BulletinSlice {
  bulletinPosts: BulletinPost[];
  bulletinFetchedAt: number | null;
  bulletinExpanded: boolean;
  bulletinLoading: boolean;
  bulletinError: boolean;
  bulletinHydrated: boolean;
  hydrateBulletin: () => Promise<void>;
  setBulletinExpanded: (expanded: boolean) => Promise<void>;
  loadBulletinIfStale: () => Promise<void>;
}

export interface ViewportSlice {
  isTouch: boolean;
  isNarrow: boolean;
  isPortrait: boolean;
  keyboardOpen: boolean;
  viewportHeight: number;
  setViewport: (
    patch: Partial<
      Pick<ViewportSlice, 'isTouch' | 'isNarrow' | 'isPortrait' | 'keyboardOpen' | 'viewportHeight'>
    >
  ) => void;
}

// No 'student': that tab was a fifth of the primary navigation spent on a
// search field, and search is a header action on every tab now — see the
// `search` sheet below. The slot it freed went to `profile`, which was a sheet
// behind the header avatar and carries far too much a student goes looking for
// (eduroam, documents, societies, hidden items, sign-out) to be one tap deep on
// one screen.
/**
 * Every tab the phone shell can be on, in nav order. The single source of
 * truth: `MobileTab` is derived from it, so a tab cannot be added to one and
 * forgotten in the other — the same reason `APP_VIEWS` exists for the desktop
 * views. `scripts/check-app.ts` sweeps this list, so a new tab is measured at
 * every width and in both themes without anyone remembering to add it.
 */
export const MOBILE_TABS = ['calendar', 'exams', 'subjects', 'map', 'profile'] as const;

export type MobileTab = (typeof MOBILE_TABS)[number];
// Three stops: `half` shows the campus events while the map is still in view,
// and is where the sheet opens. See primitives/sheetDrag.ts.
export type MapSheetState = 'peek' | 'half' | 'expanded';

/** Discriminated union of every sheet the phone UI can open. */
export type MobileSheet =
  // `dayIso` disambiguates the occurrence: the store holds the whole semester
  // and IS reuses a lesson id across the weeks it repeats, so the id alone does
  // not identify which one was tapped.
  | { kind: 'eventDetail'; eventId: string; dayIso?: string }
  | { kind: 'subjectDrawer'; courseCode: string; courseName?: string; courseId?: string }
  | { kind: 'studyPlan' }
  | { kind: 'person'; personId: string; personName?: string }
  // Pushed ON TOP of a person sheet, so back closes the photo and leaves the
  // person open. `name` rides along for the alt text — the photo sheet has no
  // reason to fetch a profile just to label an image.
  | { kind: 'personPhoto'; personId: string; name: string }
  | { kind: 'eduroam' }
  | { kind: 'docs' }
  | { kind: 'menu'; dayIso: string }
  | {
      kind: 'venue';
      coord: [number, number];
      label: string;
      platform: 'ios' | 'android' | 'web';
    }
  // People and the subject catalogue, opened from the header's search icon.
  // Was the 'student' TAB; it is a sheet so it opens over whichever tab the
  // student is on and returns them there. `query` prefills it and starts in
  // subject mode — that is how "look this subject up" from inside the study
  // plan reaches a search box, now that the plan has none of its own.
  | { kind: 'search'; query?: string }
  // No 'erasmus': the panel is desktop-only. It hosted the Learning Agreement
  // tables and the Europe map, which do not survive a phone, and it offered a
  // shortcut to every student for something only exchange students use.
  | { kind: 'notifications' }
  // The noticeboard. A sheet rather than the portal it used to be, mounted
  // inside CalendarScreen while its button shipped on every screen's header —
  // so it opened from one tab out of five.
  | { kind: 'bulletin' }
  // The housing board. Opened from the profile tab, from a society post whose
  // url is `reis://housing`, and from an event card carrying that token.
  | { kind: 'housing' }
  | { kind: 'confirm'; confirmId: string };

export interface MobileUiSlice {
  mobileTab: MobileTab;
  mobileSelectedDayIso: string | null;
  mobileSheets: MobileSheet[];
  mapSheetState: MapSheetState;
  /** The tablet rail's width in px. Dragged from its left edge; clamped by
   *  `clampRailWidth`. Ignored on a phone, where the panel is a bottom sheet. */
  mapRailWidth: number;
  /** Whether the tablet rail is showing. A rail has exactly two states — the
   *  sheet's three detents are a phone answer to a phone problem. */
  mapRailOpen: boolean;
  /** Which map app a venue opens in, remembered across launches. `null` asks. */
  preferredMapApp: PreferredMapApp;
  /** Dev-only forced phone/desktop branch. null = defer to viewport. */
  devPhoneOverride: boolean | null;
  /**
   * First-run welcome gate for the phone UI. null = not hydrated yet (render the
   * app, never flash the welcome at a returning student); false = show it.
   */
  welcomeSeen: boolean | null;
  hydrateWelcome: (o: { demo: boolean }) => Promise<void>;
  dismissWelcome: () => Promise<void>;

  setMobileTab: (tab: MobileTab) => void;
  setMobileSelectedDay: (iso: string | null) => void;
  pushSheet: (sheet: MobileSheet) => void;
  popSheet: () => void;
  replaceSheet: (sheet: MobileSheet) => void;
  closeAllSheets: () => void;
  setMapSheetState: (state: MapSheetState) => void;
  setMapRailWidth: (px: number) => void;
  setMapRailOpen: (open: boolean) => void;
  loadPreferredMapApp: () => Promise<void>;
  setPreferredMapApp: (app: PreferredMapApp) => Promise<void>;
  setDevPhoneOverride: (value: boolean | null) => void;
}

export interface MapSlice {
  activeBuildingId: number | null;
  activeFloorId: number | null;
  mapSelection: MapSelection | null;
  roomsByBuilding: Record<number, RoomsCollection>;
  mapLoadingBuilding: number | null;
  mapSearchQuery: string;
  mapSearchResults: MapSelection[];
  mapFocusRequest: number;
  setMapBuilding: (id: number) => void;
  exitToCampus: () => void;
  /** Clear the current selection (close the detail panel) without moving the camera — bare-map click in campus overview. */
  clearMapSelection: () => void;
  setMapFloor: (floorId: number) => void;
  selectMapRoom: (room: RoomProperties) => void;
  selectMapPoi: (poi: PoiProperties, coord: [number, number]) => void;
  setMapSearchQuery: (q: string) => void;
  focusRoomByCode: (code: string) => void;
  focusPoiById: (id: number) => void;
  focusLandmarkById: (id: number) => void;
  /** Fly to an off-campus MENDELU site (arboretum, Lednice, Žabčice, Křtiny). */
  focusRemotePlaceById: (id: number) => void;
  /** Fly back to the whole-campus overview (Místa "Hlavní kampus"). */
  focusCampus: () => void;
  /** Fly to an arbitrary named coordinate without a real landmark/poi (e.g. the JAK dorm cluster centre). */
  focusPoint: (name: string, coord: [number, number]) => void;
  loadMapBuilding: (id: number) => Promise<void>;
  // --- Society events on the map ---
  mapEvents: MapEvent[];
  mapEventsLoaded: boolean;
  /** Create a real reservation for a room + 1-hour slot; on success, force-refetch availability so the panel reflects it. Always an explicit, confirmed user action. */
  /** Which tab the top-right panel shows. */
  mapPanelTab: 'places' | 'events';
  /** Event scope: 'all' societies, or a specific societyId. */
  eventFilter: string;
  setMapPanelTab: (tab: 'places' | 'events') => void;
  setEventFilter: (filter: string) => void;
  loadMapEvents: () => Promise<void>;
  /** Refetch the public feed unconditionally (bypasses the load-once guard). Call after a society create/update/delete so the public map/"Akce" tab reflects the change without a full reload. */
  reloadMapEvents: () => Promise<void>;
  /** Select an event for the detail panel. Pass `{ fly: true }` (list click) to also fly the camera to its coordinate; a pin click omits it and the camera stays put. */
  focusEventById: (id: string, opts?: { fly?: boolean }) => void;
  // --- Society authoring ---
  /** The active society's own events (all dates), mapped from societyPosts. Drawn
   *  by the admin console's map; the student map draws `mapEvents` instead. Which
   *  of the two is in play is decided by `adminConsoleOpen`, not by a map flag. */
  societyMapEvents: MapEvent[];
  /** Rebuild societyMapEvents from the current societyPosts. Called after posts load/change. */
  refreshSocietyMapEvents: () => void;
  /** True while the user is picking a spot: the next map click captures a coordinate. */
  placingEvent: boolean;
  /** The coordinate [lng,lat] picked for the event being composed (null = none yet). */
  draftCoord: [number, number] | null;
  beginPlacing: () => void;
  cancelPlacing: () => void;
  /** Record a picked coordinate and leave placing mode. */
  placeDraftCoord: (coord: [number, number]) => void;
  clearDraftCoord: () => void;
  /** Bumped alongside mapFocusRequest so the phone console can bring the map tab forward. */
  draftFocusRequest: number;
  /**
   * WHERE the latest focus request pointed the camera. Stated rather than
   * consumed: MapCanvas's draw effect runs more than once per request (React
   * re-invokes it, and `roomsByBuilding` lands after mount), so a
   * "have I flown yet" flag was spent on the first run and the second run
   * re-fitted the campus on top of the move. Re-reading this gives the same
   * answer every time, which is what makes the camera stay put.
   */
  mapFocusTarget: 'campus' | 'draft';
  /** "Show me where this lands" — point the map at the draft before publishing. */
  previewDraftOnMap: () => void;
  /** True while the event-composer overlay is open. */
  composerOpen: boolean;
  /** Id of the societyMapEvents entry being edited, or null when composing a new event. */
  editEventId: string | null;
  openComposer: (editId?: string) => void;
  closeComposer: () => void;
}

export interface DemoSlice {
  /**
   * True only in the Capacitor app, and only when someone chose the demo from
   * the sign-in gate. Defaults false everywhere, which is what keeps the
   * extension build untouched without a build flag.
   */
  demoMode: boolean;
  enterDemo(): Promise<void>;
  exitDemo(): Promise<void>;
}

export type AppState = ScheduleSlice &
  ExamSlice &
  SyllabusSlice &
  ZaznamnikSlice &
  FilesSlice &
  NotesSlice &
  ClassmatesSlice &
  SubjectsSlice &
  SyncSlice &
  ThemeSlice &
  I18nSlice &
  SuccessRateSlice &
  EduroamSlice &
  DocumentsSlice &
  FeedbackSlice &
  StudyPlanSlice &
  CvicneTestsSlice &
  ErasmusSlice &
  MenuSlice &
  HiddenItemsSlice &
  CalendarCustomEventsSlice &
  TeachingWeekSlice &
  NavPagesSlice &
  ContextSlice &
  PulseSlice &
  NotificationSlice &
  BulletinSlice &
  ViewportSlice &
  MobileUiSlice &
  import('./slices/createSearchSlice').SearchSlice &
  import('./slices/createPersonProfileSlice').PersonProfileSlice &
  MapSlice &
  import('./slices/createRsvpSlice').RsvpSlice &
  import('./slices/createHousingSlice').HousingSlice &
  import('./slices/createHousingAdminSlice').HousingAdminSlice &
  import('./slices/createAdminSlice').AdminSlice &
  import('./slices/createSuggestionsSlice').SuggestionsSlice &
  DemoSlice;

export type AppSlice<T> = StateCreator<AppState, [], [], T>;
