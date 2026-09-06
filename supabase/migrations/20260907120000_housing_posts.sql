-- Housing board: students hand rooms to students.
--
-- Identity travels only with an action the student took on purpose: the
-- poster's IS login and IS person id are attached after an explicit consent
-- tick, shown to every reIS user (any reader can verify the poster in IS).
-- The post stops being listed 14 days after publishing (expires_at > now()),
-- or immediately when the owner closes it. The row itself is deleted lazily,
-- by the sweep at the top of the NEXT call to submit_housing_post anywhere in
-- the database, once expires_at is more than a day in the past -- i.e. from
-- day 15 onward. On a quiet board with no submissions after that point, the
-- row can persist well past day 15; it is simply never listed. Nothing about
-- who READS the board is recorded. install_id is the same random per-install
-- UUID event_rsvps uses; it exists only so the device that published a post
-- can close it, and it is never returned by the list RPC.

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

create index housing_posts_live_idx on public.housing_posts (created_at desc)
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
  -- Serialise per install so check-then-insert cannot race. This lock is
  -- scoped to one install_id: it makes the check-then-insert below atomic
  -- for that install, but the two sweeps just below are not serialised
  -- against sweeps running concurrently for other installs (each install
  -- takes a different lock key). Two submissions from different installs
  -- can therefore run their sweeps at the same time; both deletes are plain
  -- idempotent range deletes, so the only cost is occasional duplicate work,
  -- never a wrong count. Accepted at this traffic level rather than taking a
  -- table-wide lock for every submission.
  perform pg_advisory_xact_lock(hashtext(p_install_id::text));

  -- Opportunistic sweeps: expired posts really disappear, and the rate log
  -- forgets after an hour. Same approach as set_event_rsvp.
  delete from public.housing_posts where expires_at < now() - interval '1 day';
  delete from public.housing_rate_log where created_at < now() - interval '1 hour';

  select count(*) into v_recent from public.housing_rate_log
   where install_id = p_install_id and created_at > now() - interval '1 hour';
  if v_recent >= 5 then return null; end if;

  -- Charge the attempt to the hourly cap before checking anything else, so
  -- every call that reaches this point counts toward the 5/hour limit --
  -- including one later refused by the live-posts cap or by a bad enum/check
  -- value. Otherwise a caller hammering an already-full board (3 live posts)
  -- would never be charged and could retry forever without ever tripping the
  -- rate limit; charging first makes the cap bound total attempts, not just
  -- successful ones.
  insert into public.housing_rate_log (install_id) values (p_install_id);

  select count(*) into v_live from public.housing_posts
   where install_id = p_install_id and expires_at > now();
  if v_live >= 3 then return null; end if;

  begin
    insert into public.housing_posts
      (kind, room_type, district, price_czk, free_from, free_until, note, contact, is_login, is_person_id, install_id)
    values
      (p_kind, p_room_type, btrim(p_district), p_price_czk, p_free_from, p_free_until,
       coalesce(btrim(p_note), ''), btrim(p_contact), btrim(p_is_login), p_is_person_id, p_install_id)
    returning id into v_id;
  exception
    when check_violation or not_null_violation then return null;
  end;
  return v_id;
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
