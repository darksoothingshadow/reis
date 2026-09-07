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
-- Verified immediately before dropping: housing_posts 0 rows, 0 distinct
-- is_login; housing_rate_log 0 rows. No student identity is destroyed here
-- because none was ever collected.

drop function if exists public.close_housing_post(uuid, uuid);
drop function if exists public.submit_housing_post(text,text,text,int,date,date,text,text,text,text,uuid);
drop function if exists public.list_housing_posts();

drop table if exists public.housing_rate_log;
drop table if exists public.housing_posts;
