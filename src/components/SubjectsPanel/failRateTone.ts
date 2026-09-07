/**
 * The colour band for a subject's average fail rate.
 *
 * One function because the same three-band scale was written out three times —
 * in SubjectRow twice and in HardestUpcomingCard — and they drifted: two of
 * them still carried `text-warning-content`, which is #ffffff on a pale warning
 * tint, measured at 1.15:1 in the light theme. The pill was unreadable on the
 * exact screens the scale exists to warn about.
 *
 * The tint carries the severity; the digits are set in ink. Semantic colours do
 * not survive as 10px text: `text-error` on `bg-error/10` measured 3.18-3.29:1,
 * and #ef4444 is only 3.90:1 even at full strength on base-100, so no opacity
 * step rescues it at this size.
 */
export function failRateTone(rate: number): string {
  if (rate >= 25) return 'bg-error/12 text-[var(--tone-error)]';
  if (rate >= 20) return 'bg-warning/15 text-[var(--tone-warning)]';
  return 'bg-base-content/5 text-base-content/70';
}

/** Hover variant of the same band, for the pills that are clickable. */
export function failRateToneHover(rate: number): string {
  if (rate >= 25) return 'hover:bg-error/20';
  if (rate >= 20) return 'hover:bg-warning/25';
  return 'hover:bg-base-content/10';
}
