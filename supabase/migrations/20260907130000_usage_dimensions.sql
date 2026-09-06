-- BEFORE APPLYING: list EVERY existing overload of track_daily_usage, not just (text):
--   select oid::regprocedure, pg_get_functiondef(oid) from pg_proc
--    where pronamespace = 'public'::regnamespace and proname = 'track_daily_usage';
-- Fold any logic beyond the (student_id, usage_date) upsert into the body below,
-- and confirm the column list: this migration inserts only
-- (student_id, usage_date, faculty, platform) and will fail on any other
-- NOT NULL column without a default. Also confirm daily_active_usage does not
-- already have a faculty/platform column: `add column if not exists` would skip
-- it AND skip its CHECK silently.

-- Faculty and platform on the anonymous daily usage event, and an admin-only
-- aggregate. Seven faculties times four platforms is a coarse grouping of
-- thousands of installs; the row still carries only the random install id.
-- Nothing about the person is added. Counts are of INSTALLS, not people.

alter table public.daily_active_usage
  add column if not exists faculty  text check (faculty is null or char_length(faculty) <= 16),
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
  v_faculty  text := nullif(left(btrim(coalesce(p_faculty, '')), 16), '');
begin
  insert into public.daily_active_usage (student_id, usage_date, faculty, platform)
  values (p_student_id, current_date, v_faculty, v_platform)
  on conflict (student_id, usage_date) do update
    set faculty  = coalesce(excluded.faculty,  public.daily_active_usage.faculty),
        platform = coalesce(excluded.platform, public.daily_active_usage.platform);
end $$;
revoke all on function public.track_daily_usage(text, text, text) from public;
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
