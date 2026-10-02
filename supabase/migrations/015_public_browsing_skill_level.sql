-- 015: Public (logged-out) browsing of public activities + skill level.
-- Idempotent. Run in the Supabase SQL editor before deploying the app code
-- that uses it (the app selects events.skill_level).

-- 1. Skill level shown as a label on cards ("Beginner-friendly", "All levels", "Experienced").
alter table public.events
  add column if not exists skill_level text not null default 'all';
alter table public.events drop constraint if exists events_skill_level_check;
alter table public.events
  add constraint events_skill_level_check check (skill_level in ('beginner', 'all', 'experienced'));

-- 2. Logged-out visitors (anon role) may read public activities, but only
--    safe columns. Before this, anon could read every column of public events
--    through the API, including the organizer's WhatsApp number (whatever
--    whatsapp_public said), contact notes and the share token.
--    RLS ("public events readable") already limits anon to privacy = 'public'.
revoke select on public.events from anon;
grant select (
  id, event_code, category_id, title, description, banner_url,
  event_date, start_time, end_time, max_participants, fee,
  location_name, address, latitude, longitude,
  privacy, join_permission, status, participant_count, skill_level, created_at
) on public.events to anon;

-- 3. Invite links (/join/<share_token>) and event codes for logged-out
--    visitors: resolve to the id of a PUBLIC activity only. Private
--    activities still need sign-in (get_event_by_token, authenticated only).
create or replace function public.public_event_id(token text)
returns uuid
language sql stable security definer set search_path = public
as $$
  select id from public.events
  where privacy = 'public'
    and (share_token = upper(trim(token)) or event_code = upper(trim(token)))
  limit 1;
$$;
revoke execute on function public.public_event_id(text) from public;
grant execute on function public.public_event_id(text) to anon, authenticated;
