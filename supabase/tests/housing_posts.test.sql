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
