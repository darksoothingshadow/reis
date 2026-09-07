import type { AppSlice, MobileUiSlice } from '../types';
import { IndexedDBService } from '../../services/storage';
import { clampRailWidth, RAIL_PX } from '../../utils/mapRail';

/**
 * Navigational state for the phone UI: which tab, which day, and the sheet
 * stack. A stack rather than a flag because the prototype genuinely nests
 * (Student → person, Subjects → drawer → confirm), and it gives Android
 * back-button handling for free later.
 *
 * Purely-local disclosure state (which accordion is open) deliberately stays
 * in component useState — this slice is for state that crosses components.
 */
export const createMobileUiSlice: AppSlice<MobileUiSlice> = (set, get) => ({
  mobileTab: 'calendar',
  mobileSelectedDayIso: null,
  mobileSheets: [],
  // Opens at the middle stop so the campus events are visible without a drag:
  // the peek band showed a title and blank space, and reaching the events meant
  // pulling the sheet up over the map every time.
  mapSheetState: 'half',
  mapRailWidth: RAIL_PX,
  mapRailOpen: true,
  preferredMapApp: null,
  devPhoneOverride: null,
  welcomeSeen: null,

  // Read once at boot, before the root renders (capacitor/main.capacitor.tsx).
  // Same key as the desktop WelcomeModal: a device that dismissed it there has
  // dismissed it here. Demo mode is "seen" — there is no IS certificate to set
  // eduroam up from, and the reviewer's path should not open with a Wi-Fi alert.
  hydrateWelcome: async ({ demo }) => {
    if (demo) {
      set({ welcomeSeen: true });
      return;
    }
    const dismissed = await IndexedDBService.get('meta', 'welcome_dismissed');
    set({ welcomeSeen: dismissed === true });
  },
  // State first, storage second: the screen must go away on the tap, and a
  // failed write is logged by the caller through the returned promise.
  dismissWelcome: async () => {
    set({ welcomeSeen: true });
    await IndexedDBService.set('meta', 'welcome_dismissed', true);
  },

  // Switching tabs closes sheets: a sheet belongs to the screen that opened it.
  setMobileTab: (tab) => {
    set({ mobileTab: tab, mobileSheets: [] });
    // A file opened from the Subjects tab should be in the calendar's
    // "recently opened" strip by the time the student gets there.
    if (tab === 'calendar') void get().refreshRecentPdfs();
  },
  setMobileSelectedDay: (iso) => set({ mobileSelectedDayIso: iso }),

  // A push onto a sheet of the SAME kind swaps in place instead of stacking.
  // Tapping a second classmate while the first one's card is open is a lateral
  // move, not a descent, and stacking put two person cards on screen at once —
  // the new one sliding up over the one it meant to replace. Done as a single
  // store update so no frame ever renders both, and the sheet UNDERNEATH (the
  // subject drawer that opened the first card) is untouched, so back still
  // goes where it should.
  pushSheet: (sheet) =>
    set((s) => ({
      mobileSheets:
        s.mobileSheets.at(-1)?.kind === sheet.kind
          ? [...s.mobileSheets.slice(0, -1), sheet]
          : [...s.mobileSheets, sheet],
    })),
  popSheet: () => set((s) => ({ mobileSheets: s.mobileSheets.slice(0, -1) })),
  replaceSheet: (sheet) => set((s) => ({ mobileSheets: [...s.mobileSheets.slice(0, -1), sheet] })),
  closeAllSheets: () => set({ mobileSheets: [] }),

  setMapSheetState: (state) => set({ mapSheetState: state }),
  // Clamped on the way IN, so nothing downstream — the rail's own width, the
  // camera offset that halves it — ever has to re-check.
  setMapRailWidth: (px) => set({ mapRailWidth: clampRailWidth(px, window.innerWidth) }),
  setMapRailOpen: (open) => set({ mapRailOpen: open }),

  // Read at boot, like the theme and the language. A venue tap is a one-tap
  // action; asking it to await IndexedDB would put a frame of "ask" in front of
  // a student who had already answered.
  loadPreferredMapApp: async () => {
    const saved = await IndexedDBService.get('meta', 'preferred_map_app');
    if (saved === 'apple' || saved === 'google') set({ preferredMapApp: saved });
  },
  // State first, storage second: the sheet must close on the tap, and a failed
  // write costs the student one extra ask next time rather than the journey.
  setPreferredMapApp: async (app) => {
    set({ preferredMapApp: app });
    await IndexedDBService.set('meta', 'preferred_map_app', app);
  },
  setDevPhoneOverride: (value) => set({ devPhoneOverride: value }),
});
