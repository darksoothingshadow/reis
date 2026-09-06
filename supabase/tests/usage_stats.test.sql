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
