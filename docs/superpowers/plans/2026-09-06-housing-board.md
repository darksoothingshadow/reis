# Housing Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A student-to-student housing board inside reIS (extension and app) where a Mendelu student posts a room they offer or a room they need, tied to their IS login for one-tap verification, expiring 14 days after posting, opened by a reIS society notification.

**Architecture:** One Supabase table behind deny-all RLS and three SECURITY DEFINER RPCs (list, submit, close) called with the publishable key, plus reis_admin-only policies for moderation through the signed-in admin client. A `createHousingSlice` owns the post list and this install's own post ids (kept in IndexedDB, like RSVPs). One shared `HousingBoard` component renders inside a mobile sheet and a desktop view. A society post whose `url` is the token `reis://housing` opens the board instead of a browser tab.

**Tech Stack:** React 18, Zustand slices, zod, Supabase JS (existing `supabase` anon client and `adminAuthClient`), DaisyUI classes, vitest + Testing Library (happy-dom), Postgres migrations under `supabase/migrations/`.

Spec: `docs/superpowers/specs/2026-09-06-housing-board-design.md`.

## Global Constraints

- **NO `localStorage`/`sessionStorage`** — use `IndexedDBService` (`src/services/storage`).
- **NO `useEffect` for data fetching** — fetch in slice actions triggered by user actions or mount handlers that call slice actions.
- **NO custom CSS** — DaisyUI semantic classes only (`btn-primary`, `bg-base-200`, `tabs`, `card`).
- **All state in Zustand slices**, slice pattern `src/store/slices/create*Slice.ts`, composed in `src/store/useAppStore.ts`, typed in `src/store/types.ts`.
- **Max 200 lines per file** — split proactively.
- **Direct imports only** — no barrel re-exports.
- **Test first** — failing test before implementation, every task.
- Language codes are `'cz' | 'en'`; locale files are `src/i18n/locales/cs.json` and `en.json`; UI strings through `useTranslation().t(key)`.
- Privacy order: `PRIVACY.md` and `docs/privacy-policy-app.md` change **before** any file that sends data; `src/api/housing.ts` is added to `SUPABASE_CALLERS` in `src/test/guards/noStudentDataLeaves.test.ts` with a written justification. Never name a variable `studentId`, `fullName`, `userEmail` or `uic` in `src/api/housing.ts`; the poster's identifiers are `isLogin` and `personId`.
- Migrations are applied with `supabase db push` from the repo root (project is linked; see `supabase/.temp`). Test SQL locally with `supabase start` and `psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')"`.
- Commit after every task with a conventional-commit message ending in `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Privacy text first

**Files:**
- Modify: `PRIVACY.md` (section listing writes to Supabase, around line 54)
- Modify: `docs/privacy-policy-app.md` (the "What reIS sends" list)

**Interfaces:**
- Produces: the disclosed field list every later task must match: kind, room type, district, price, free from, free until, note, contact, IS login, IS person id, random install id; visible to every reIS user and the two admins; deleted 14 days after posting or when closed.

- [ ] **Step 1: Add the housing paragraph to PRIVACY.md**

Insert after the Supabase bullet (the one starting `2. **Supabase**`):

```markdown
- **Housing board (optional, you type it)**: If you publish a post on the housing board ("Bydlení"), reIS stores on its Supabase backend exactly what you enter — offer or request, room type, district, price, free-from and free-until dates, a note, and the contact you choose to give — together with your IS login and IS person id, which the app attaches after you tick the consent box. Every reIS user can see the post, including the login and the contact; that is what makes the board trustworthy, because any reader can check the poster in IS. The two reIS administrators can hide or delete a post. A post is deleted 14 days after you publish it, or earlier when you close it from "My posts". Nothing on the board is collected automatically, and the board records nothing about who reads it. A random per-install id is stored with the post only so your own device can close it.
```

- [ ] **Step 2: Add the matching item to docs/privacy-policy-app.md**

Append to the numbered "What reIS sends" list:

```markdown
4. **Housing board posts you publish** — the fields you fill in (offer/request, room type, district, price, dates, note, contact) plus your IS login and IS person id, attached only after you tick the consent box. Shown to every reIS user for 14 days or until you close the post. Two administrators can hide or delete posts. Nothing about who reads the board is recorded.
```

- [ ] **Step 3: Note the gist**

The published policy gist is updated by hand by Dominik with the same paragraph. Add a line to the commit body: `Gist to be updated by hand before release.`

- [ ] **Step 4: Commit**

```bash
git add PRIVACY.md docs/privacy-policy-app.md
git commit -m "docs(privacy): disclose the housing board before it exists

Gist to be updated by hand before release.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Database migration and SQL assertions

**Files:**
- Create: `supabase/migrations/20260907120000_housing_posts.sql`
- Create: `supabase/tests/housing_posts.test.sql`

**Interfaces:**
- Produces RPCs called by Task 3:
  - `list_housing_posts()` → rows `(id uuid, kind text, room_type text, district text, price_czk int, free_from date, free_until date, note text, contact text, is_login text, is_person_id text, created_at timestamptz, expires_at timestamptz)`
  - `submit_housing_post(p_kind text, p_room_type text, p_district text, p_price_czk int, p_free_from date, p_free_until date, p_note text, p_contact text, p_is_login text, p_is_person_id text, p_install_id uuid)` → `uuid` or `null` when refused
  - `close_housing_post(p_id uuid, p_install_id uuid)` → `boolean`
- Produces table `public.housing_posts` readable/updatable(`hidden_by_admin`)/deletable by `authenticated` sessions whose `public.get_my_role() = 'reis_admin'` (used by Task 10).

- [ ] **Step 1: Write the SQL assertions (they fail until the migration exists)**

`supabase/tests/housing_posts.test.sql`:

```sql
-- Run inside one transaction; every block raises on failure, so psql -v ON_ERROR_STOP=1 exits non-zero.
begin;

-- 1. anon cannot read the table directly
do $$ begin
  set local role anon;
  begin
    perform 1 from public.housing_posts;
    raise exception 'anon could select housing_posts directly';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

-- 2. submit works, returns an id, and the row is listed
do $$
declare v_install uuid := gen_random_uuid(); v_id uuid; v_count int;
begin
  set local role anon;
  v_id := public.submit_housing_post('offer','room_private','Královo Pole',7500,current_date,null,'Klidný pokoj','ja@example.com','xnovak','123456',v_install);
  if v_id is null then raise exception 'submit returned null'; end if;
  select count(*) into v_count from public.list_housing_posts() where id = v_id;
  if v_count <> 1 then raise exception 'listed % rows for the new id', v_count; end if;
  reset role;
end $$;

-- 3. a fourth live post per install is refused
do $$
declare v_install uuid := gen_random_uuid(); v_id uuid; i int;
begin
  set local role anon;
  for i in 1..3 loop
    v_id := public.submit_housing_post('request','bed_shared','Brno',null,current_date,null,'','tel 777','xtest','1',v_install);
    if v_id is null then raise exception 'post % refused too early', i; end if;
  end loop;
  v_id := public.submit_housing_post('request','bed_shared','Brno',null,current_date,null,'','tel 777','xtest','1',v_install);
  if v_id is not null then raise exception 'fourth live post was accepted'; end if;
  reset role;
end $$;

-- 4. invalid enum is refused, not raised
do $$
declare v_id uuid;
begin
  set local role anon;
  v_id := public.submit_housing_post('sell','room_private','Brno',null,current_date,null,'','x','x','1',gen_random_uuid());
  if v_id is not null then raise exception 'invalid kind accepted'; end if;
  reset role;
end $$;

-- 5. hidden and expired rows are not listed; close deletes only the owner's row
do $$
declare v_install uuid := gen_random_uuid(); v_other uuid := gen_random_uuid(); v_id uuid; v_count int; v_ok boolean;
begin
  set local role anon;
  v_id := public.submit_housing_post('offer','flat','Brno',12000,current_date,null,'','x','xhid','2',v_install);
  reset role;
  update public.housing_posts set hidden_by_admin = true where id = v_id;
  set local role anon;
  select count(*) into v_count from public.list_housing_posts() where id = v_id;
  if v_count <> 0 then raise exception 'hidden row listed'; end if;
  reset role;
  update public.housing_posts set hidden_by_admin = false, expires_at = now() - interval '1 minute' where id = v_id;
  set local role anon;
  select count(*) into v_count from public.list_housing_posts() where id = v_id;
  if v_count <> 0 then raise exception 'expired row listed'; end if;
  v_ok := public.close_housing_post(v_id, v_other);
  if v_ok then raise exception 'stranger closed a post'; end if;
  v_ok := public.close_housing_post(v_id, v_install);
  if not v_ok then raise exception 'owner could not close'; end if;
  reset role;
end $$;

-- 6. list_housing_posts never exposes install_id
do $$ begin
  if exists (
    select 1 from information_schema.routines r
    join information_schema.parameters p on p.specific_name = r.specific_name
    where r.routine_schema='public' and r.routine_name='list_housing_posts' and p.parameter_name='install_id'
  ) then raise exception 'list_housing_posts returns install_id'; end if;
end $$;

rollback;
```

- [ ] **Step 2: Run it against the local database to see it fail**

```bash
supabase start
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/housing_posts.test.sql
```
Expected: `ERROR:  relation "public.housing_posts" does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260907120000_housing_posts.sql`:

```sql
-- Housing board: students hand rooms to students.
--
-- Identity travels only with an action the student took on purpose: the
-- poster's IS login and IS person id are attached after an explicit consent
-- tick, shown to every reIS user (any reader can verify the poster in IS),
-- and deleted with the post 14 days after publishing or when the owner closes
-- it. Nothing about who READS the board is recorded. install_id is the same
-- random per-install UUID event_rsvps uses; it exists only so the device that
-- published a post can close it, and it is never returned by the list RPC.

create table public.housing_posts (
  id              uuid primary key default gen_random_uuid(),
  kind            text not null check (kind in ('offer','request')),
  room_type       text not null check (room_type in ('bed_shared','room_private','flat')),
  district        text not null check (char_length(district) between 1 and 60),
  price_czk       int  check (price_czk is null or price_czk between 0 and 100000),
  free_from       date not null,
  free_until      date check (free_until is null or free_until >= free_from),
  note            text not null default '' check (char_length(note) <= 500),
  contact         text not null check (char_length(contact) between 1 and 120),
  is_login        text not null check (char_length(is_login) between 1 and 40),
  is_person_id    text not null check (is_person_id ~ '^[0-9]{1,10}$'),
  install_id      uuid not null,
  hidden_by_admin boolean not null default false,
  created_at      timestamptz not null default now(),
  -- Fixed 14-day life from publishing. A room still open is re-posted.
  expires_at      timestamptz not null default now() + interval '14 days'
);

create index housing_posts_live_idx on public.housing_posts (expires_at)
  where hidden_by_admin = false;

alter table public.housing_posts enable row level security;
revoke all on table public.housing_posts from anon, authenticated;

-- Moderation runs under the signed-in admin client, gated by role like
-- suggestions. Only hidden_by_admin is grantable for update.
grant select, delete on table public.housing_posts to authenticated;
grant update (hidden_by_admin) on table public.housing_posts to authenticated;
create policy "Admin read housing_posts" on public.housing_posts
  for select to authenticated using (public.get_my_role() = 'reis_admin');
create policy "Admin hide housing_posts" on public.housing_posts
  for update to authenticated
  using (public.get_my_role() = 'reis_admin')
  with check (public.get_my_role() = 'reis_admin');
create policy "Admin delete housing_posts" on public.housing_posts
  for delete to authenticated using (public.get_my_role() = 'reis_admin');

-- Per-install flood guard: at most 5 submissions per hour, on top of the
-- 3-live-posts cap. Rows are swept after an hour; they carry no identity.
create table public.housing_rate_log (
  install_id uuid not null,
  created_at timestamptz not null default now()
);
create index housing_rate_log_install_idx on public.housing_rate_log (install_id, created_at);
alter table public.housing_rate_log enable row level security;
revoke all on table public.housing_rate_log from anon, authenticated;

create or replace function public.list_housing_posts()
returns table (
  id uuid, kind text, room_type text, district text, price_czk int,
  free_from date, free_until date, note text, contact text,
  is_login text, is_person_id text, created_at timestamptz, expires_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select id, kind, room_type, district, price_czk, free_from, free_until, note, contact,
         is_login, is_person_id, created_at, expires_at
  from public.housing_posts
  where hidden_by_admin = false and expires_at > now()
  order by created_at desc
  limit 300;
$$;
grant execute on function public.list_housing_posts() to anon, authenticated;

create or replace function public.submit_housing_post(
  p_kind text, p_room_type text, p_district text, p_price_czk int,
  p_free_from date, p_free_until date, p_note text, p_contact text,
  p_is_login text, p_is_person_id text, p_install_id uuid
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_live int; v_recent int; v_id uuid;
begin
  -- Serialise per install so check-then-insert cannot race.
  perform pg_advisory_xact_lock(hashtext(p_install_id::text));

  -- Opportunistic sweeps: expired posts really disappear, and the rate log
  -- forgets after an hour. Same approach as set_event_rsvp.
  delete from public.housing_posts where expires_at < now() - interval '1 day';
  delete from public.housing_rate_log where created_at < now() - interval '1 hour';

  select count(*) into v_live from public.housing_posts
   where install_id = p_install_id and expires_at > now();
  if v_live >= 3 then return null; end if;

  select count(*) into v_recent from public.housing_rate_log where install_id = p_install_id;
  if v_recent >= 5 then return null; end if;

  insert into public.housing_rate_log (install_id) values (p_install_id);
  insert into public.housing_posts
    (kind, room_type, district, price_czk, free_from, free_until, note, contact, is_login, is_person_id, install_id)
  values
    (p_kind, p_room_type, btrim(p_district), p_price_czk, p_free_from, p_free_until,
     coalesce(btrim(p_note), ''), btrim(p_contact), btrim(p_is_login), p_is_person_id, p_install_id)
  returning id into v_id;
  return v_id;
exception
  when check_violation or not_null_violation then return null;
end $$;
grant execute on function public.submit_housing_post(text,text,text,int,date,date,text,text,text,text,uuid) to anon, authenticated;

create or replace function public.close_housing_post(p_id uuid, p_install_id uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.housing_posts where id = p_id and install_id = p_install_id;
  return found;
end $$;
grant execute on function public.close_housing_post(uuid, uuid) to anon, authenticated;
```

- [ ] **Step 4: Apply locally and re-run the assertions**

```bash
supabase db reset
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -v ON_ERROR_STOP=1 -f supabase/tests/housing_posts.test.sql
```
Expected: `BEGIN`, six `DO`, `ROLLBACK`, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260907120000_housing_posts.sql supabase/tests/housing_posts.test.sql
git commit -m "feat(db): housing_posts table, list/submit/close RPCs, admin moderation policies

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Types, API client, guard allow-list

**Files:**
- Create: `src/types/housing.ts`
- Create: `src/api/housing.ts`
- Create: `src/api/__tests__/housing.test.ts`
- Modify: `src/test/guards/noStudentDataLeaves.test.ts` (`SUPABASE_CALLERS`, line 45)

**Interfaces:**
- Consumes: RPCs from Task 2; `getInstallId()` from `src/services/identity/installId.ts`; `isDemoMode()` from `src/errors/demoMode.ts`; `supabase` from `src/services/spolky/supabaseClient.ts`.
- Produces:
  - `HousingKind`, `HousingRoomType`, `HousingDraft`, `HousingPost`, `HOUSING_LIMITS` (types/housing.ts)
  - `fetchHousingPosts(): Promise<{ posts: HousingPost[]; ok: boolean }>`
  - `submitHousingPost(draft: HousingDraft, poster: { isLogin: string; personId: string }): Promise<string | null>`
  - `closeHousingPost(id: string): Promise<boolean>`

- [ ] **Step 1: Types**

`src/types/housing.ts`:

```ts
export type HousingKind = 'offer' | 'request';
export type HousingRoomType = 'bed_shared' | 'room_private' | 'flat';

export const HOUSING_KINDS: readonly HousingKind[] = ['offer', 'request'];
export const HOUSING_ROOM_TYPES: readonly HousingRoomType[] = ['bed_shared', 'room_private', 'flat'];
export const HOUSING_LIMITS = { district: 60, note: 500, contact: 120 } as const;

/** What the student types. Dates are ISO `YYYY-MM-DD`. */
export interface HousingDraft {
  kind: HousingKind;
  roomType: HousingRoomType;
  district: string;
  priceCzk: number | null;
  freeFrom: string;
  freeUntil: string | null;
  note: string;
  contact: string;
}

/** A live post as every reIS user sees it. */
export interface HousingPost extends HousingDraft {
  id: string;
  /** Poster's IS login, shown on the card. Attached after consent. */
  isLogin: string;
  /** Poster's IS person id, opens the person sheet. Attached after consent. */
  personId: string;
  createdAt: string;
  expiresAt: string;
}
```

- [ ] **Step 2: Failing tests**

`src/api/__tests__/housing.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('../../services/spolky/supabaseClient', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
vi.mock('../../errors/demoMode', () => ({ isDemoMode: () => false }));
vi.mock('../../services/identity/installId', () => ({ getInstallId: async () => 'install-1' }));

import { fetchHousingPosts, submitHousingPost, closeHousingPost } from '../housing';

const row = {
  id: 'p1', kind: 'offer', room_type: 'room_private', district: 'Královo Pole', price_czk: 7500,
  free_from: '2026-09-15', free_until: null, note: 'Klidný pokoj', contact: 'ja@example.com',
  is_login: 'xnovak', is_person_id: '123456', created_at: '2026-09-06T10:00:00Z', expires_at: '2026-09-20T10:00:00Z',
};

describe('housing api', () => {
  beforeEach(() => rpc.mockReset());

  it('maps rows to camelCase posts and drops malformed rows', async () => {
    rpc.mockResolvedValue({ data: [row, { id: 'bad' }], error: null });
    const res = await fetchHousingPosts();
    expect(rpc).toHaveBeenCalledWith('list_housing_posts');
    expect(res.ok).toBe(true);
    expect(res.posts).toEqual([{
      id: 'p1', kind: 'offer', roomType: 'room_private', district: 'Královo Pole', priceCzk: 7500,
      freeFrom: '2026-09-15', freeUntil: null, note: 'Klidný pokoj', contact: 'ja@example.com',
      isLogin: 'xnovak', personId: '123456', createdAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-20T10:00:00Z',
    }]);
  });

  it('reports a failed load as ok:false with no posts', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom' } });
    expect(await fetchHousingPosts()).toEqual({ posts: [], ok: false });
  });

  it('submits the draft with the poster identity and install id, returning the id', async () => {
    rpc.mockResolvedValue({ data: 'new-id', error: null });
    const id = await submitHousingPost(
      { kind: 'request', roomType: 'bed_shared', district: 'Brno', priceCzk: null, freeFrom: '2026-09-10', freeUntil: null, note: '', contact: 'tel 777' },
      { isLogin: 'xtest', personId: '42' }
    );
    expect(id).toBe('new-id');
    expect(rpc).toHaveBeenCalledWith('submit_housing_post', {
      p_kind: 'request', p_room_type: 'bed_shared', p_district: 'Brno', p_price_czk: null,
      p_free_from: '2026-09-10', p_free_until: null, p_note: '', p_contact: 'tel 777',
      p_is_login: 'xtest', p_is_person_id: '42', p_install_id: 'install-1',
    });
  });

  it('returns null when the server refuses (rate limit or validation)', async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const id = await submitHousingPost(
      { kind: 'offer', roomType: 'flat', district: 'Brno', priceCzk: 1, freeFrom: '2026-09-10', freeUntil: null, note: '', contact: 'x' },
      { isLogin: 'x', personId: '1' }
    );
    expect(id).toBeNull();
  });

  it('closes with the install id and reports the boolean', async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await closeHousingPost('p1')).toBe(true);
    expect(rpc).toHaveBeenCalledWith('close_housing_post', { p_id: 'p1', p_install_id: 'install-1' });
  });
});
```

- [ ] **Step 3: Run to see it fail**

```bash
npx vitest run src/api/__tests__/housing.test.ts
```
Expected: FAIL, `Cannot find module '../housing'`.

- [ ] **Step 4: Implement the API client**

`src/api/housing.ts`:

```ts
import { z } from 'zod';
import { supabase } from '../services/spolky/supabaseClient';
import { isDemoMode } from '../errors/demoMode';
import { logError } from '../utils/reportError';
import { getInstallId } from '../services/identity/installId';
import type { HousingDraft, HousingPost } from '../types/housing';

/**
 * The housing board is the second thing reIS sends that a student composed
 * (the first is the suggestion form). What leaves the device is exactly the
 * form the student filled in, plus their IS login and IS person id — attached
 * ONLY after the consent tick on the form, shown to every reIS user so a
 * reader can verify the poster in IS, and deleted with the post. Reads carry
 * no identity at all. The install id is the random per-install UUID from
 * services/identity; it lets this device close its own post and is never
 * returned by the list RPC.
 */
const RowSchema = z.object({
  id: z.string(),
  kind: z.enum(['offer', 'request']),
  room_type: z.enum(['bed_shared', 'room_private', 'flat']),
  district: z.string(),
  price_czk: z.number().nullable(),
  free_from: z.string(),
  free_until: z.string().nullable(),
  note: z.string(),
  contact: z.string(),
  is_login: z.string(),
  is_person_id: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});

function toPost(r: z.infer<typeof RowSchema>): HousingPost {
  return {
    id: r.id, kind: r.kind, roomType: r.room_type, district: r.district, priceCzk: r.price_czk,
    freeFrom: r.free_from, freeUntil: r.free_until, note: r.note, contact: r.contact,
    isLogin: r.is_login, personId: r.is_person_id, createdAt: r.created_at, expiresAt: r.expires_at,
  };
}

export async function fetchHousingPosts(): Promise<{ posts: HousingPost[]; ok: boolean }> {
  try {
    const { data, error } = await supabase.rpc('list_housing_posts');
    if (error) {
      logError('Api.fetchHousingPosts', new Error(error.message));
      return { posts: [], ok: false };
    }
    const posts: HousingPost[] = [];
    for (const row of (data ?? []) as unknown[]) {
      const parsed = RowSchema.safeParse(row);
      // A malformed row is dropped, not coerced: a card with "undefined" on it
      // is worse than one card fewer.
      if (parsed.success) posts.push(toPost(parsed.data));
    }
    return { posts, ok: true };
  } catch (err) {
    logError('Api.fetchHousingPosts', err);
    return { posts: [], ok: false };
  }
}

/** Returns the new post id, or null when the server refused (cap, flood, validation). */
export async function submitHousingPost(
  draft: HousingDraft,
  poster: { isLogin: string; personId: string }
): Promise<string | null> {
  if (isDemoMode()) return null;
  try {
    const { data, error } = await supabase.rpc('submit_housing_post', {
      p_kind: draft.kind,
      p_room_type: draft.roomType,
      p_district: draft.district,
      p_price_czk: draft.priceCzk,
      p_free_from: draft.freeFrom,
      p_free_until: draft.freeUntil,
      p_note: draft.note,
      p_contact: draft.contact,
      p_is_login: poster.isLogin,
      p_is_person_id: poster.personId,
      p_install_id: await getInstallId(),
    });
    if (error) {
      logError('Api.submitHousingPost', new Error(error.message));
      return null;
    }
    return typeof data === 'string' && data.length > 0 ? data : null;
  } catch (err) {
    logError('Api.submitHousingPost', err);
    return null;
  }
}

export async function closeHousingPost(id: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('close_housing_post', {
      p_id: id,
      p_install_id: await getInstallId(),
    });
    if (error) {
      logError('Api.closeHousingPost', new Error(error.message));
      return false;
    }
    return data === true;
  } catch (err) {
    logError('Api.closeHousingPost', err);
    return false;
  }
}
```

- [ ] **Step 5: Allow-list the file in the guard**

In `src/test/guards/noStudentDataLeaves.test.ts`, inside `SUPABASE_CALLERS`, after the `'src/api/suggestions.ts',` entry add:

```ts
  // Housing board. Sends the post the student composed plus their IS login
  // and IS person id — ONLY after the consent tick on the form, shown to every
  // reIS user so the poster can be verified in IS, deleted with the post after
  // 14 days. Reads take no identity. The install id is the random per-install
  // UUID, never anything derived from the student. Disclosed in PRIVACY.md
  // ("Housing board") and docs/privacy-policy-app.md item 4.
  'src/api/housing.ts',
```

- [ ] **Step 6: Run the tests**

```bash
npx vitest run src/api/__tests__/housing.test.ts src/test/guards/noStudentDataLeaves.test.ts
```
Expected: both PASS.

- [ ] **Step 7: Commit**

```bash
git add src/types/housing.ts src/api/housing.ts src/api/__tests__/housing.test.ts src/test/guards/noStudentDataLeaves.test.ts
git commit -m "feat(housing): types and Supabase client for the housing board

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Housing slice

**Files:**
- Create: `src/store/slices/createHousingSlice.ts`
- Create: `src/store/slices/__tests__/createHousingSlice.test.ts`
- Modify: `src/store/types.ts` (AppState intersection near line 632; `MobileSheet` union near line 470)
- Modify: `src/store/useAppStore.ts` (import + spread)

**Interfaces:**
- Consumes: Task 3 API; `getUserParams()` from `src/utils/userParams.ts` (fields `username`, `studentId`); `IndexedDBService`.
- Produces on the store:
  ```ts
  housingPosts: HousingPost[]; housingLoading: boolean; housingLoaded: boolean; housingMineIds: string[];
  housingOpenRequest: number;
  loadHousing(): Promise<void>;
  publishHousing(draft: HousingDraft): Promise<'ok' | 'refused' | 'failed'>;
  closeHousing(id: string): Promise<boolean>;
  openHousingBoard(): void;
  ```
- Produces sheet kind `{ kind: 'housing' }` in `MobileSheet`.

- [ ] **Step 1: Failing slice test**

`src/store/slices/__tests__/createHousingSlice.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const fetchHousingPosts = vi.fn();
const submitHousingPost = vi.fn();
const closeHousingPost = vi.fn();
vi.mock('../../../api/housing', () => ({
  fetchHousingPosts: (...a: unknown[]) => fetchHousingPosts(...a),
  submitHousingPost: (...a: unknown[]) => submitHousingPost(...a),
  closeHousingPost: (...a: unknown[]) => closeHousingPost(...a),
}));
vi.mock('../../../utils/userParams', () => ({
  getUserParams: async () => ({ username: 'xnovak', studentId: '123456' }),
}));
const idb = new Map<string, unknown>();
vi.mock('../../../services/storage', () => ({
  IndexedDBService: {
    get: vi.fn(async (_s: string, k: string) => idb.get(k)),
    set: vi.fn(async (_s: string, k: string, v: unknown) => void idb.set(k, v)),
  },
}));

import { createHousingSlice, type HousingSlice } from '../createHousingSlice';
import type { HousingDraft } from '../../../types/housing';

const draft: HousingDraft = {
  kind: 'offer', roomType: 'room_private', district: 'Brno', priceCzk: 7000,
  freeFrom: '2026-09-15', freeUntil: null, note: '', contact: 'ja@example.com',
};
const post = { ...draft, id: 'p1', isLogin: 'xnovak', personId: '123456', createdAt: 'c', expiresAt: 'e' };

describe('createHousingSlice', () => {
  let state: HousingSlice & { pushSheet: ReturnType<typeof vi.fn>; isPhoneLayout: boolean };
  let set: ReturnType<typeof vi.fn>;
  let get: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    idb.clear();
    fetchHousingPosts.mockReset().mockResolvedValue({ posts: [post], ok: true });
    submitHousingPost.mockReset().mockResolvedValue('p1');
    closeHousingPost.mockReset().mockResolvedValue(true);
    set = vi.fn((u) => { const p = typeof u === 'function' ? u(state) : u; state = { ...state, ...p }; });
    get = vi.fn(() => state);
    state = { ...createHousingSlice(set as never, get as never, {} as never), pushSheet: vi.fn(), isPhoneLayout: false } as never;
  });

  it('loads posts and this install\'s own ids from IDB', async () => {
    idb.set('housing_posts_mine', ['p1']);
    await state.loadHousing();
    expect(state.housingPosts).toEqual([post]);
    expect(state.housingLoaded).toBe(true);
    expect(state.housingMineIds).toEqual(['p1']);
  });

  it('keeps housingLoaded false when the load fails', async () => {
    fetchHousingPosts.mockResolvedValue({ posts: [], ok: false });
    await state.loadHousing();
    expect(state.housingLoaded).toBe(false);
    expect(state.housingLoading).toBe(false);
  });

  it('publishes with the IS identity, remembers the id, and reloads', async () => {
    const result = await state.publishHousing(draft);
    expect(result).toBe('ok');
    expect(submitHousingPost).toHaveBeenCalledWith(draft, { isLogin: 'xnovak', personId: '123456' });
    expect(state.housingMineIds).toEqual(['p1']);
    expect(idb.get('housing_posts_mine')).toEqual(['p1']);
    expect(fetchHousingPosts).toHaveBeenCalled();
  });

  it('reports refused when the server returns null', async () => {
    submitHousingPost.mockResolvedValue(null);
    expect(await state.publishHousing(draft)).toBe('refused');
  });

  it('closes a post, forgets the id, and drops it from the list', async () => {
    idb.set('housing_posts_mine', ['p1']);
    await state.loadHousing();
    expect(await state.closeHousing('p1')).toBe(true);
    expect(state.housingMineIds).toEqual([]);
    expect(state.housingPosts).toEqual([]);
  });

  it('openHousingBoard bumps the request counter and pushes the sheet on a phone', () => {
    state.isPhoneLayout = true;
    state.openHousingBoard();
    expect(state.housingOpenRequest).toBe(1);
    expect(state.pushSheet).toHaveBeenCalledWith({ kind: 'housing' });
  });
});
```

Note: check the real name of the phone-layout flag with `grep -n "isPhone\|phoneLayout" src/store/types.ts`; if the store has none, drop the `pushSheet` branch from the slice and let callers decide (see Task 8), and delete the last test's `pushSheet` assertion.

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/store/slices/__tests__/createHousingSlice.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the slice**

`src/store/slices/createHousingSlice.ts`:

```ts
import type { AppSlice } from '../types';
import { fetchHousingPosts, submitHousingPost, closeHousingPost } from '../../api/housing';
import { getUserParams } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
import { logError } from '../../utils/reportError';
import type { HousingDraft, HousingPost } from '../../types/housing';

export interface HousingSlice {
  housingPosts: HousingPost[];
  housingLoading: boolean;
  /** True only after a successful load, so an empty board is never shown for a failed one. */
  housingLoaded: boolean;
  /** Ids this install published. The server never tells us; the device remembers. */
  housingMineIds: string[];
  /** Bumped by openHousingBoard; the desktop shell switches view when it changes. */
  housingOpenRequest: number;
  loadHousing: () => Promise<void>;
  publishHousing: (draft: HousingDraft) => Promise<'ok' | 'refused' | 'failed'>;
  closeHousing: (id: string) => Promise<boolean>;
  openHousingBoard: () => void;
}

const MINE_KEY = 'housing_posts_mine';

async function readMine(): Promise<string[]> {
  try {
    const v = await IndexedDBService.get('meta', MINE_KEY);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export const createHousingSlice: AppSlice<HousingSlice> = (set, get) => ({
  housingPosts: [],
  housingLoading: false,
  housingLoaded: false,
  housingMineIds: [],
  housingOpenRequest: 0,

  loadHousing: async () => {
    if (get().housingLoading) return;
    set({ housingLoading: true });
    const [res, mine] = await Promise.all([fetchHousingPosts(), readMine()]);
    set({
      housingLoading: false,
      housingMineIds: mine,
      ...(res.ok ? { housingPosts: res.posts, housingLoaded: true } : {}),
    });
  },

  publishHousing: async (draft) => {
    let poster: { isLogin: string; personId: string };
    try {
      const p = await getUserParams();
      if (!p?.username || !p.studentId) return 'failed';
      poster = { isLogin: p.username, personId: p.studentId };
    } catch (err) {
      logError('HousingSlice.publishHousing', err);
      return 'failed';
    }
    const id = await submitHousingPost(draft, poster);
    if (!id) return 'refused';
    const mine = [...get().housingMineIds, id];
    set({ housingMineIds: mine });
    try {
      await IndexedDBService.set('meta', MINE_KEY, mine);
    } catch (err) {
      logError('HousingSlice.publishHousing.persist', err);
    }
    await get().loadHousing();
    return 'ok';
  },

  closeHousing: async (id) => {
    const ok = await closeHousingPost(id);
    if (!ok) return false;
    const mine = get().housingMineIds.filter((x) => x !== id);
    set({ housingMineIds: mine, housingPosts: get().housingPosts.filter((p) => p.id !== id) });
    try {
      await IndexedDBService.set('meta', MINE_KEY, mine);
    } catch (err) {
      logError('HousingSlice.closeHousing.persist', err);
    }
    return true;
  },

  openHousingBoard: () => {
    set({ housingOpenRequest: get().housingOpenRequest + 1 });
    const s = get() as unknown as { isPhoneLayout?: boolean; pushSheet?: (sheet: { kind: 'housing' }) => void };
    if (s.isPhoneLayout && s.pushSheet) s.pushSheet({ kind: 'housing' });
  },
});
```

- [ ] **Step 4: Wire the slice and the sheet kind**

In `src/store/types.ts`:
- Add to the `MobileSheet` union, before `| { kind: 'confirm'; confirmId: string };`:
  ```ts
  // The housing board. Opened from the profile tab, from a society post whose
  // url is `reis://housing`, and from an event card carrying that token.
  | { kind: 'housing' }
  ```
- Add to the `AppState` intersection next to `import('./slices/createRsvpSlice').RsvpSlice &`:
  ```ts
  import('./slices/createHousingSlice').HousingSlice &
  ```

In `src/store/useAppStore.ts`: add `import { createHousingSlice } from './slices/createHousingSlice';` and `...createHousingSlice(...a),` after `...createRsvpSlice(...a),`.

- [ ] **Step 5: Run tests and typecheck**

```bash
npx vitest run src/store/slices/__tests__/createHousingSlice.test.ts && npm run typecheck
```
Expected: PASS; typecheck clean (SheetHost's `switch` has a `default: return null`, so the new kind compiles before Task 6 renders it).

- [ ] **Step 6: Commit**

```bash
git add src/store/slices/createHousingSlice.ts src/store/slices/__tests__/createHousingSlice.test.ts src/store/types.ts src/store/useAppStore.ts
git commit -m "feat(housing): store slice with own-post memory and board open request

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Translations and the housing link token

**Files:**
- Modify: `src/i18n/locales/cs.json`, `src/i18n/locales/en.json` (add top-level `housing` object; add `sidebar.housing`, `mobile.profile.housing`, `mobile.profile.housingSub`, `admin.housingTab`, `admin.urlLabel`, `admin.urlHint`)
- Create: `src/utils/housingLink.ts`
- Create: `src/utils/__tests__/housingLink.test.ts`

**Interfaces:**
- Produces: `HOUSING_LINK = 'reis://housing'`, `isHousingLink(link: string | null | undefined): boolean`.
- Produces translation keys used by Tasks 6 to 10 (exact keys below).

- [ ] **Step 1: Failing token test**

`src/utils/__tests__/housingLink.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { HOUSING_LINK, isHousingLink } from '../housingLink';

describe('isHousingLink', () => {
  it('recognises the token, case-insensitively and with whitespace', () => {
    expect(isHousingLink(HOUSING_LINK)).toBe(true);
    expect(isHousingLink(' REIS://housing ')).toBe(true);
  });
  it('rejects real URLs, empty and missing links', () => {
    expect(isHousingLink('https://is.mendelu.cz')).toBe(false);
    expect(isHousingLink('')).toBe(false);
    expect(isHousingLink(null)).toBe(false);
    expect(isHousingLink(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/utils/__tests__/housingLink.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

`src/utils/housingLink.ts`:

```ts
/**
 * A society post whose `url` is this token opens the housing board inside reIS
 * instead of a browser tab. It is checked BEFORE openExternal, which would
 * (correctly) refuse a non-http URL.
 */
export const HOUSING_LINK = 'reis://housing';

export function isHousingLink(link: string | null | undefined): boolean {
  return typeof link === 'string' && link.trim().toLowerCase() === HOUSING_LINK;
}
```

- [ ] **Step 4: Add the strings**

`cs.json`, new top-level key (alphabetical placement is not required; add after `"documents"`):

```json
"housing": {
  "title": "Bydlení",
  "subtitle": "Pokoje od studentů pro studenty",
  "tabOffer": "Nabízím",
  "tabRequest": "Hledám",
  "empty": "Zatím tu nic není. Buď první.",
  "loadFailed": "Nabídky se nepodařilo načíst.",
  "add": "Přidat",
  "mine": "Moje inzeráty",
  "noMine": "Nemáš žádný aktivní inzerát.",
  "close": "Uzavřít",
  "report": "Nahlásit",
  "reported": "Díky, podíváme se na to.",
  "verify": "Ověřit v IS",
  "contact": "Kontakt",
  "freeFrom": "Volné od",
  "freeUntil": "do",
  "priceUnit": "Kč/měsíc",
  "expires": "Vyprší {date}",
  "kind": { "offer": "Nabízím", "request": "Hledám" },
  "roomType": { "bed_shared": "Lůžko ve sdíleném pokoji", "room_private": "Vlastní pokoj", "flat": "Celý byt" },
  "form": {
    "title": "Nový inzerát",
    "kind": "Co chceš?",
    "roomType": "Typ",
    "district": "Čtvrť",
    "districtPlaceholder": "např. Královo Pole",
    "price": "Cena (Kč/měsíc)",
    "freeFrom": "Volné od",
    "freeUntil": "Volné do (nepovinné)",
    "note": "Poznámka",
    "notePlaceholder": "Velikost, spolubydlící, kauce, cokoli důležitého",
    "contact": "Kontakt pro zájemce",
    "contactPlaceholder": "e-mail, telefon nebo Instagram",
    "loginLabel": "Zveřejní se tvůj IS login",
    "consent": "Souhlasím, že můj IS login a zadaný kontakt uvidí ostatní uživatelé reIS, dokud inzerát nevyprší (14 dní) nebo ho neuzavřu.",
    "publish": "Zveřejnit",
    "published": "Inzerát je venku.",
    "refused": "Teď to nejde: nejvíc 3 aktivní inzeráty a 5 pokusů za hodinu.",
    "failed": "Odeslání se nepovedlo. Zkus to znovu.",
    "cancel": "Zrušit"
  }
}
```

Also add: `"sidebar": { ..., "housing": "Bydlení" }`, `"mobile": { "profile": { ..., "housing": "Bydlení", "housingSub": "Pokoje od studentů pro studenty" } }`, `"admin": { ..., "housingTab": "Bydlení", "urlLabel": "Odkaz (nepovinný)", "urlHint": "https://… nebo reis://housing pro otevření nástěnky bydlení", "housingHide": "Skrýt", "housingUnhide": "Zobrazit", "housingDelete": "Smazat", "housingHidden": "skryto" }`.

`en.json`, same keys:

```json
"housing": {
  "title": "Housing",
  "subtitle": "Rooms from students for students",
  "tabOffer": "Offering",
  "tabRequest": "Looking",
  "empty": "Nothing here yet. Be the first.",
  "loadFailed": "Could not load the board.",
  "add": "Add",
  "mine": "My posts",
  "noMine": "You have no live post.",
  "close": "Close",
  "report": "Report",
  "reported": "Thanks, we'll look at it.",
  "verify": "Verify in IS",
  "contact": "Contact",
  "freeFrom": "Free from",
  "freeUntil": "until",
  "priceUnit": "CZK/month",
  "expires": "Expires {date}",
  "kind": { "offer": "Offering", "request": "Looking" },
  "roomType": { "bed_shared": "Bed in a shared room", "room_private": "Private room", "flat": "Whole flat" },
  "form": {
    "title": "New post",
    "kind": "What do you want?",
    "roomType": "Type",
    "district": "District",
    "districtPlaceholder": "e.g. Královo Pole",
    "price": "Price (CZK/month)",
    "freeFrom": "Free from",
    "freeUntil": "Free until (optional)",
    "note": "Note",
    "notePlaceholder": "Size, flatmates, deposit, anything that matters",
    "contact": "Contact for replies",
    "contactPlaceholder": "email, phone or Instagram",
    "loginLabel": "Your IS login will be shown",
    "consent": "I agree that my IS login and the contact I typed are visible to other reIS users until this post expires (14 days) or I close it.",
    "publish": "Publish",
    "published": "Your post is live.",
    "refused": "Not now: at most 3 live posts and 5 attempts per hour.",
    "failed": "Sending failed. Try again.",
    "cancel": "Cancel"
  }
}
```
plus `sidebar.housing: "Housing"`, `mobile.profile.housing: "Housing"`, `mobile.profile.housingSub: "Rooms from students for students"`, `admin.housingTab: "Housing"`, `admin.urlLabel: "Link (optional)"`, `admin.urlHint: "https://… or reis://housing to open the housing board"`, `admin.housingHide: "Hide"`, `admin.housingUnhide: "Unhide"`, `admin.housingDelete: "Delete"`, `admin.housingHidden: "hidden"`.

- [ ] **Step 5: Run tests, including any locale-parity test**

```bash
npx vitest run src/utils/__tests__/housingLink.test.ts src/i18n
```
Expected: PASS. If an i18n key-parity test exists and fails, the two files differ in keys; fix the JSON until it passes.

- [ ] **Step 6: Commit**

```bash
git add src/utils/housingLink.ts src/utils/__tests__/housingLink.test.ts src/i18n/locales/cs.json src/i18n/locales/en.json
git commit -m "feat(housing): translations and the reis://housing link token

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Board components (shared by phone and desktop)

**Files:**
- Create: `src/components/housing/HousingCard.tsx`
- Create: `src/components/housing/HousingForm.tsx`
- Create: `src/components/housing/MyHousingPosts.tsx`
- Create: `src/components/housing/HousingBoard.tsx`
- Create: `src/components/housing/__tests__/HousingForm.test.tsx`
- Create: `src/components/housing/__tests__/HousingBoard.test.tsx`

**Interfaces:**
- Consumes: store fields from Task 4; `submitSuggestion(draft: SuggestionDraft)` from `src/api/suggestions.ts`; `useTranslation`.
- Produces:
  - `HousingBoard({ onVerify }: { onVerify: (post: HousingPost) => void })`
  - `HousingCard({ post, onVerify, onReport })`
  - `HousingForm({ onDone }: { onDone: () => void })`
  - `MyHousingPosts()`

- [ ] **Step 1: Failing form test (consent gates publish)**

`src/components/housing/__tests__/HousingForm.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingForm } from '../HousingForm';

describe('HousingForm', () => {
  const publishHousing = vi.fn(async () => 'ok' as const);
  beforeEach(() => {
    publishHousing.mockClear();
    useAppStore.setState({ language: 'cz', publishHousing } as never);
  });

  it('keeps Publish disabled until required fields and consent are set', async () => {
    render(<HousingForm onDone={() => {}} />);
    const publish = screen.getByRole('button', { name: 'Zveřejnit' });
    expect(publish).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Královo Pole' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), { target: { value: 'ja@example.com' } });
    expect(publish).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(publish).toBeEnabled();
    fireEvent.click(publish);
    await waitFor(() => expect(publishHousing).toHaveBeenCalledTimes(1));
    expect(publishHousing.mock.calls[0]![0]).toMatchObject({
      kind: 'offer', roomType: 'room_private', district: 'Královo Pole', freeFrom: '2026-09-15', contact: 'ja@example.com', priceCzk: null,
    });
  });

  it('shows the refused message and stays open when the server refuses', async () => {
    publishHousing.mockResolvedValueOnce('refused' as never);
    const onDone = vi.fn();
    render(<HousingForm onDone={onDone} />);
    fireEvent.change(screen.getByLabelText('Čtvrť'), { target: { value: 'Brno' } });
    fireEvent.change(screen.getByLabelText('Volné od'), { target: { value: '2026-09-15' } });
    fireEvent.change(screen.getByLabelText('Kontakt pro zájemce'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'Zveřejnit' }));
    await screen.findByText('Teď to nejde: nejvíc 3 aktivní inzeráty a 5 pokusů za hodinu.');
    expect(onDone).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Failing board test**

`src/components/housing/__tests__/HousingBoard.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { HousingBoard } from '../HousingBoard';

const offer = { id: 'o1', kind: 'offer', roomType: 'room_private', district: 'Královo Pole', priceCzk: 7500, freeFrom: '2026-09-15', freeUntil: null, note: 'Klidný pokoj', contact: 'ja@example.com', isLogin: 'xnovak', personId: '123456', createdAt: '2026-09-06T10:00:00Z', expiresAt: '2026-09-20T10:00:00Z' } as const;
const request = { ...offer, id: 'r1', kind: 'request', isLogin: 'xhleda', personId: '7', district: 'Bystrc' } as const;

describe('HousingBoard', () => {
  const loadHousing = vi.fn(async () => {});
  beforeEach(() => {
    loadHousing.mockClear();
    useAppStore.setState({
      language: 'cz', housingPosts: [offer, request], housingLoaded: true, housingLoading: false,
      housingMineIds: [], loadHousing,
    } as never);
  });

  it('loads on mount and filters by tab', () => {
    render(<HousingBoard onVerify={() => {}} />);
    expect(loadHousing).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Královo Pole')).toBeInTheDocument();
    expect(screen.queryByText('Bystrc')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: 'Hledám' }));
    expect(screen.getByText('Bystrc')).toBeInTheDocument();
    expect(screen.queryByText('Královo Pole')).toBeNull();
  });

  it('shows the login and hands the post to onVerify', () => {
    const onVerify = vi.fn();
    render(<HousingBoard onVerify={onVerify} />);
    fireEvent.click(screen.getByRole('button', { name: /xnovak/ }));
    expect(onVerify).toHaveBeenCalledWith(expect.objectContaining({ id: 'o1', personId: '123456' }));
  });

  it('shows the empty state for an empty tab', () => {
    useAppStore.setState({ housingPosts: [offer] } as never);
    render(<HousingBoard onVerify={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hledám' }));
    expect(screen.getByText('Zatím tu nic není. Buď první.')).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run to see them fail**

```bash
npx vitest run src/components/housing
```
Expected: FAIL, modules not found.

- [ ] **Step 4: HousingCard**

`src/components/housing/HousingCard.tsx`:

```tsx
import { useState } from 'react';
import { ShieldCheck, Flag } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { HousingPost } from '../../types/housing';

export function HousingCard({
  post,
  onVerify,
  onReport,
}: {
  post: HousingPost;
  onVerify: (post: HousingPost) => void;
  onReport: (post: HousingPost) => Promise<void>;
}) {
  const { t, language } = useTranslation();
  const [reported, setReported] = useState(false);
  const locale = language === 'cz' ? 'cs' : language;
  const fmt = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'numeric' });

  return (
    <div className="card card-compact bg-base-100 shadow-sm">
      <div className="card-body gap-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="badge badge-outline badge-sm">{t(`housing.roomType.${post.roomType}`)}</div>
            <h3 className="mt-1 text-base font-semibold">{post.district}</h3>
          </div>
          {post.priceCzk !== null && (
            <div className="text-right text-sm font-semibold">
              {post.priceCzk.toLocaleString(locale)} <span className="text-xs font-normal opacity-70">{t('housing.priceUnit')}</span>
            </div>
          )}
        </div>
        <div className="text-sm opacity-80">
          {t('housing.freeFrom')} {fmt(post.freeFrom)}
          {post.freeUntil && ` ${t('housing.freeUntil')} ${fmt(post.freeUntil)}`}
        </div>
        {post.note && <p className="whitespace-pre-wrap text-sm">{post.note}</p>}
        <div className="text-sm">
          <span className="opacity-70">{t('housing.contact')}: </span>
          <span className="select-all font-medium">{post.contact}</span>
        </div>
        <div className="card-actions items-center justify-between">
          {/* The login is the trust mechanism: one tap opens the poster in IS. */}
          <button type="button" className="btn btn-ghost btn-sm gap-1" onClick={() => onVerify(post)}>
            <ShieldCheck size={14} /> {post.isLogin} · {t('housing.verify')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-xs opacity-70"
            disabled={reported}
            onClick={async () => { await onReport(post); setReported(true); }}
          >
            <Flag size={12} /> {reported ? t('housing.reported') : t('housing.report')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: HousingForm**

`src/components/housing/HousingForm.tsx`:

```tsx
import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { HOUSING_KINDS, HOUSING_LIMITS, HOUSING_ROOM_TYPES, type HousingDraft, type HousingKind, type HousingRoomType } from '../../types/housing';

// No <form> submit: the extension iframe is sandboxed (same reason as
// EventComposer). Publish is a button gated on the required fields AND the
// consent tick — the tick is what authorises attaching the IS login.
export function HousingForm({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const publishHousing = useAppStore((s) => s.publishHousing);
  const [kind, setKind] = useState<HousingKind>('offer');
  const [roomType, setRoomType] = useState<HousingRoomType>('room_private');
  const [district, setDistrict] = useState('');
  const [price, setPrice] = useState('');
  const [freeFrom, setFreeFrom] = useState('');
  const [freeUntil, setFreeUntil] = useState('');
  const [note, setNote] = useState('');
  const [contact, setContact] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ready = district.trim() && freeFrom && contact.trim() && consent && !busy;

  const publish = async () => {
    if (!ready) return;
    setBusy(true);
    setMessage(null);
    const draft: HousingDraft = {
      kind, roomType,
      district: district.trim(),
      priceCzk: price.trim() === '' ? null : Math.max(0, Math.round(Number(price))),
      freeFrom,
      freeUntil: freeUntil || null,
      note: note.trim(),
      contact: contact.trim(),
    };
    const result = await publishHousing(draft);
    setBusy(false);
    if (result === 'ok') { onDone(); return; }
    setMessage(t(result === 'refused' ? 'housing.form.refused' : 'housing.form.failed'));
  };

  const field = (id: string, label: string, input: React.ReactNode) => (
    <label className="form-control w-full" htmlFor={id}>
      <span className="label-text mb-1 text-sm">{label}</span>
      {input}
    </label>
  );

  return (
    <div className="flex flex-col gap-3 p-3">
      <h3 className="text-lg font-semibold">{t('housing.form.title')}</h3>
      <div role="tablist" className="tabs tabs-box tabs-sm">
        {HOUSING_KINDS.map((k) => (
          <button key={k} type="button" role="tab" aria-selected={kind === k}
            className={`tab flex-1 ${kind === k ? 'tab-active font-semibold' : ''}`} onClick={() => setKind(k)}>
            {t(`housing.kind.${k}`)}
          </button>
        ))}
      </div>
      {field('h-type', t('housing.form.roomType'),
        <select id="h-type" className="select select-bordered select-sm" value={roomType} onChange={(e) => setRoomType(e.target.value as HousingRoomType)}>
          {HOUSING_ROOM_TYPES.map((r) => <option key={r} value={r}>{t(`housing.roomType.${r}`)}</option>)}
        </select>)}
      {field('h-district', t('housing.form.district'),
        <input id="h-district" className="input input-bordered input-sm" maxLength={HOUSING_LIMITS.district} placeholder={t('housing.form.districtPlaceholder')} value={district} onChange={(e) => setDistrict(e.target.value)} />)}
      {field('h-price', t('housing.form.price'),
        <input id="h-price" type="number" inputMode="numeric" min={0} max={100000} className="input input-bordered input-sm" value={price} onChange={(e) => setPrice(e.target.value)} />)}
      {field('h-from', t('housing.form.freeFrom'),
        <input id="h-from" type="date" className="input input-bordered input-sm" value={freeFrom} onChange={(e) => setFreeFrom(e.target.value)} />)}
      {field('h-until', t('housing.form.freeUntil'),
        <input id="h-until" type="date" className="input input-bordered input-sm" min={freeFrom || undefined} value={freeUntil} onChange={(e) => setFreeUntil(e.target.value)} />)}
      {field('h-note', t('housing.form.note'),
        <textarea id="h-note" className="textarea textarea-bordered textarea-sm" rows={3} maxLength={HOUSING_LIMITS.note} placeholder={t('housing.form.notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} />)}
      {field('h-contact', t('housing.form.contact'),
        <input id="h-contact" className="input input-bordered input-sm" maxLength={HOUSING_LIMITS.contact} placeholder={t('housing.form.contactPlaceholder')} value={contact} onChange={(e) => setContact(e.target.value)} />)}
      <div className="text-xs opacity-70">{t('housing.form.loginLabel')}</div>
      <label className="flex cursor-pointer items-start gap-2 text-sm">
        <input type="checkbox" className="checkbox checkbox-sm mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{t('housing.form.consent')}</span>
      </label>
      {message && <div className="alert alert-warning py-2 text-sm">{message}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDone}>{t('housing.form.cancel')}</button>
        <button type="button" className="btn btn-primary btn-sm" disabled={!ready} onClick={publish}>{t('housing.form.publish')}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: MyHousingPosts**

`src/components/housing/MyHousingPosts.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

export function MyHousingPosts() {
  const { t } = useTranslation();
  const mineIds = useAppStore((s) => s.housingMineIds);
  const posts = useAppStore((s) => s.housingPosts);
  const closeHousing = useAppStore((s) => s.closeHousing);
  const mine = posts.filter((p) => mineIds.includes(p.id));
  if (mineIds.length === 0) return null;
  return (
    <div className="rounded-box bg-base-200 p-3">
      <div className="mb-2 text-xs font-bold uppercase tracking-wider opacity-60">{t('housing.mine')}</div>
      {mine.length === 0 && <div className="text-sm opacity-70">{t('housing.noMine')}</div>}
      {mine.map((p) => (
        <div key={p.id} className="flex items-center justify-between gap-2 py-1 text-sm">
          <span>{t(`housing.kind.${p.kind}`)} · {p.district}</span>
          <button type="button" className="btn btn-outline btn-xs" onClick={() => void closeHousing(p.id)}>{t('housing.close')}</button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 7: HousingBoard**

`src/components/housing/HousingBoard.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { submitSuggestion } from '../../api/suggestions';
import type { HousingKind, HousingPost } from '../../types/housing';
import { HousingCard } from './HousingCard';
import { HousingForm } from './HousingForm';
import { MyHousingPosts } from './MyHousingPosts';

/**
 * The board itself, hosted by HousingSheet (phone) and HousingPanel (desktop).
 * `onVerify` differs per host: the phone pushes the person sheet, the desktop
 * opens the IS person page. Loading is a slice action fired once on mount —
 * the effect only *calls* the store, it does not fetch.
 */
export function HousingBoard({ onVerify }: { onVerify: (post: HousingPost) => void }) {
  const { t } = useTranslation();
  const posts = useAppStore((s) => s.housingPosts);
  const loaded = useAppStore((s) => s.housingLoaded);
  const loading = useAppStore((s) => s.housingLoading);
  const loadHousing = useAppStore((s) => s.loadHousing);
  const [tab, setTab] = useState<HousingKind>('offer');
  const [adding, setAdding] = useState(false);

  useEffect(() => { void loadHousing(); }, [loadHousing]);

  const report = async (post: HousingPost) => {
    // Moderation reuses the suggestions inbox: no new plumbing, admins already read it.
    await submitSuggestion({ type: 'other', title: `[housing] ${post.id}`, body: `${post.kind} · ${post.district} · ${post.isLogin}` });
  };

  if (adding) return <HousingForm onDone={() => setAdding(false)} />;

  const visible = posts.filter((p) => p.kind === tab);
  return (
    <div className="relative flex h-full flex-col gap-3 p-3">
      <div role="tablist" className="tabs tabs-box tabs-sm shrink-0">
        {(['offer', 'request'] as const).map((k) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k}
            className={`tab flex-1 ${tab === k ? 'tab-active font-semibold' : ''}`} onClick={() => setTab(k)}>
            {t(k === 'offer' ? 'housing.tabOffer' : 'housing.tabRequest')}
          </button>
        ))}
      </div>
      <MyHousingPosts />
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pb-16">
        {!loaded && !loading && <div className="alert alert-warning py-2 text-sm">{t('housing.loadFailed')}</div>}
        {loading && posts.length === 0 && <span className="loading loading-dots loading-sm self-center" />}
        {loaded && visible.length === 0 && <div className="py-8 text-center text-sm opacity-70">{t('housing.empty')}</div>}
        {visible.map((p) => <HousingCard key={p.id} post={p} onVerify={onVerify} onReport={report} />)}
      </div>
      <button type="button" className="btn btn-primary btn-circle absolute bottom-4 right-4 shadow-lg" aria-label={t('housing.add')} onClick={() => setAdding(true)}>
        <Plus size={20} />
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Run the component tests**

```bash
npx vitest run src/components/housing
```
Expected: PASS. If `getByLabelText` fails because the `<label htmlFor>` wraps the input, keep `htmlFor` and the `id` on the input as written; Testing Library resolves either.

- [ ] **Step 9: Commit**

```bash
git add src/components/housing
git commit -m "feat(housing): board, card, form with consent gate, my posts

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Phone surfaces: sheet, host case, profile entry

**Files:**
- Create: `src/components/mobile/sheets/HousingSheet.tsx`
- Modify: `src/components/mobile/sheets/SheetHost.tsx` (imports at top; `switch` cases around line 44)
- Modify: `src/components/mobile/screens/ProfileScreen.tsx` (after the eduroam `NavRow`, around line 118)
- Modify: `src/components/mobile/screens/__tests__/ProfileScreen.test.tsx`

**Interfaces:**
- Consumes: `HousingBoard` (Task 6), `pushSheet`, sheet kind `'housing'` (Task 4).
- Produces: `HousingSheet({ onClose }: { onClose: () => void })`.

- [ ] **Step 1: Failing profile test**

Append to the `describe('the profile tab')` block in `ProfileScreen.test.tsx`:

```tsx
  it('opens the housing board from the settings list', () => {
    render(<ProfileScreen />);
    fireEvent.click(screen.getByText('Bydlení'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'housing' }]);
  });
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/components/mobile/screens/__tests__/ProfileScreen.test.tsx
```
Expected: FAIL, `Unable to find an element with the text: Bydlení`.

- [ ] **Step 3: HousingSheet**

Read `src/components/mobile/sheets/DocsSheet.tsx` first and copy its outer shell (header with title and close button, scroll container). Then `src/components/mobile/sheets/HousingSheet.tsx`:

```tsx
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { HousingBoard } from '../../housing/HousingBoard';
import { SheetShell } from './SheetShell'; // use whatever DocsSheet uses for its frame; if DocsSheet inlines its header, inline the same markup here instead of this import

export function HousingSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);
  return (
    <SheetShell title={t('housing.title')} subtitle={t('housing.subtitle')} onClose={onClose}>
      <HousingBoard
        onVerify={(post) => pushSheet({ kind: 'person', personId: post.personId, personName: post.isLogin })}
      />
    </SheetShell>
  );
}
```

- [ ] **Step 4: Register in SheetHost**

Add `import { HousingSheet } from './HousingSheet';` and, before `default:`:

```tsx
          case 'housing':
            return <HousingSheet key={index} onClose={popSheet} />;
```

- [ ] **Step 5: Profile entry**

In `ProfileScreen.tsx`, import `BedDouble` from `lucide-react` and add after the Dokumenty `NavRow`:

```tsx
        {/* Housing: rooms from students for students. A settings-list row, not a
            tab — it matters for two months a year. */}
        <NavRow
          icon={BedDouble}
          label={t('mobile.profile.housing')}
          sublabel={t('mobile.profile.housingSub')}
          onClick={() => pushSheet({ kind: 'housing' })}
        />
```

- [ ] **Step 6: Run tests and typecheck**

```bash
npx vitest run src/components/mobile && npm run typecheck
```
Expected: PASS, clean.

- [ ] **Step 7: Commit**

```bash
git add src/components/mobile/sheets/HousingSheet.tsx src/components/mobile/sheets/SheetHost.tsx src/components/mobile/screens/ProfileScreen.tsx src/components/mobile/screens/__tests__/ProfileScreen.test.tsx
git commit -m "feat(housing): phone sheet and profile entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Desktop view and sidebar entry

**Files:**
- Modify: `src/types/app.ts` (`APP_VIEWS`)
- Create: `src/components/housing/HousingPanel.tsx`
- Modify: `src/components/Menu/MainItems.tsx` (after the `map` item)
- Modify: `src/components/Sidebar.tsx` (onClick chain near line 78)
- Modify: `src/components/AppMain.tsx` (render after the `map` view, around line 86; react to `housingOpenRequest`)
- Modify: `src/components/__tests__/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `HousingBoard`, `housingOpenRequest` (Task 4).
- Produces: `'housing'` in `AppView`; `HousingPanel()`.

- [ ] **Step 1: Failing sidebar test**

Add to `src/components/__tests__/Sidebar.test.tsx` (mirror the existing test that clicks an item and asserts `onViewChange`):

```tsx
  it('switches to the housing view', () => {
    const onViewChange = vi.fn();
    render(<Sidebar {...defaultProps} items={[{ id: 'housing', label: 'Bydlení', icon: <span /> }]} onViewChange={onViewChange} />);
    fireEvent.click(screen.getByText('Bydlení'));
    expect(onViewChange).toHaveBeenCalledWith('housing');
  });
```
Use the same prop spread the file's other tests use for `defaultProps`.

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/components/__tests__/Sidebar.test.tsx
```
Expected: FAIL (`onViewChange` not called).

- [ ] **Step 3: Add the view**

`src/types/app.ts`: add `'housing',` after `'map',` in `APP_VIEWS`. (`suggestions.screen` in the DB is only length-checked, so no migration.)

- [ ] **Step 4: HousingPanel**

`src/components/housing/HousingPanel.tsx`:

```tsx
import { useTranslation } from '../../hooks/useTranslation';
import { HousingBoard } from './HousingBoard';

// Desktop host. Verification opens the poster's IS page in a new tab: the
// extension runs inside is.mendelu.cz, so the student is already signed in.
export function HousingPanel() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col">
      <div className="px-3 pt-3">
        <h2 className="text-xl font-bold">{t('housing.title')}</h2>
        <p className="text-sm opacity-70">{t('housing.subtitle')}</p>
      </div>
      <HousingBoard
        onVerify={(post) =>
          window.open(`https://is.mendelu.cz/lide/clovek.pl?id=${encodeURIComponent(post.personId)}`, '_blank', 'noopener,noreferrer')
        }
      />
    </div>
  );
}
```

- [ ] **Step 5: Sidebar item and routing**

`MainItems.tsx`: import `BedDouble` from `lucide-react`; after the `map` item add
```tsx
    { id: 'housing', label: t('sidebar.housing'), icon: <BedDouble className="w-5 h-5" /> },
```
`Sidebar.tsx`: in the onClick chain add `else if (item.id === 'housing') onViewChange('housing');` before the `else if (item.href)` line.

- [ ] **Step 6: Render the view and honour open requests**

`AppMain.tsx`: import `HousingPanel` and `useAppStore`; after `{currentView === 'map' && <CampusMapView />}` add `{currentView === 'housing' && <HousingPanel />}`. Then, near the other hooks at the top of the component:

```tsx
  // A society post with the reis://housing token, or an event card carrying it,
  // asks for the board through the store. Not a fetch — a view switch.
  const housingOpenRequest = useAppStore((s) => s.housingOpenRequest);
  const seenHousingRequest = useRef(housingOpenRequest);
  useEffect(() => {
    if (housingOpenRequest === seenHousingRequest.current) return;
    seenHousingRequest.current = housingOpenRequest;
    setCurrentView?.('housing');
  }, [housingOpenRequest, setCurrentView]);
```
Add `useRef`/`useEffect` to the React import if missing.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run src/components/__tests__/Sidebar.test.tsx src/components/housing && npm run typecheck
```
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add src/types/app.ts src/components/housing/HousingPanel.tsx src/components/Menu/MainItems.tsx src/components/Sidebar.tsx src/components/AppMain.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(housing): desktop view and sidebar entry

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The society post opens the board

**Files:**
- Modify: `src/components/mobile/sheets/NotificationsSheet.tsx` (`openNotification`, around line 140)
- Modify: `src/components/Notifications/NotificationDropdown.tsx` (onClick, around line 60)
- Modify: `src/components/CampusMap/EventDetailCard.tsx` (the `event.url` block, around line 159)
- Modify: `src/components/CampusMap/EventComposer.tsx` (state near line 46; `input` near line 131; `updatePost` patch near line 139; a new input in the form)
- Create: `src/components/mobile/sheets/__tests__/NotificationsSheetHousing.test.tsx`

**Interfaces:**
- Consumes: `isHousingLink`, `HOUSING_LINK` (Task 5); `openHousingBoard()` (Task 4).

- [ ] **Step 1: Failing test**

Read `src/components/mobile/sheets/__tests__/NotificationsSheetEvents.test.tsx` and copy its setup (how it seeds notifications and renders the sheet). Then write `NotificationsSheetHousing.test.tsx` with one case:

```tsx
  it('a notification whose link is reis://housing opens the housing sheet instead of a browser', () => {
    // seed one notification with link: 'reis://housing', as the events test seeds its rows
    render(<NotificationsSheet onClose={onClose} />);
    fireEvent.click(screen.getByText('Hledáš bydlení?'));
    expect(openExternal).not.toHaveBeenCalled();
    expect(useAppStore.getState().mobileSheets.at(-1)).toEqual({ kind: 'housing' });
    expect(onClose).toHaveBeenCalled();
  });
```
Mock `../../../mobile/openExternal` the way the events test does (or add `vi.mock` for it with `openExternal: vi.fn()`).

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/components/mobile/sheets/__tests__/NotificationsSheetHousing.test.tsx
```
Expected: FAIL (`openExternal` called, or sheet not pushed).

- [ ] **Step 3: Branch before the external link, phone**

`NotificationsSheet.tsx`: import `isHousingLink` from `'../../../utils/housingLink'`; read `const openHousingBoard = useAppStore((s) => s.openHousingBoard);` and `const pushSheet = useAppStore((s) => s.pushSheet);` next to the other store reads; in `openNotification`, before `if (n.link) {`:

```ts
    if (isHousingLink(n.link)) {
      activationRef.current += 1;
      openingRef.current = false;
      track();
      onClose();
      pushSheet({ kind: 'housing' });
      return;
    }
```

- [ ] **Step 4: Desktop dropdown**

`NotificationDropdown.tsx`: import `isHousingLink` and `useAppStore`; `const openHousingBoard = useAppStore((s) => s.openHousingBoard);`; in `onClick`, before `if (n.link) {`:

```tsx
                if (isHousingLink(n.link)) {
                  if (!n.associationId?.startsWith('academic_')) trackNotificationClick(n.id);
                  onClose();
                  openHousingBoard();
                  return;
                }
```

- [ ] **Step 5: Event card**

`EventDetailCard.tsx`: import `isHousingLink` and `useAppStore`; `const openHousingBoard = useAppStore((s) => s.openHousingBoard);`; replace `{event.url && (` with:

```tsx
        {isHousingLink(event.url) ? (
          <button type="button" className="btn btn-primary btn-sm btn-block" onClick={openHousingBoard}>
            {t('housing.title')}
          </button>
        ) : event.url && (
```
and close the ternary after the existing `</a>` with `)}` as before (the `&&` branch keeps its parentheses).

`openHousingBoard` pushes the sheet on the phone only when the store exposes a phone-layout flag (Task 4 note). If it does not, make the card decide: `const isPhone = usePhoneViewport();` (hook already used by `AdminConsole.tsx`) and `onClick={() => (isPhone ? pushSheet({ kind: 'housing' }) : openHousingBoard())}`.

- [ ] **Step 6: Composer link field**

`EventComposer.tsx`: add `const [url, setUrl] = useState(editing?.url ?? '');` after the `time` state; add `url: url.trim() || null,` to `input` and `url: input.url ?? null,` to the `updatePost` patch; render below the title input:

```tsx
      <label className="form-control w-full">
        <span className="label-text text-xs">{t('admin.urlLabel')}</span>
        <input className="input input-bordered input-sm" placeholder={t('admin.urlHint')} value={url} onChange={(e) => setUrl(e.target.value)} />
      </label>
```
Check `updatePost`'s accepted patch type in `src/api/societyPosts.ts`; if `url` is not in it, add `url?: string | null` to that type.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run src/components/mobile/sheets src/components/Notifications src/components/CampusMap && npm run typecheck
```
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/mobile/sheets/NotificationsSheet.tsx src/components/mobile/sheets/__tests__/NotificationsSheetHousing.test.tsx src/components/Notifications/NotificationDropdown.tsx src/components/CampusMap/EventDetailCard.tsx src/components/CampusMap/EventComposer.tsx src/api/societyPosts.ts
git commit -m "feat(housing): reis://housing society posts open the board; composer gets a link field

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Admin moderation

**Files:**
- Create: `src/api/housingAdmin.ts`
- Create: `src/api/__tests__/housingAdmin.test.ts`
- Create: `src/store/slices/createHousingAdminSlice.ts`
- Create: `src/components/AdminConsole/HousingModerationPanel.tsx`
- Modify: `src/store/types.ts`, `src/store/useAppStore.ts` (wire the slice)
- Modify: `src/components/AdminConsole/MobileAdminConsole.tsx` (tab), `src/components/AdminConsole/AdminConsole.tsx` (pane)

**Interfaces:**
- Consumes: `adminAuthClient` from `src/services/admin/authClient.ts`; `DEV_SOCIETY` from `src/utils/mock/devSociety.ts`; policies from Task 2.
- Produces:
  - `HousingAdminRow` (all table columns except `install_id`, plus `hidden_by_admin`)
  - `listAllHousingPosts(): Promise<HousingAdminRow[] | null>`, `setHousingHidden(id, hidden): Promise<boolean>`, `deleteHousingPost(id): Promise<boolean>`
  - store: `adminHousing: HousingAdminRow[]; loadAdminHousing(): Promise<void>; hideAdminHousing(id, hidden): Promise<void>; deleteAdminHousing(id): Promise<void>`

- [ ] **Step 1: Failing API test**

`src/api/__tests__/housingAdmin.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const chain = { select: vi.fn(), order: vi.fn(), limit: vi.fn(), update: vi.fn(), eq: vi.fn(), delete: vi.fn() };
const from = vi.fn(() => chain);
vi.mock('@/services/admin/authClient', () => ({ adminAuthClient: { from: (...a: unknown[]) => from(...a) } }));
vi.mock('@/utils/mock/devSociety', () => ({ DEV_SOCIETY: false }));

import { listAllHousingPosts, setHousingHidden, deleteHousingPost } from '../housingAdmin';

describe('housingAdmin api', () => {
  beforeEach(() => {
    Object.values(chain).forEach((f) => f.mockReset().mockReturnValue(chain));
    from.mockClear();
  });

  it('lists every post including hidden ones, newest first', async () => {
    chain.limit.mockResolvedValue({ data: [{ id: 'a', hidden_by_admin: true }], error: null });
    const rows = await listAllHousingPosts();
    expect(from).toHaveBeenCalledWith('housing_posts');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(rows).toEqual([{ id: 'a', hidden_by_admin: true }]);
  });

  it('returns null on a failed read', async () => {
    chain.limit.mockResolvedValue({ data: null, error: { message: 'x' } });
    expect(await listAllHousingPosts()).toBeNull();
  });

  it('hide reports false when no row was updated', async () => {
    chain.select.mockResolvedValue({ data: [], error: null });
    expect(await setHousingHidden('a', true)).toBe(false);
    expect(chain.update).toHaveBeenCalledWith({ hidden_by_admin: true });
  });

  it('delete reports true when a row went', async () => {
    chain.select.mockResolvedValue({ data: [{ id: 'a' }], error: null });
    expect(await deleteHousingPost('a')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to see it fail**

```bash
npx vitest run src/api/__tests__/housingAdmin.test.ts
```
Expected: FAIL, module not found.

- [ ] **Step 3: API**

`src/api/housingAdmin.ts`:

```ts
import { adminAuthClient } from '@/services/admin/authClient';
import { logError } from '@/utils/reportError';
import { DEV_SOCIETY } from '@/utils/mock/devSociety';

/** Raw row as the admin sees it. install_id is deliberately not selected. */
export interface HousingAdminRow {
  id: string;
  kind: 'offer' | 'request';
  room_type: 'bed_shared' | 'room_private' | 'flat';
  district: string;
  price_czk: number | null;
  free_from: string;
  free_until: string | null;
  note: string;
  contact: string;
  is_login: string;
  is_person_id: string;
  hidden_by_admin: boolean;
  created_at: string;
  expires_at: string;
}

const COLUMNS =
  'id, kind, room_type, district, price_czk, free_from, free_until, note, contact, is_login, is_person_id, hidden_by_admin, created_at, expires_at';

// Reads run under the admin session; RLS ("Admin read housing_posts") is the
// gate. In dev:web the seeded session cannot satisfy RLS, so return an empty
// board rather than an error toast on every open.
export async function listAllHousingPosts(): Promise<HousingAdminRow[] | null> {
  if (DEV_SOCIETY) return [];
  const { data, error } = await adminAuthClient
    .from('housing_posts')
    .select(COLUMNS)
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) {
    logError('Api.listAllHousingPosts', error);
    return null;
  }
  return (data ?? []) as unknown as HousingAdminRow[];
}

// .select('id') is load-bearing: PostgREST reports no error for an UPDATE that
// matched zero rows, so an empty result is the only signal nothing was written.
export async function setHousingHidden(id: string, hidden: boolean): Promise<boolean> {
  if (DEV_SOCIETY) return true;
  const { data, error } = await adminAuthClient
    .from('housing_posts')
    .update({ hidden_by_admin: hidden })
    .eq('id', id)
    .select('id');
  if (error) {
    logError('Api.setHousingHidden', error);
    return false;
  }
  return !!data && data.length > 0;
}

export async function deleteHousingPost(id: string): Promise<boolean> {
  if (DEV_SOCIETY) return true;
  const { data, error } = await adminAuthClient.from('housing_posts').delete().eq('id', id).select('id');
  if (error) {
    logError('Api.deleteHousingPost', error);
    return false;
  }
  return !!data && data.length > 0;
}
```

- [ ] **Step 4: Slice**

`src/store/slices/createHousingAdminSlice.ts`:

```ts
import type { AppSlice } from '../types';
import { listAllHousingPosts, setHousingHidden, deleteHousingPost, type HousingAdminRow } from '../../api/housingAdmin';

export interface HousingAdminSlice {
  adminHousing: HousingAdminRow[];
  adminHousingLoading: boolean;
  loadAdminHousing: () => Promise<void>;
  hideAdminHousing: (id: string, hidden: boolean) => Promise<void>;
  deleteAdminHousing: (id: string) => Promise<void>;
}

export const createHousingAdminSlice: AppSlice<HousingAdminSlice> = (set, get) => ({
  adminHousing: [],
  adminHousingLoading: false,
  loadAdminHousing: async () => {
    set({ adminHousingLoading: true });
    const rows = await listAllHousingPosts();
    set({ adminHousingLoading: false, ...(rows ? { adminHousing: rows } : {}) });
  },
  hideAdminHousing: async (id, hidden) => {
    if (!(await setHousingHidden(id, hidden))) return;
    set({ adminHousing: get().adminHousing.map((r) => (r.id === id ? { ...r, hidden_by_admin: hidden } : r)) });
  },
  deleteAdminHousing: async (id) => {
    if (!(await deleteHousingPost(id))) return;
    set({ adminHousing: get().adminHousing.filter((r) => r.id !== id) });
  },
});
```

Wire it: `src/store/types.ts` add `import('./slices/createHousingAdminSlice').HousingAdminSlice &` to `AppState`; `useAppStore.ts` import and spread after `...createAdminSlice(...a),`.

- [ ] **Step 5: Panel**

`src/components/AdminConsole/HousingModerationPanel.tsx`:

```tsx
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

// Loaded by the tab button that reveals it (see the consoles), never by an effect.
export function HousingModerationPanel() {
  const { t } = useTranslation();
  const rows = useAppStore((s) => s.adminHousing);
  const loading = useAppStore((s) => s.adminHousingLoading);
  const hide = useAppStore((s) => s.hideAdminHousing);
  const del = useAppStore((s) => s.deleteAdminHousing);
  const reload = useAppStore((s) => s.loadAdminHousing);

  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('housing.title')}</h3>
        <button type="button" className="btn btn-ghost btn-xs" onClick={() => void reload()} disabled={loading}>↻</button>
      </div>
      {rows.length === 0 && !loading && <div className="text-sm opacity-70">{t('housing.empty')}</div>}
      {rows.map((r) => (
        <div key={r.id} className={`card card-compact bg-base-200 ${r.hidden_by_admin ? 'opacity-60' : ''}`}>
          <div className="card-body gap-1 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">{t(`housing.kind.${r.kind}`)} · {r.district}</span>
              <span className="opacity-70">{r.is_login}{r.hidden_by_admin ? ` · ${t('admin.housingHidden')}` : ''}</span>
            </div>
            <div className="opacity-80">{r.contact}</div>
            {r.note && <div className="whitespace-pre-wrap">{r.note}</div>}
            <div className="card-actions justify-end">
              <button type="button" className="btn btn-outline btn-xs" onClick={() => void hide(r.id, !r.hidden_by_admin)}>
                {t(r.hidden_by_admin ? 'admin.housingUnhide' : 'admin.housingHide')}
              </button>
              <button type="button" className="btn btn-error btn-outline btn-xs" onClick={() => { if (window.confirm(t('admin.housingDelete') + '?')) void del(r.id); }}>
                {t('admin.housingDelete')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Tabs in both consoles (reis_admin only)**

`MobileAdminConsole.tsx`: extend `type Tab = 'list' | 'map' | 'suggestions' | 'accounts' | 'housing';`, read `const loadAdminHousing = useAppStore((s) => s.loadAdminHousing);`, add `const showHousing = !placing && isReisAdmin && tab === 'housing';`, render the tab button `{isReisAdmin && tabBtn('housing', t('admin.housingTab'))}` after the suggestions tab, make `tabBtn`'s `onClick` call `if (key === 'housing') void loadAdminHousing(); setTab(key);`, add `showHousing` to the hidden-list condition, and render:

```tsx
        {showHousing && (
          <div className="h-full overflow-y-auto bg-base-100 p-2">
            <HousingModerationPanel />
          </div>
        )}
```

`AdminConsole.tsx`: extend the `pane` union with `'housing'`, add a tab button after suggestions (same `isReisAdmin` guard, `onClick={() => { void loadAdminHousing(); setPane('housing'); }}`), and render `<HousingModerationPanel />` where the suggestions pane renders when `pane === 'housing'`.

- [ ] **Step 7: Run tests and typecheck**

```bash
npx vitest run src/api/__tests__/housingAdmin.test.ts src/components/AdminConsole && npm run typecheck && npm run lint
```
Expected: PASS, clean.

- [ ] **Step 8: Commit**

```bash
git add src/api/housingAdmin.ts src/api/__tests__/housingAdmin.test.ts src/store/slices/createHousingAdminSlice.ts src/store/types.ts src/store/useAppStore.ts src/components/AdminConsole
git commit -m "feat(housing): reis_admin moderation panel in both consoles

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Full verification and UI proof

**Files:** none new.

- [ ] **Step 1: Whole suite, guard included**

```bash
npm run test:run && npm run typecheck && npm run lint
```
Expected: all green. If `noStudentDataLeaves` flags `housingAdmin.ts`, it is because the regex matched `supabase.from` — it should not (the file uses `adminAuthClient`); do not widen the list, fix the import name.

- [ ] **Step 2: UI proof with the verify-ui skill**

Invoke the `verify-ui` skill for: the housing sheet with posts, the empty tab, the form with consent unticked and ticked, "My posts" with one row, the desktop view, and the moderation panel. Widths 320, 390, 430; both themes. Fix any overflow or contrast finding before proceeding.

- [ ] **Step 3: Apply the migration to the linked project**

```bash
supabase db push
```
Expected: `Applying migration 20260907120000_housing_posts.sql... Finished supabase db push.`

- [ ] **Step 4: Manual smoke against real Supabase**

```bash
npm run dev:web:admin
```
Publish a society post with URL `reis://housing`; confirm the notification opens the board. Publish one housing post from `npm run dev:web` is NOT valid evidence (writes go to the in-memory store); use the built extension against IS or the app.

- [ ] **Step 5: Commit any fixes, then hand over**

The branch is ready for `/release` and the manual gist update from Task 1.
