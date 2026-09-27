-- =========================================================
-- 007 — Lock down direct reads of other people's profile data.
--
-- Run AFTER migration 006 AND after the matching app version is deployed
-- (the app reads its own profile through the my_profile view from then on).
--
-- Before: any signed-in user could read every profile column of every user
-- through the API (full name, WhatsApp number, age, exact area...).
-- After: other users' rows expose only id, username, nickname and avatar.
-- Everything else is available only through my_profile (own row),
-- staff_profiles (staff) and the privacy-aware functions from 006.
-- Idempotent; to undo: grant select on public.profiles to authenticated;
-- =========================================================

begin;

revoke select on public.profiles from anon, authenticated;
grant select (id, username, nickname, avatar_url) on public.profiles to authenticated;

-- Views are recreated so they pick up every current profile column.
create or replace view public.my_profile as
  select * from public.profiles where id = auth.uid();
create or replace view public.staff_profiles as
  select * from public.profiles where public.is_staff();
revoke all on public.my_profile, public.staff_profiles from anon;
grant select on public.my_profile, public.staff_profiles to authenticated;

commit;
