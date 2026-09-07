import type { UsageGroup } from '../../api/usageStats';

// Plain inline SVG, DaisyUI colour tokens; no chart library.
export function StatsBars({
  groups,
  labelFor,
  under5,
}: {
  groups: UsageGroup[];
  labelFor: (key: string) => string;
  under5: string;
}) {
  const max = Math.max(1, ...groups.map((g) => g.installs));
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((g) => {
        const suppressed = g.installs < 0;
        const w = suppressed ? 4 : Math.max(2, Math.round((g.installs / max) * 100));
        // Suppressed groups used to be the same green rect at 30% opacity —
        // measured (verify-ui, by hand: the automated probe skips SVG fills)
        // at 1.77:1 in the dark theme and 1.27:1 in light, both far under the
        // 3:1 WCAG non-text-contrast floor for a graphical indicator, and
        // light theme cannot clear 3:1 with *any* opacity of this green (it
        // caps at 2.29:1 fully opaque). A neutral base-content fill at 50%
        // clears both: 4.48:1 dark, 3.39:1 light.
        return (
          <li key={g.key} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-sm">
            <span className="truncate">{labelFor(g.key)}</span>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full" aria-hidden>
              <rect
                x="0"
                y="0"
                width={w}
                height="8"
                rx="2"
                className={suppressed ? 'fill-base-content/50' : 'fill-primary'}
              />
            </svg>
            <span className="text-right tabular-nums">{suppressed ? under5 : g.installs}</span>
          </li>
        );
      })}
    </ul>
  );
}
