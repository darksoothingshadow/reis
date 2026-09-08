import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { toIso } from '../../../../utils/mobile/weekDays';

/**
 * The step back to today. The arrows and the day chips only ever step AWAY
 * from it, and nothing brought you back except stepping the same way.
 *
 * It lives in the header's eyebrow row, above the date, where Exams and
 * Subjects carry their context line — so the calendar's title sits at the
 * same height as every other tab's. Beside the date it never fit on a phone
 * (at 375 the title column is 187px and "Čtvrtek 10. září" plus the pill
 * need 228), and wrapping it under the date left the header one line taller
 * than its neighbours, visibly out of line. On today the row is kept as an
 * empty spacer of the pill's height rather than a label: "Dnes" above today's
 * date tells the student nothing, which is why the eyebrow was emptied in the
 * first place, but the title must not jump when the day changes. `null` is
 * "today" in the store, so the day re-derives itself at midnight rather than
 * pinning a date. Ink on a tint, not the lime: text-primary on a light surface
 * is 1.89:1.
 */
export function TodayPill({ selectedIso }: { selectedIso: string }) {
  const { t } = useTranslation();
  const setMobileSelectedDay = useAppStore((s) => s.setMobileSelectedDay);
  if (selectedIso === toIso(new Date())) {
    return <span aria-hidden="true" data-testid="today-pill-spacer" className="block h-5" />;
  }
  return (
    <button
      type="button"
      onClick={() => setMobileSelectedDay(null)}
      className="h-5 flex-shrink-0 self-start whitespace-nowrap rounded-full bg-base-content/10 px-2.5 text-xs font-semibold leading-5 text-base-content"
    >
      {t('common.today')}
    </button>
  );
}
