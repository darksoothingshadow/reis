begin;

-- old one-argument call still works (released clients)
do $$ begin
  set local role anon;
  perform public.track_daily_usage('11111111-1111-1111-1111-111111111111');
  reset role;
end $$;

-- new call records faculty and platform
do $$
declare v_f text; v_p text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('22222222-2222-2222-2222-222222222222', 'PEF', 'ios');
  perform public.track_daily_usage('22222222-2222-2222-2222-222222222222', 'PEF', 'ios');
  reset role;
  select faculty, platform, open_count into v_f, v_p, v_n from public.daily_active_usage
   where student_id = '22222222-2222-2222-2222-222222222222' and usage_date = current_date;
  if v_n is distinct from 2 then raise exception 'open_count not incremented: %', v_n; end if;
  if v_f is distinct from 'PEF' or v_p is distinct from 'ios' then raise exception 'dimensions not stored: % %', v_f, v_p; end if;
end $$;

-- an unknown platform is refused, the row is still counted
do $$
declare v_p text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('33333333-3333-3333-3333-333333333333', null, 'toaster');
  reset role;
  select count(*), max(platform) into v_n, v_p from public.daily_active_usage
   where student_id = '33333333-3333-3333-3333-333333333333' and usage_date = current_date;
  if v_n <> 1 then raise exception 'row not counted: % rows', v_n; end if;
  if v_p is not null then raise exception 'invalid platform stored'; end if;
end $$;

-- an unknown faculty is refused, the row is still counted
do $$
declare v_f text; v_n int;
begin
  set local role anon;
  perform public.track_daily_usage('44444444-4444-4444-4444-444444444444', 'HOGWARTS', null);
  reset role;
  select count(*), max(faculty) into v_n, v_f from public.daily_active_usage
   where student_id = '44444444-4444-4444-4444-444444444444' and usage_date = current_date;
  if v_n <> 1 then raise exception 'row not counted: % rows', v_n; end if;
  if v_f is not null then raise exception 'invalid faculty stored'; end if;
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

-- usage_stats suppresses groups under five (runs as the connection's own role, which owns the function, so the role check inside usage_stats is bypassed by calling the unchecked helper directly)
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

-- the unchecked helper is not reachable by untrusted roles
do $$ begin
  set local role anon;
  begin
    perform public.usage_stats_unchecked(30);
    raise exception 'anon could call usage_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  reset role;
  set local role authenticated;
  begin
    perform public.usage_stats_unchecked(30);
    raise exception 'authenticated could call usage_stats_unchecked';
  exception when insufficient_privilege then null;
  end;
  reset role;
end $$;

rollback;
