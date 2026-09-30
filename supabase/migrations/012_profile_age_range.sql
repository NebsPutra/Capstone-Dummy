-- =========================================================
-- 012 — Keep profiles.age in a sensible range (13–100).
-- Run after 011. Idempotent.
--
-- The app now asks users for their age (profile editor + dashboard
-- reminder). The same range is checked in src/lib/validation.ts.
-- NOT VALID: existing rows aren't re-checked, only new writes.
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_age_range') then
    alter table public.profiles
      add constraint profiles_age_range check (age is null or age between 13 and 100) not valid;
  end if;
end $$;
