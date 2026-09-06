-- APPLIED 2026-09-06 against the linked project after inspecting the deployed
-- function: exactly one overload existed, track_daily_usage(text), whose body was
-- an upsert on (student_id, usage_date) incrementing open_count. That logic is
-- preserved below. daily_active_usage had columns student_id, usage_date,
-- open_count (default 1) and neither faculty nor platform.

-- Faculty and platform on the anonymous daily usage event, and an admin-only
-- aggregate. Six faculties times four platforms is a coarse grouping of
-- thousands of installs; the row still carries only the random install id.
-- Nothing about the person is added. Counts are of INSTALLS, not people.

-- Whitelist matches the keys of FACULTY_TO_ASSOCIATION (src/services/spolky/config.ts):
-- PEF, FRRMS, AF, ZF, LDF, ICV. Anything else — a typo, a future faculty not
-- yet added client-side, garbage input — is rejected at the column, not just
-- at the function, so no other write path can slip an arbitrary string in.
alter table public.daily_active_usage
  add column if not exists faculty  text check (faculty is null or faculty in ('PEF','FRRMS','AF','ZF','LDF','ICV')),
  add column if not exists platform text check (platform is null or platform in ('extension','ios','android','web'));

-- One function with defaults, so the old one-argument call keeps working and
-- PostgREST has no overload to disambiguate. Drop the old signature first.
-- One function must remain: two overloads would make PostgREST's named-argument
-- dispatch ambiguous for the one-argument call released clients still make.
do $$
declare r record;
begin
  for r in select oid::regprocedure as sig from pg_proc
            where pronamespace = 'public'::regnamespace and proname = 'track_daily_usage'
  loop
    execute format('drop function %s', r.sig);
  end loop;
end $$;

create or replace function public.track_daily_usage(
  p_student_id text,
  p_faculty text default null,
  p_platform text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_platform text := case when p_platform in ('extension','ios','android','web') then p_platform else null end;
  -- Same whitelist as the column CHECK above; normalized to upper case so
  -- case variance from a client never falls through NULL-safely into
  -- accidental unknown-faculty grouping.
  v_faculty  text := case when upper(btrim(coalesce(p_faculty, ''))) in ('PEF','FRRMS','AF','ZF','LDF','ICV')
                      then upper(btrim(p_faculty)) end;
begin
  -- open_count is the deployed function's existing behaviour (verified with
  -- pg_get_functiondef on 2026-09-06): one row per install per day, bumped on
  -- every open. Kept exactly; the two group labels ride along.
  insert into public.daily_active_usage (student_id, usage_date, open_count, faculty, platform)
  values (p_student_id, current_date, 1, v_faculty, v_platform)
  on conflict (student_id, usage_date) do update
    set open_count = public.daily_active_usage.open_count + 1,
        faculty    = coalesce(excluded.faculty,  public.daily_active_usage.faculty),
        platform   = coalesce(excluded.platform, public.daily_active_usage.platform);
end $$;
revoke all on function public.track_daily_usage(text, text, text) from public;
grant execute on function public.track_daily_usage(text, text, text) to anon, authenticated;

-- The aggregate. Groups of 1-4 installs are reported as -1 ("under 5") so a
-- tiny faculty on a rare platform can never be narrowed to a person.
-- p_days bounds ONLY this breakdown window (by_faculty/by_platform, via
-- `win` below); `today`/`d7`/`d30` and `weekly` below all use fixed windows
-- regardless of what the caller passes.
create or replace function public.usage_stats_unchecked(p_days int)
returns json
language sql stable security definer set search_path = public as $$
  with win as (
    select * from public.daily_active_usage
     where usage_date >= current_date - greatest(1, least(coalesce(p_days, 30), 365)) + 1
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
  -- Exactly 12 Monday-weeks including the current (partial) one, aligned to
  -- week boundaries so the row count the client charts is stable regardless
  -- of which weekday the query runs on. `current_date - 12 * 7` drifted: on
  -- a Sunday it could span all of a 13th week, clipping the client's chart
  -- (see AdminStatsPanel.tsx's viewBox fix).
  weeks as (
    select date_trunc('week', usage_date)::date as week_start, count(distinct student_id) as n
      from public.daily_active_usage
     where usage_date >= date_trunc('week', current_date)::date - 7 * 11
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

-- PostgREST caches the function signatures it saw at boot; without this,
-- a released one-argument client can 404 against track_daily_usage during
-- the drop/create window above until the schema cache next reloads on its own.
notify pgrst, 'reload schema';
