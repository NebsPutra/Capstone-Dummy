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
-- admin_anonymize_user is recreated first (it set these columns to null);
-- the audit diff in 004 uses `to_jsonb(p) - 'last_lat'`, which is a harmless
-- no-op once the key no longer exists, so it needs no change.
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

alter table public.profiles drop column if exists last_lat;
alter table public.profiles drop column if exists last_lng;

commit;
