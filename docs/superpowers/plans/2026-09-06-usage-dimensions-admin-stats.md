# Usage Dimensions and Admin Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The anonymous daily usage event carries faculty and platform, and the two reis_admin accounts see counts of active installs by day, faculty and platform in the admin console, on desktop and on the phone.

**Architecture:** An additive migration adds two nullable columns to `daily_active_usage` and re-creates `track_daily_usage` with two optional parameters. A `usage_stats(p_days)` SECURITY DEFINER RPC checks `get_my_role() = 'reis_admin'` inside and returns only aggregated counts, suppressing groups under five. The client passes faculty (store `facultyId`) and platform (from `getPlatform().kind`, split into ios/android for Capacitor). A `createAdminStatsSlice` loads the stats when the admin opens the Statistics tab; an SVG panel renders them.

**Tech Stack:** Postgres, Supabase RPC via `supabase` (anon) and `adminAuthClient` (admin), Zustand, zod, React, DaisyUI, vitest.

Spec: `docs/superpowers/specs/2026-09-06-housing-board-design.md`, Parts A and C.

## Global Constraints

- Same iron rules as the housing plan: no `localStorage`, no `useEffect` fetching, DaisyUI only, state in slices, files under 200 lines, direct imports, test first.
- Counts are of **installs, not people**; every surface that shows a number says so once.
- No install id, no row, and no group under five installs ever leaves `usage_stats`.
- Privacy text changes in the same task as the client change, before the client change is committed.
- `src/api/feedback.ts` is already in `SUPABASE_CALLERS`; no new anon caller is added. `src/api/usageStats.ts` uses `adminAuthClient`, which the guard does not match.

---

### Task 1: Migration — dimensions and the stats RPC

**Files:**
- Create: `supabase/migrations/20260907130000_usage_dimensions.sql`
- Create: `supabase/tests/usage_stats.test.sql`

**Interfaces:**
- Produces `track_daily_usage(p_student_id text, p_faculty text default null, p_platform text default null)` (anon, authenticated).
- Produces `usage_stats(p_days int)` → `json` shaped `{ "today": int, "d7": int, "d30": int, "by_faculty": [{"key": text, "installs": int}], "by_platform": [{"key": text, "installs": int}], "weekly": [{"week_start": date, "installs": int}] }`, where `installs` is `-1` when the true count is 1 to 4 (suppressed). Callable by `authenticated`; raises `forbidden` unless the caller holds `reis_admin`.

- [ ] **Step 1: Capture the current function body before replacing it**

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -c "select pg_get_functiondef('public.track_daily_usage(text)'::regprocedure);"
```
Read the output. The migration below assumes the body is an upsert on `(student_id, usage_date)`. If the existing body does anything else (a second table, a counter), keep that logic inside the new body verbatim.

- [ ] **Step 2: Failing SQL assertions**

`supabase/tests/usage_stats.test.sql`:

```sql
begin;

-- old one-argument call still works (released clients)
do $$ begin
  set local role anon;
  perform public.track_daily_usage('11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

-- new call records faculty and platform
do $$
declare v_f text; v_p text;
begin
  set local role anon;
  perform public.track_daily_usage('22222222-2222-2222-2222-222222222222', 'PEF', 'ios');
  reset role;
  select faculty, platform into v_f, v_p from public.daily_active_usage
   where student_id = '22222222-2222-2222-2222-222222222222' and usage_date = current_date;
  if v_f <> 'PEF' or v_p <> 'ios' then raise exception 'dimensions not stored: % %', v_f, v_p; end if;
end $$;

-- an unknown platform is refused, the row is still counted
do $$
declare v_p text;
begin
  set local role anon;
  perform public.track_daily_usage('33333333-3333-3333-3333-333333333333', null, 'toaster');
  reset role;
  select platform into v_p from public.daily_active_usage
   where student_id = '33333333-3333-3333-3333-333333333333' and usage_date = current_date;
  if v_p is not null then raise exception 'invalid platform stored'; end if;
end $$;

-- usage_stats refuses anyone who is not reis_admin
do $$ begin
  set local role authenticated;
  begin
    perform public.usage_stats(30);
    raise exception 'usage_stats answered a non-admin';
  exception when others then
    if sqlerrm <> 'forbidden' then raise; end if;
  end;
  reset role;
end $$;

-- usage_stats suppresses groups under five (run as table owner; role check bypassed via a test-only flag)
do $$
declare v json; i int;
begin
  for i in 1..3 loop
    perform public.track_daily_usage(gen_random_uuid()::text, 'LDF', 'web');
  end loop;
  for i in 1..6 loop
    perform public.track_daily_usage(gen_random_uuid()::text, 'AF', 'extension');
  end loop;
  v := public.usage_stats_unchecked(30);
  if (select (e->>'installs')::int from json_array_elements(v->'by_faculty') e where e->>'key' = 'LDF') <> -1
    then raise exception 'small faculty group not suppressed'; end if;
  if (select (e->>'installs')::int from json_array_elements(v->'by_faculty') e where e->>'key' = 'AF') < 6
    then raise exception 'large faculty group miscounted'; end if;
end $$;

rollback;
```

- [ ] **Step 3: Run to see it fail**

```bash
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/usage_stats.test.sql
```
Expected: `ERROR: function public.track_daily_usage(unknown, unknown, unknown) does not exist`.

- [ ] **Step 4: Migration**

`supabase/migrations/20260907130000_usage_dimensions.sql`:

```sql
-- Faculty and platform on the anonymous daily usage event, and an admin-only
-- aggregate. Seven faculties times four platforms is a coarse grouping of
-- thousands of installs; the row still carries only the random install id.
-- Nothing about the person is added. Counts are of INSTALLS, not people.

alter table public.daily_active_usage
  add column if not exists faculty  text check (faculty is null or char_length(faculty) <= 16),
  add column if not exists platform text check (platform is null or platform in ('extension','ios','android','web'));

-- One function with defaults, so the old one-argument call keeps working and
-- PostgREST has no overload to disambiguate. Drop the old signature first.
drop function if exists public.track_daily_usage(text);

create or replace function public.track_daily_usage(
  p_student_id text,
  p_faculty text default null,
  p_platform text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  v_faculty  text := nullif(left(btrim(coalesce(p_faculty, '')), 16), '');
begin
  insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
  values (p_student_id, current_date, v_faculty, v_platform)
  on conflict (student_id, usage_date) do update
    set faculty  = coalesce(excluded.faculty,  public.daily_active_usage.faculty),
        platform = coalesce(excluded.platform, public.daily_active_usage.platform);
end $$;
grant execute on function public.track_daily_usage(text, text, text) to anon, authenticated;

-- The aggregate. Groups of 1-4 installs are reported as -1 ("under 5") so a
-- tiny faculty on a rare platform can never be narrowed to a person.
create or replace function public.usage_stats_unchecked(p_days int)
returns json
language sql stable security definer set search_path = public as $$
  with win as (
    select * from public.daily_active_usage
     where usage_date >= current_date - greatest(1, least(p_days, 365)) + 1
  ),
  supp as (
    select key, count(distinct student_id) as n from (
      select coalesce(faculty, 'unknown') as key, student_id from win
    ) s group by key
  ),
  plat as (
    select key, count(distinct student_id) as n from (
      select coalesce(platform, 'unknown') as key, student_id from win
    ) s group by key
  ),
  weeks as (
    select date_trunc('week', usage_date)::date as week_start, count(distinct student_id) as n
      from public.daily_active_usage
     where usage_date >= current_date - 12 * 7
     group by 1 order by 1
  )
  select json_build_object(
    'today', (select count(distinct student_id) from public.daily_active_usage where usage_date = current_date),
    'd7',    (select count(distinct student_id) from public.daily_active_usage where usage_date >= current_date - 6),
    'd30',   (select count(distinct student_id) from public.daily_active_usage where usage_date >= current_date - 29),
    'by_faculty',  coalesce((select json_agg(json_build_object('key', key, 'installs', case when n < 5 then -1 else n end) order by n desc) from supp), '[]'::json),
    'by_platform', coalesce((select json_agg(json_build_object('key', key, 'installs', case when n < 5 then -1 else n end) order by n desc) from plat), '[]'::json),
    'weekly',      coalesce((select json_agg(json_build_object('week_start', week_start, 'installs', case when n < 5 then -1 else n end) order by week_start) from weeks), '[]'::json)
  );
$$;
revoke all on function public.usage_stats_unchecked(int) from public, anon, authenticated;

create or replace function public.usage_stats(p_days int)
returns json
language plpgsql stable security definer set search_path = public as $$
begin
  if coalesce(public.get_my_role(), '') <> 'reis_admin' then
    raise exception 'forbidden';
  end if;
  return public.usage_stats_unchecked(p_days);
end $$;
revoke all on function public.usage_stats(int) from public, anon;
grant execute on function public.usage_stats(int) to authenticated;
```

- [ ] **Step 5: Apply and re-run**

```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/usage_stats.test.sql
```
Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260907130000_usage_dimensions.sql supabase/tests/usage_stats.test.sql
git commit -m "feat(db): faculty and platform on daily usage; reis_admin-only usage_stats aggregate

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Client sends faculty and platform; privacy sentence

**Files:**
- Create: `src/utils/usagePlatform.ts`, `src/utils/__tests__/usagePlatform.test.ts`
- Modify: `src/api/feedback.ts` (`trackDailyUsage`, line 46)
- Modify: `src/api/__tests__/feedback.test.ts` (create if absent)
- Modify: `PRIVACY.md` (Daily Usage bullet, line 29), `docs/privacy-policy-app.md` (item 1)

**Interfaces:**
- Produces `usagePlatform(kind: 'extension' | 'capacitor' | 'web', native: () => 'ios' | 'android' | string): 'extension' | 'ios' | 'android' | 'web'`.

- [ ] **Step 1: Failing platform test**

`src/utils/__tests__/usagePlatform.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { usagePlatform } from '../usagePlatform';

describe('usagePlatform', () => {
  it('passes extension and web through', () => {
    expect(usagePlatform('extension', () => 'web')).toBe('extension');
    expect(usagePlatform('web', () => 'web')).toBe('web');
  });
  it('splits capacitor into ios and android, anything else is android', () => {
    expect(usagePlatform('capacitor', () => 'ios')).toBe('ios');
    expect(usagePlatform('capacitor', () => 'android')).toBe('android');
    expect(usagePlatform('capacitor', () => 'web')).toBe('android');
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/utils/__tests__/usagePlatform.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/utils/usagePlatform.ts`:

```ts
export type UsagePlatform = 'extension' | 'ios' | 'android' | 'web';

/**
 * A group label for the daily usage event, never the user agent. Capacitor is
 * split with Capacitor.getPlatform(), passed in so this stays a pure function.
 */
export function usagePlatform(kind: 'extension' | 'capacitor' | 'web', native: () => string): UsagePlatform {
  if (kind === 'capacitor') return native() === 'ios' ? 'ios' : 'android';
  return kind;
}
```

- [ ] **Step 4: Failing feedback test**

Add to (or create) `src/api/__tests__/feedback.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn(async () => ({ error: null }));
vi.mock('../../services/spolky/supabaseClient', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => false }));
vi.mock('../../services/identity/installId', () => ({ getInstallId: async () => 'install-1' }));
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind: 'extension' }) }));
vi.mock('../../store/useAppStore', () => ({ useAppStore: { getState: () => ({ facultyId: 'PEF' }) } }));
import { trackDailyUsage } from '../feedback';

it('sends the install id with faculty and platform group labels', async () => {
  await trackDailyUsage();
  expect(rpc).toHaveBeenCalledWith('track_daily_usage', { p_student_id: 'install-1', p_faculty: 'PEF', p_platform: 'extension' });
});
```

- [ ] **Step 5: Implement in feedback.ts**

Replace `trackDailyUsage`:

```ts
import { getPlatform } from '../platform';
import { useAppStore } from '../store/useAppStore';
import { usagePlatform } from '../utils/usagePlatform';
import { Capacitor } from '@capacitor/core';

/**
 * Faculty and platform are GROUP labels (seven faculties, four platforms) on
 * the same random install id — a count, not a record. Disclosed in PRIVACY.md.
 */
export async function trackDailyUsage(): Promise<void> {
  if (isDemoMode()) return;
  const faculty = useAppStore.getState().facultyId ?? null;
  const platform = usagePlatform(getPlatform().kind, () => Capacitor.getPlatform());
  const { error } = await supabase.rpc('track_daily_usage', {
    p_student_id: await getInstallId(),
    p_faculty: faculty,
    p_platform: platform,
  });
  if (error) return;
}
```
If importing `useAppStore` into `src/api/feedback.ts` creates an import cycle (vitest will say so), read `facultyId` via `getUserParams()` from `src/utils/userParams.ts` instead (`(await getUserParams())?.facultyId ?? null`) and adjust the mock in Step 4 accordingly.

- [ ] **Step 6: Privacy text**

`PRIVACY.md`, Daily Usage bullet: append the sentence
`Since September 2026 the event also carries two group labels: your faculty and the platform (extension, iOS, Android or web). These describe a group of thousands of installs, not you; nothing else about the event changed.`
`docs/privacy-policy-app.md` item 1: append `plus faculty and platform as group labels.`

- [ ] **Step 7: Run tests, guard, typecheck**

```bash
npx vitest run src/utils/__tests__/usagePlatform.test.ts src/api/__tests__/feedback.test.ts src/test/guards && npm run typecheck
```
Expected: PASS, clean. Update the `feedback.ts` comment in `SUPABASE_CALLERS` to mention the two group labels.

- [ ] **Step 8: Commit**

```bash
git add src/utils/usagePlatform.ts src/utils/__tests__/usagePlatform.test.ts src/api/feedback.ts src/api/__tests__/feedback.test.ts PRIVACY.md docs/privacy-policy-app.md src/test/guards/noStudentDataLeaves.test.ts
git commit -m "feat(usage): faculty and platform group labels on the anonymous daily count

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Admin stats API and slice

**Files:**
- Create: `src/api/usageStats.ts`, `src/api/__tests__/usageStats.test.ts`
- Create: `src/store/slices/createAdminStatsSlice.ts`
- Modify: `src/store/types.ts`, `src/store/useAppStore.ts`

**Interfaces:**
- Produces:
  ```ts
  interface UsageGroup { key: string; installs: number } // installs -1 = under 5
  interface UsageStats { today: number; d7: number; d30: number; byFaculty: UsageGroup[]; byPlatform: UsageGroup[]; weekly: { weekStart: string; installs: number }[] }
  fetchUsageStats(days: number): Promise<UsageStats | null>
  ```
  store: `adminStats: UsageStats | null; adminStatsLoading: boolean; loadAdminStats(): Promise<void>`.

- [ ] **Step 1: Failing API test**

`src/api/__tests__/usageStats.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
const rpc = vi.fn();
vi.mock('@/services/admin/authClient', () => ({ adminAuthClient: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));
import { fetchUsageStats } from '../usageStats';

it('maps the json to camelCase and keeps -1 as the suppression marker', async () => {
  rpc.mockResolvedValue({ data: { today: 12, d7: 40, d30: 90, by_faculty: [{ key: 'PEF', installs: 50 }, { key: 'LDF', installs: -1 }], by_platform: [{ key: 'extension', installs: 70 }], weekly: [{ week_start: '2026-08-31', installs: 40 }] }, error: null });
  expect(await fetchUsageStats(30)).toEqual({ today: 12, d7: 40, d30: 90, byFaculty: [{ key: 'PEF', installs: 50 }, { key: 'LDF', installs: -1 }], byPlatform: [{ key: 'extension', installs: 70 }], weekly: [{ weekStart: '2026-08-31', installs: 40 }] });
  expect(rpc).toHaveBeenCalledWith('usage_stats', { p_days: 30 });
});

it('returns null on error or malformed json', async () => {
  rpc.mockResolvedValue({ data: null, error: { message: 'forbidden' } });
  expect(await fetchUsageStats(30)).toBeNull();
  rpc.mockResolvedValue({ data: { nope: 1 }, error: null });
  expect(await fetchUsageStats(30)).toBeNull();
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/api/__tests__/usageStats.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement API**

`src/api/usageStats.ts`:

```ts
import { z } from 'zod';
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

const Group = z.object({ key: z.string(), installs: z.number() });
const Schema = z.object({
  today: z.number(), d7: z.number(), d30: z.number(),
  by_faculty: z.array(Group), by_platform: z.array(Group),
  weekly: z.array(z.object({ week_start: z.string(), installs: z.number() })),
});

export interface UsageGroup { key: string; installs: number }
export interface UsageStats {
  today: number; d7: number; d30: number;
  byFaculty: UsageGroup[]; byPlatform: UsageGroup[];
  weekly: { weekStart: string; installs: number }[];
}

/** Counts of installs, never people; -1 means "under 5" and is rendered as such. */
export async function fetchUsageStats(days: number): Promise<UsageStats | null> {
  if (DEV_SOCIETY) return { today: 0, d7: 0, d30: 0, byFaculty: [], byPlatform: [], weekly: [] };
  const { data, error } = await adminAuthClient.rpc('usage_stats', { p_days: days });
  if (error) { logError('Api.fetchUsageStats', error); return null; }
  const parsed = Schema.safeParse(data);
  if (!parsed.success) { logError('Api.fetchUsageStats', new Error('malformed usage_stats')); return null; }
  const d = parsed.data;
  return {
    today: d.today, d7: d.d7, d30: d.d30, byFaculty: d.by_faculty, byPlatform: d.by_platform,
    weekly: d.weekly.map((w) => ({ weekStart: w.week_start, installs: w.installs })),
  };
}
```

- [ ] **Step 4: Slice**

`src/store/slices/createAdminStatsSlice.ts`:

```ts
import type { AppSlice } from '../types';
import { fetchUsageStats, type UsageStats } from '../../api/usageStats';

export interface AdminStatsSlice {
  adminStats: UsageStats | null;
  adminStatsLoading: boolean;
  loadAdminStats: () => Promise<void>;
}

export const createAdminStatsSlice: AppSlice<AdminStatsSlice> = (set) => ({
  adminStats: null,
  adminStatsLoading: false,
  loadAdminStats: async () => {
    set({ adminStatsLoading: true });
    const stats = await fetchUsageStats(30);
    set({ adminStatsLoading: false, ...(stats ? { adminStats: stats } : {}) });
  },
});
```
Wire into `types.ts` (`import('./slices/createAdminStatsSlice').AdminStatsSlice &`) and `useAppStore.ts`.

- [ ] **Step 5: Run and commit**

```bash
npx vitest run src/api/__tests__/usageStats.test.ts && npm run typecheck
git add src/api/usageStats.ts src/api/__tests__/usageStats.test.ts src/store/slices/createAdminStatsSlice.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(admin): usage stats client and slice

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Statistics panel in both consoles

**Files:**
- Create: `src/components/AdminConsole/StatsBars.tsx`
- Create: `src/components/AdminConsole/AdminStatsPanel.tsx`
- Create: `src/components/AdminConsole/__tests__/AdminStatsPanel.test.tsx`
- Modify: `src/components/AdminConsole/MobileAdminConsole.tsx`, `src/components/AdminConsole/AdminConsole.tsx`
- Modify: `src/i18n/locales/cs.json`, `en.json` (`admin.statsTab`, `admin.stats.*`)

**Interfaces:**
- Consumes: `adminStats`, `loadAdminStats` (Task 3); `adminRole`.
- Produces: `AdminStatsPanel()`, `StatsBars({ groups, labelFor })`.

- [ ] **Step 1: Strings**

cs.json `admin`: `"statsTab": "Statistiky"`, and
```json
"stats": {
  "today": "Dnes", "d7": "7 dní", "d30": "30 dní",
  "byFaculty": "Podle fakulty (30 dní)", "byPlatform": "Podle platformy (30 dní)", "weekly": "Týdně aktivní instalace (12 týdnů)",
  "installsNote": "Počítáme instalace, ne lidi: student s telefonem i notebookem je dvakrát.",
  "under5": "méně než 5", "unknown": "neznámo", "loadFailed": "Statistiky se nepodařilo načíst."
}
```
en.json: `"statsTab": "Statistics"`, `stats`: `Today`, `7 days`, `30 days`, `By faculty (30 days)`, `By platform (30 days)`, `Weekly active installs (12 weeks)`, `We count installs, not people: a student on a phone and a laptop counts twice.`, `under 5`, `unknown`, `Could not load statistics.`

- [ ] **Step 2: Failing panel test**

`src/components/AdminConsole/__tests__/AdminStatsPanel.test.tsx`:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { AdminStatsPanel } from '../AdminStatsPanel';

describe('AdminStatsPanel', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz', adminStatsLoading: false,
      adminStats: { today: 12, d7: 40, d30: 90, byFaculty: [{ key: 'PEF', installs: 50 }, { key: 'LDF', installs: -1 }], byPlatform: [{ key: 'extension', installs: 70 }], weekly: [{ weekStart: '2026-08-31', installs: 40 }] },
    } as never);
  });

  it('shows the three totals, renders suppressed groups as "under 5", and says it counts installs', () => {
    render(<AdminStatsPanel />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('méně než 5')).toBeInTheDocument();
    expect(screen.getByText(/Počítáme instalace, ne lidi/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to see it fail**

```bash
npx vitest run src/components/AdminConsole/__tests__/AdminStatsPanel.test.tsx
```
Expected: FAIL, module not found.

- [ ] **Step 4: StatsBars**

`src/components/AdminConsole/StatsBars.tsx`:

```tsx
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
```

- [ ] **Step 5: AdminStatsPanel**

`src/components/AdminConsole/AdminStatsPanel.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { StatsBars } from './StatsBars';

export function AdminStatsPanel() {
  const { t } = useTranslation();
  const stats = useAppStore((s) => s.adminStats);
  const loading = useAppStore((s) => s.adminStatsLoading);
  const reload = useAppStore((s) => s.loadAdminStats);
  const under5 = t('admin.stats.under5');
  const label = (k: string) => (k === 'unknown' ? t('admin.stats.unknown') : k);

  if (!stats && !loading) return <div className="alert alert-warning m-2 text-sm">{t('admin.stats.loadFailed')}</div>;
  if (!stats) return <span className="loading loading-dots loading-sm m-4" />;

  const weeklyMax = Math.max(1, ...stats.weekly.map((w) => w.installs));
  return (
    <div className="flex flex-col gap-4 p-3">
      <div className="stats stats-horizontal shadow-sm">
        {([['today', stats.today], ['d7', stats.d7], ['d30', stats.d30]] as const).map(([k, v]) => (
          <div key={k} className="stat p-3">
            <div className="stat-title text-xs">{t(`admin.stats.${k}`)}</div>
            <div className="stat-value text-2xl">{v}</div>
          </div>
        ))}
      </div>
      <p className="text-xs opacity-70">{t('admin.stats.installsNote')}</p>
      <section><h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byFaculty')}</h4><StatsBars groups={stats.byFaculty} labelFor={label} under5={under5} /></section>
      <section><h4 className="mb-1 text-sm font-semibold">{t('admin.stats.byPlatform')}</h4><StatsBars groups={stats.byPlatform} labelFor={label} under5={under5} /></section>
      <section>
        <h4 className="mb-1 text-sm font-semibold">{t('admin.stats.weekly')}</h4>
        <svg viewBox="0 0 120 40" className="h-24 w-full text-primary" role="img" aria-label={t('admin.stats.weekly')}>
          {stats.weekly.map((w, i) => {
            const h = w.installs < 0 ? 2 : Math.max(1, Math.round((w.installs / weeklyMax) * 36));
            return <rect key={w.weekStart} x={i * 10 + 1} y={40 - h} width="8" height={h} rx="1" fill="currentColor" opacity={w.installs < 0 ? 0.3 : 1} />;
          })}
        </svg>
      </section>
      <button type="button" className="btn btn-ghost btn-xs self-end" onClick={() => void reload()} disabled={loading}>↻</button>
    </div>
  );
}
```

- [ ] **Step 6: Tabs, reis_admin only, loading on tab press**

`MobileAdminConsole.tsx`: add `'stats'` to `Tab`; `const loadAdminStats = useAppStore((s) => s.loadAdminStats);`; `const showStats = !placing && isReisAdmin && tab === 'stats';`; tab button `{isReisAdmin && tabBtn('stats', t('admin.statsTab'))}`; in `tabBtn`'s onClick: `if (key === 'stats') void loadAdminStats();`; add `showStats` to the hidden condition; render `{showStats && <div className="h-full overflow-y-auto bg-base-100"><AdminStatsPanel /></div>}`.

`AdminConsole.tsx`: add `'stats'` to the `pane` union, a guarded tab button with `onClick={() => { void loadAdminStats(); setPane('stats'); }}`, and render `<AdminStatsPanel />` for `pane === 'stats'`.

- [ ] **Step 7: Run, verify, commit**

```bash
npx vitest run src/components/AdminConsole && npm run typecheck && npm run lint
```
Expected: PASS, clean. Then invoke the `verify-ui` skill on the stats panel in `MobileAdminConsole` at 320, 390, 430, both themes.

```bash
git add src/components/AdminConsole src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(admin): reis_admin statistics panel — installs by day, faculty and platform

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Apply and verify against the linked project

- [ ] **Step 1:** `npm run test:run && npm run typecheck && npm run lint` — all green.
- [ ] **Step 2:** `supabase db push` — migration applied.
- [ ] **Step 3:** `npm run dev:web:admin`, open Statistics; the numbers load only for the reis_admin login. Sign in as a society (`REIS_ADMIN_SOCIETY=esn npm run dev:web:admin`) and confirm the tab is absent.
- [ ] **Step 4:** Update the published gist with the two privacy sentences from Task 2 (manual, Dominik).
