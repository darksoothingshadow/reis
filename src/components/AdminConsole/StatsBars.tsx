import type { UsageGroup } from '../../api/usageStats';

// Plain inline SVG, DaisyUI colour tokens via currentColor; no chart library.
export function StatsBars({ groups, labelFor, under5 }: { groups: UsageGroup[]; labelFor: (key: string) => string; under5: string }) {
  const max = Math.max(1, ...groups.map((g) => g.installs));
  return (
    <ul className="flex flex-col gap-1">
      {groups.map((g) => {
        const suppressed = g.installs < 0;
        const w = suppressed ? 4 : Math.max(2, Math.round((g.installs / max) * 100));
        return (
          <li key={g.key} className="grid grid-cols-[6rem_1fr_4rem] items-center gap-2 text-sm">
            <span className="truncate">{labelFor(g.key)}</span>
            <svg viewBox="0 0 100 8" preserveAspectRatio="none" className="h-2 w-full text-primary" aria-hidden>
              <rect x="0" y="0" width={w} height="8" rx="2" fill="currentColor" opacity={suppressed ? 0.3 : 1} />
            </svg>
            <span className="text-right tabular-nums">{suppressed ? under5 : g.installs}</span>
          </li>
        );
      })}
    </ul>
  );
}
