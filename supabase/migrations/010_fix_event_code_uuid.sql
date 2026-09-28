-- =========================================================
-- 010 — Fix "function uuid_generate_v4() does not exist" on event create.
-- Run after 009. Idempotent; replaces two helper functions only.
--
-- events_before_write() runs with `search_path = public`, but on Supabase
-- the uuid-ossp extension (uuid_generate_v4) lives in the `extensions`
-- schema, so the event-code and share-token helpers it calls could not
-- resolve it and every activity insert failed. Use the built-in
-- gen_random_uuid() (pg_catalog, always on the path) and pin search_path.
-- =========================================================

begin;

create or replace function public.generate_event_code(category_key text, kelurahan text)
returns text language plpgsql set search_path = public as $$
declare
  cat_prefix text := coalesce(nullif(upper(left(regexp_replace(coalesce(category_key, ''), '[^a-zA-Z]', '', 'g'), 3)), ''), 'GEN');
  area_prefix text := coalesce(nullif(upper(left(regexp_replace(coalesce(kelurahan, ''), '[^a-zA-Z]', '', 'g'), 3)), ''), 'GEN');
  suffix text := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));
begin
  return cat_prefix || '-' || area_prefix || '-' || suffix;
end;
$$;

create or replace function public.generate_share_token()
returns text language sql set search_path = public as $$
  select 'JOIN-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
$$;

commit;
