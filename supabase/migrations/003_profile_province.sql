-- =========================================================
-- 003 — Store the province on profiles (Province -> City -> Kecamatan ->
--       Kelurahan). Run after 002. Idempotent; keeps existing data.
-- =========================================================

begin;

alter table public.profiles
  add column if not exists province_id text,   -- BPS province code, e.g. '32'
  add column if not exists province text;      -- official name, e.g. 'Jawa Barat'

-- BPS codes are hierarchical, so existing profiles' province code can be
-- derived from their city code (3273 -> 32). The name is filled in the
-- next time the user saves their location.
update public.profiles
set province_id = left(city_id, 2)
where province_id is null and city_id is not null;

-- Same parent/child rule as profiles_region_hierarchy, one level up.
alter table public.profiles drop constraint if exists profiles_province_hierarchy;
alter table public.profiles add constraint profiles_province_hierarchy check (
  city_id is null or (province_id is not null and city_id like province_id || '%')
) not valid;

commit;
