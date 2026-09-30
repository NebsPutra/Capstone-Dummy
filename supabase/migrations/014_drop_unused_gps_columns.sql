-- =========================================================
-- 014 — Drop the unused profiles.last_lat / last_lng columns.
-- Run after 013. Idempotent.
--
-- These columns were never written with a real value: the app keeps the
-- user's GPS position only in the browser (localStorage) and never sends
-- coordinates to the server. Only the coarse kelurahan centre-point
-- (area_lat/area_lng) is stored. Removing the dead columns makes the schema
-- match the "GPS location is not stored on the server" design.
--
-- my_profile and staff_profiles are `select *` views, so they pin every
-- column and must be dropped before the column can go, then recreated (they
-- re-expand `*` to the remaining columns). admin_anonymize_user is recreated
-- without the columns too. The audit diff in 004 uses `to_jsonb(p) -
-- 'last_lat'`, a harmless no-op once the key is gone, so it needs no change.
-- =========================================================

begin;

create or replace function public.admin_anonymize_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(3);
  if p_user = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update public.profiles set
    full_name = null, nickname = null, bio = null, whatsapp_number = null, gender = null, age = null,
    avatar_url = null, province_id = null, province = null, city_id = null, city = null,
    kecamatan_id = null, kecamatan = null, kelurahan_id = null, kelurahan = null,
    area_lat = null, area_lng = null,
    username = 'deleted_' || substr(replace(id::text, '-', ''), 1, 10),
    account_status = 'deactivated', status_reason = 'anonymized', status_changed_at = now()
  where id = p_user;
  delete from public.user_interests where user_id = p_user;
  perform public._audit('user_anonymized', 'user', p_user::text);
end;
$$;

-- Views re-expand `select *`, so drop them, remove the columns, recreate them.
drop view if exists public.my_profile;
drop view if exists public.staff_profiles;

alter table public.profiles drop column if exists last_lat;
alter table public.profiles drop column if exists last_lng;

create view public.my_profile as
  select * from public.profiles where id = auth.uid();
create view public.staff_profiles as
  select * from public.profiles where public.is_staff();
revoke all on public.my_profile, public.staff_profiles from anon;
grant select on public.my_profile, public.staff_profiles to authenticated;

commit;
