import { create } from 'zustand';
import type { AppState } from './types';
import { createScheduleSlice } from './slices/createScheduleSlice';
import { createExamSlice } from './slices/createExamSlice';
import { createSyllabusSlice } from './slices/createSyllabusSlice';
import { createZaznamnikSlice } from './slices/createZaznamnikSlice';
import { createFilesSlice } from './slices/createFilesSlice';
import { createNotesSlice } from './slices/createNotesSlice';
import { createClassmatesSlice } from './slices/createClassmatesSlice';
import { createSubjectsSlice } from './slices/createSubjectsSlice';
import { createSyncSlice } from './slices/createSyncSlice';
import { createThemeSlice } from './slices/createThemeSlice';
import { createI18nSlice } from './slices/createI18nSlice';
import { createSuccessRateSlice } from './slices/createSuccessRateSlice';
import { createEduroamSlice } from './slices/createEduroamSlice';
import { createDocumentsSlice } from './slices/createDocumentsSlice';
import { createFeedbackSlice } from './slices/createFeedbackSlice';
import { createStudyPlanSlice } from './slices/createStudyPlanSlice';
import { createCvicneTestsSlice } from './slices/createCvicneTestsSlice';
import { createErasmusSlice } from './slices/createErasmusSlice';
import { createMenuSlice } from './slices/createMenuSlice';
import { createHiddenItemsSlice } from './slices/createHiddenItemsSlice';
import { createTeachingWeekSlice } from './slices/createTeachingWeekSlice';
import { createNavPagesSlice } from './slices/createNavPagesSlice';
import { createContextSlice } from './slices/createContextSlice';
import { createPulseSlice } from './slices/createPulseSlice';
import { createCustomEventsSlice } from './slices/createCustomEventsSlice';
import { createNotificationSlice } from './slices/createNotificationSlice';
import { createSearchSlice } from './slices/createSearchSlice';
import { createPersonProfileSlice } from './slices/createPersonProfileSlice';
import { createBulletinSlice } from './slices/createBulletinSlice';
import { createViewportSlice } from './slices/createViewportSlice';
import { createMobileUiSlice } from './slices/createMobileUiSlice';
import { createMapSlice } from './slices/createMapSlice';
import { createRsvpSlice } from './slices/createRsvpSlice';
import { createHousingSlice } from './slices/createHousingSlice';
import { createAdminSlice } from './slices/createAdminSlice';
import { createHousingAdminSlice } from './slices/createHousingAdminSlice';
import { createAdminStatsSlice } from './slices/createAdminStatsSlice';
import { createSuggestionsSlice } from './slices/createSuggestionsSlice';
import { createDemoSlice } from './slices/createDemoSlice';
import { syncService } from '../services/sync';
import { initMockData } from '../utils/initMockData';
import { resetRealDataStores } from '../services/loadRealDataSnapshot';
import { devAdminSeed } from '../utils/mock/devSociety';
import type { Session } from '@supabase/supabase-js';
import { FILES_SYNC_CHANNEL, type FilesSyncMessage } from './slices/files/broadcastFilesSync';
import { setDemoModeFlag } from '../errors/demoMode';

export const useAppStore = create<AppState>()((...a) => ({
  ...createScheduleSlice(...a),
  ...createExamSlice(...a),
  ...createSyllabusSlice(...a),
  ...createZaznamnikSlice(...a),
  ...createFilesSlice(...a),
  ...createNotesSlice(...a),
  ...createClassmatesSlice(...a),
  ...createSubjectsSlice(...a),
  ...createSyncSlice(...a),
  ...createThemeSlice(...a),
  ...createI18nSlice(...a),
  ...createSuccessRateSlice(...a),
  ...createEduroamSlice(...a),
  ...createDocumentsSlice(...a),
  ...createFeedbackSlice(...a),
  ...createStudyPlanSlice(...a),
  ...createCvicneTestsSlice(...a),
  ...createErasmusSlice(...a),
  ...createMenuSlice(...a),
  ...createHiddenItemsSlice(...a),
  ...createTeachingWeekSlice(...a),
  ...createNavPagesSlice(...a),
  ...createContextSlice(...a),
  ...createPulseSlice(...a),
  ...createCustomEventsSlice(...a),
  ...createNotificationSlice(...a),
  ...createSearchSlice(...a),
  ...createPersonProfileSlice(...a),
  ...createBulletinSlice(...a),
  ...createViewportSlice(...a),
  ...createMobileUiSlice(...a),
  ...createMapSlice(...a),
  ...createRsvpSlice(...a),
  ...createHousingSlice(...a),
  ...createAdminSlice(...a),
  ...createHousingAdminSlice(...a),
  ...createAdminStatsSlice(...a),
  ...createSuggestionsSlice(...a),
  ...createDemoSlice(...a),
}));

// Initialize store and subscribe to sync updates
export const initializeStore = async () => {
  // Initialize mock data for demo if enabled
  // Set USE_MOCK_DATA=true in your .env file to enable
  if (import.meta.env.VITE_USE_MOCK_DATA === 'true') {
    await initMockData();
  } else {
    // Dev standalone real-data mode: wipe crawl data left in IDB by a previous
    // mock session BEFORE the tier-1 hydration below reads it, so the snapshot
    // is the sole source of truth. No-op in production / inside the iframe.
    //
    // `import.meta.env.DEV` and not the wider harness predicate: this uses the
    // DEFAULT url, the raw `/dev-real-data.json`, which is right for
    // `npm run dev:web` and wrong for a built preview — there the raw scrape is
    // deleted from the output, and dev/bootDemoMode.ts already calls
    // resetRealDataStores('/preview-data.json') with the sanitised file.
    // `npm run check:app` fails the build if this asks for the raw scrape.
    if (import.meta.env.DEV) await resetRealDataStores();
  }

  const s = useAppStore.getState();

  // Start global pulse
  const pulseInterval = setInterval(() => {
    useAppStore.getState().updatePulse();
  }, 1000);

  // Tier 1: User-visible data — load immediately
  s.loadNotificationState();
  s.loadPreferredMapApp();
  s.fetchNotifications();
  s.fetchSchedule();
  s.fetchExams();
  s.fetchSubjects();
  s.loadTheme();
  s.loadLanguage();
  s.loadContext();
  const devSeed = devAdminSeed();
  if (devSeed) {
    // Dev-only: seed a persistent society/admin session so the organizer and
    // reIS-admin surfaces are available at localhost:3000 without a Supabase
    // login on every reload. Stripped from production by import.meta.env.DEV.
    useAppStore.setState({
      // Role comes from the seed rather than being hardcoded to 'association':
      // the reIS-admin surfaces (the suggestions inbox) only appear for
      // 'reis_admin', so a fixed role made them unreachable in the dev webapp.
      adminRole: devSeed.adminRole,
      adminAssociationId: devSeed.adminAssociationId,
      adminActiveAssociationId: devSeed.adminAssociationId,
      adminSession: { user: { email: devSeed.email } } as unknown as Session,
    });
    if (devSeed.adminRole === 'reis_admin') void s.loadSuggestions();
    void s.loadSocietyPosts();
  } else {
    s.loadAdminSession();
  }

  // Tier 2: Background data — deferred to avoid thundering-herd on IDB at startup
  queueMicrotask(async () => {
    const s2 = useAppStore.getState();
    s2.fetchStudyPlan();
    s2.fetchStudyStats();
    s2.fetchStudyComparison();
    s2.loadGradeHistory();
    s2.fetchCvicneTests();
    s2.fetchOdevzdavarny();
    s2.fetchAllFiles();
    s2.fetchAllClassmates();
    await s2.hydrateLastFilesFetchedAt();
    await s2.hydrateLastClassmatesFetchedAt();
    await s2.hydrateLastExamClassmatesFetchedAt();
    s2.fetchZaznamnik();
    s2.loadFeedbackState();
    s2.loadHiddenItems();
    s2.loadCalendarCustomEvents();
    s2.fetchTeachingWeek();
    s2.loadRecentSearches();
    s2.hydrateBulletin();
    s2.loadMapEvents();
    // Predictive prefetch — files for subjects scheduled today.
    // Guarded by 60s SWR + max 6 subjects in prefetchTodaySubjectsImpl.
    useAppStore.getState().prefetchTodaySubjects();
  });

  // Fire-and-forget daily usage tracking. The row is still keyed on a random
  // install id, never the student's identity; since September 2026 it also
  // carries two GROUP labels (faculty, platform) read via getUserParams()/
  // getPlatform() — see the comment on trackDailyUsage.
  import('../api/feedback').then(({ trackDailyUsage }) => trackDailyUsage());

  // Subscribe to sync service — selective refresh based on type
  const unsubscribe = syncService.subscribe((type) => {
    const st = useAppStore.getState();

    if (type === 'THEME_UPDATE') {
      st.loadTheme();
      return;
    }
    if (type === 'LANGUAGE_UPDATE') {
      st.loadLanguage().then(() => useAppStore.getState().loadMapEvents());
      st.fetchAllFiles();
      useAppStore.setState({ menu: null });
      return;
    }

    // Default: full data refresh (e.g. after sync completes)
    // Chain prefetch after schedule resolves so a fresh install (empty IDB
    // schedule at init) still gets predictive prefetch on the first sync.
    st.fetchSchedule().then(() => useAppStore.getState().prefetchTodaySubjects());
    st.fetchExams();
    st.fetchSubjects();
    st.fetchStudyPlan();
    st.fetchStudyStats();
    st.fetchStudyComparison();
    st.loadGradeHistory();
    st.fetchCvicneTests();
    st.fetchOdevzdavarny();
  });

  // Cross-tab theme listener — use loadTheme() to also update DOM data-theme attribute
  const bcTheme = new BroadcastChannel('reis_theme_sync');
  bcTheme.onmessage = () => {
    useAppStore.getState().loadTheme();
  };

  // Cross-tab language listener — use loadLanguage() and re-fetch files for the new language
  const bcLang = new BroadcastChannel('reis_language_sync');
  bcLang.onmessage = () => {
    useAppStore
      .getState()
      .loadLanguage()
      .then(() => useAppStore.getState().loadMapEvents());
    useAppStore.getState().fetchAllFiles();
    // Clear menu so it re-fetches with the new language
    useAppStore.setState({ menu: null });
  };

  // Cross-iframe files listener — when another window refreshes a subject's
  // files, rehydrate from IDB and advance lastFilesFetchedAt without re-fetching.
  const bcFiles = new BroadcastChannel(FILES_SYNC_CHANNEL);
  bcFiles.onmessage = (event) => {
    const msg = event.data as FilesSyncMessage | undefined;
    if (!msg?.courseCode) return;
    useAppStore.setState((s) => ({
      lastFilesFetchedAt: { ...s.lastFilesFetchedAt, [msg.courseCode]: msg.fetchedAt },
    }));
    void useAppStore.getState().refreshFiles(msg.courseCode);
  };

  return () => {
    clearInterval(pulseInterval);
    unsubscribe();
    bcTheme.close();
    bcLang.close();
    bcFiles.close();
  };
};

// Keeps the store the single source of truth for demo mode while letting the
// network guards read it without importing this module — see errors/demoMode.
// Subscribing rather than writing from the slice means `setState({ demoMode })`
// in a test propagates too.
useAppStore.subscribe((state) => setDemoModeFlag(state.demoMode));
