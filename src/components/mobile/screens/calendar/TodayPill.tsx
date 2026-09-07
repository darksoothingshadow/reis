import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { toIso } from '../../../../utils/mobile/weekDays';

/**
 * The step back to today. The arrows and the day chips only ever step AWAY
 * from it, and nothing brought you back except stepping the same way.
 *
 * Renders nothing on today, so today's screen is exactly what it was. It sits
 * beside the date where it fits (the iPad) and under it where it does not (a
 * phone — inline it clipped the date at 320 and 390); `ScreenHeader.beside`
 * wraps on natural widths, which is what makes both true. `null` is "today" in
 * the store, so the day re-derives itself at midnight rather than pinning a
 * date. Ink on a tint, not the lime: text-primary on a light surface is 1.89:1.
 */
export function TodayPill({ selectedIso }: { selectedIso: string }) {
  const { t } = useTranslation();
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  if (selectedIso === toIso(new Date())) return null;
  return (
    <button
      type="button"
      onClick={() => setMobileSelectedDay(null)}
      className="flex-shrink-0 whitespace-nowrap rounded-full bg-base-content/10 px-2.5 py-1 text-xs font-semibold text-base-content"
    >
      {t('common.today')}
    </button>
  );
}
