import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { toIso } from '../../../../utils/mobile/weekDays';

/**
 * The step back to today. The arrows and the day chips only ever step AWAY
 * from it, and nothing brought you back except stepping the same way.
 *
 * It floats above the tab bar, centred like the bar and dressed like it, and
 * exists only while the selected day is not today — so today's screen is
 * exactly what it was. It is NOT in the header: beside the date it never fit
 * on a phone (at 375 the title column is 187px and "Čtvrtek 10. září" plus
 * the pill need 228), under the date it made the calendar header one line
 * taller than the other tabs', and Dominik judged the header full at three
 * actions. Apple's Calendar keeps Today in the bottom bar for the same
 * reason. `bottom-[84px]` clears BottomNav (18px inset + its ~54px height +
 * a gap) and the pill is 44px, the hit-target floor every other control here
 * keeps; the scrollers under it pad `pb-36` so the last row is never under
 * the pill. `null` is "today" in the store, so the day re-derives itself at
 * midnight rather than pinning a date. Ink on the surface, not the lime:
 * text-primary on a light surface measured 1.89:1.
 */
export function TodayPill({ selectedIso }: { selectedIso: string }) {
  const { t } = useTranslation();
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  if (selectedIso === toIso(new Date())) return null;
  return (
    <button
      type="button"
      onClick={() => setMobileSelectedDay(null)}
      className="absolute bottom-[84px] left-1/2 z-30 flex min-h-11 -translate-x-1/2 items-center whitespace-nowrap rounded-full border border-base-300 bg-base-100 px-4 text-sm font-semibold text-base-content shadow-drawer"
    >
      {t('common.today')}
    </button>
  );
}
