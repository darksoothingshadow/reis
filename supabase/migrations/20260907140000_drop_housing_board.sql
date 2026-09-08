-- Drop the student housing board.
--
-- The board reached `test` but was never released: e2f2485b is in no tag, and
-- v5.1.1 predates it. It was withdrawn before release because it was the only
-- reIS feature that asked a student to attach their IS login and IS person id
-- to something published to every other install — a posture the project does
-- not want to carry, and one that had already earned two entries in the
-- noStudentDataLeaves guard (SUPABASE_CALLERS and IDENTIFYING_EXCEPTIONS).
--
-- The prod grant is the reason this is a drop and not a code-only revert:
-- `submit_housing_post` was executable by anon and PUBLIC, and the anon key
-- ships in every released build. Removing the UI would not have closed that
-- write path. Dropping the functions does.
--
-- ORDER MATTERS, and the emptiness check is an assertion rather than a comment.
-- The RPCs go first, because they are the only way a row can be written; once
-- they are gone the tables can only shrink. The DO block then takes an ACCESS
-- EXCLUSIVE lock on each surviving table and RAISES if it holds anything, so a
-- replay against an environment that DOES have posts aborts the whole
-- migration instead of silently deleting student identities. Postgres runs a
-- migration in one transaction, so an abort rolls the function drops back too.
--
-- In prod this ran with housing_posts at 0 rows / 0 distinct is_login and
-- housing_rate_log at 0 rows, verified immediately beforehand: nothing was
-- destroyed there because nothing was ever collected.

drop function if exists public.close_housing_post(uuid, uuid);
drop function if exists public.submit_housing_post(text,text,text,int,date,date,text,text,text,text,uuid);
drop function if exists public.list_housing_posts();

do $$
declare
  tbl text;
  n bigint;
begin
  foreach tbl in array array['public.housing_posts', 'public.housing_rate_log'] loop
    if to_regclass(tbl) is null then
      continue;
    end if;
    execute format('lock table %s in access exclusive mode', tbl);
    execute format('select count(*) from %s', tbl) into n;
    if n > 0 then
      raise exception
        'Refusing to drop %: it holds % row(s). The reIS drop assumes an empty '
        'board — inspect and export before re-running.', tbl, n;
    end if;
  end loop;
end
$$;

drop table if exists public.housing_rate_log;
drop table if exists public.housing_posts;
