-- =========================================================
-- 002 — Auth/onboarding, structured location, event status,
--       capacity, fee and RLS fixes.
--
-- Run this in the Supabase SQL Editor AFTER schema.sql (fresh project)
-- or directly against an existing project. It is idempotent: safe to run
-- more than once, and it preserves existing rows (interests, categories,
-- events, participants, profiles).
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 0. SHARED HELPERS
-- ---------------------------------------------------------

-- Events store a local wall-clock date + time (no timezone). The product
-- operates in Indonesia, so "now" for event lifecycle purposes is Jakarta
-- time, never the server's UTC clock.
create or replace function public.jakarta_now()
returns timestamp
language sql stable
as $$ select (now() at time zone 'Asia/Jakarta') $$;

-- Great-circle distance in km (same formula/radius as src/lib/utils.ts).
create or replace function public.haversine_km(
  lat1 double precision, lng1 double precision,
  lat2 double precision, lng2 double precision
)
returns double precision
language sql immutable parallel safe
as $$
  select 2 * 6371 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  )));
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

-- ---------------------------------------------------------
-- 1. PROFILES — gender enum, structured location, onboarding state
-- ---------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'gender_type') then
    create type public.gender_type as enum ('male', 'female');
  end if;
end $$;

-- Convert the free-text gender column to the enum, normalizing any
-- existing values (including translated ones) instead of dropping them.
do $$
begin
  if (select data_type from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles' and column_name = 'gender') = 'text' then
    update public.profiles set gender = case
      when lower(trim(gender)) in ('male', 'm', 'l', 'laki-laki', 'laki laki', 'pria', 'man') then 'male'
      when lower(trim(gender)) in ('female', 'f', 'p', 'perempuan', 'wanita', 'woman') then 'female'
      else null
    end
    where gender is not null;
    alter table public.profiles
      alter column gender type public.gender_type using gender::public.gender_type;
  end if;
end $$;

alter table public.profiles
  add column if not exists city_id text,           -- BPS regency code, e.g. '3273'
  add column if not exists kecamatan_id text,      -- BPS district code, e.g. '3273010'
  add column if not exists kelurahan_id text,      -- BPS village code, e.g. '3273010001'
  add column if not exists area_lat double precision,  -- approximate centroid of the kelurahan
  add column if not exists area_lng double precision,  -- (used only as a manual-location fallback)
  add column if not exists onboarding_completed_at timestamptz;

-- The region codes are hierarchical (village code starts with its district
-- code, which starts with its regency code). Enforce that so a kelurahan
-- can never be paired with a kecamatan from another city.
-- NOT VALID: applies to new/updated rows without rejecting legacy rows.
alter table public.profiles drop constraint if exists profiles_region_hierarchy;
alter table public.profiles add constraint profiles_region_hierarchy check (
  (kecamatan_id is null or (city_id is not null and kecamatan_id like city_id || '%'))
  and (kelurahan_id is null or (kecamatan_id is not null and kelurahan_id like kecamatan_id || '%'))
) not valid;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles add constraint profiles_bio_length
  check (bio is null or char_length(bio) <= 160) not valid;

-- Legacy accounts that already finished the old one-page registration are
-- treated as onboarded so they aren't forced back through setup.
update public.profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, created_at)
where onboarding_completed_at is null
  and (role = 'admin' or (full_name is not null and primary_interest_id is not null));

-- Profiles are now created by a trigger on auth.users (the auth account
-- exists first, profile details are filled in afterwards).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  base text;
  candidate text;
  attempts int := 0;
begin
  base := left(lower(regexp_replace(split_part(coalesce(new.email, ''), '@', 1), '[^a-zA-Z0-9_]', '', 'g')), 20);
  if base is null or length(base) < 3 then
    base := 'user' || coalesce(base, '');
  end if;

  candidate := base;
  while exists (select 1 from public.profiles where username = candidate) loop
    attempts := attempts + 1;
    if attempts > 20 then
      candidate := base || '_' || replace(new.id::text, '-', '');
      exit;
    end if;
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into public.profiles (id, username, role)
  values (new.id, candidate, 'participant')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill: auth users whose profile insert failed under the old flow.
insert into public.profiles (id, username, role)
select u.id, 'user_' || substr(replace(u.id::text, '-', ''), 1, 12), 'participant'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Users could previously promote themselves to admin with a plain
-- UPDATE (the RLS policy allows editing your own row). Lock down the
-- privileged columns; only admins / the service role may change them.
create or replace function public.profiles_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  -- auth.uid() is null for the service role, SQL editor and auth triggers.
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.role := 'participant';
    new.onboarding_completed_at := null;
  else
    new.id := old.id;
    new.role := old.role;
    new.username := old.username;
    -- Only set_user_interests() (the final onboarding step) may mark
    -- onboarding as complete.
    if coalesce(current_setting('komunitas.onboarding', true), '') <> 'on' then
      new.onboarding_completed_at := old.onboarding_completed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard
before insert or update on public.profiles
for each row execute function public.profiles_guard();

-- The trigger creates profiles now; clients no longer insert them.
drop policy if exists "users can insert own profile" on public.profiles;

create or replace function public.is_onboarded()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and (onboarding_completed_at is not null or role = 'admin')
  );
$$;

-- Final onboarding step + profile interest editing, atomically.
create or replace function public.set_user_interests(p_interest_ids uuid[], p_primary uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_interest_ids is null or array_length(p_interest_ids, 1) is null then
    raise exception 'INTERESTS_REQUIRED';
  end if;
  if p_primary is null or not (p_primary = any (p_interest_ids)) then
    raise exception 'PRIMARY_NOT_SELECTED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  -- A first-time registrant must have finished the personal-info step.
  if v_profile.onboarding_completed_at is null and (
       coalesce(trim(v_profile.full_name), '') = ''
    or coalesce(trim(v_profile.nickname), '') = ''
    or coalesce(trim(v_profile.whatsapp_number), '') = ''
    or v_profile.gender is null
    or v_profile.city_id is null
    or v_profile.kecamatan_id is null
    or v_profile.kelurahan_id is null
    or coalesce(trim(v_profile.bio), '') = ''
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  delete from public.user_interests
  where user_id = v_uid and interest_id <> all (p_interest_ids);

  insert into public.user_interests (user_id, interest_id)
  select v_uid, i from unnest(p_interest_ids) as i
  on conflict do nothing;

  perform set_config('komunitas.onboarding', 'on', true);
  update public.profiles
  set primary_interest_id = p_primary,
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_uid;
end;
$$;

-- Used by the Sign In / Sign Up email step to tell "no account" apart
-- from "account exists". Returns only a coarse status, never user data.
-- Note: like any "account not found" UX, this allows email enumeration;
-- Supabase's built-in auth rate limits still apply to the next steps.
create or replace function public.auth_email_status(p_email text)
returns text
language sql stable security definer set search_path = public, auth
as $$
  select coalesce(
    (select case when u.email_confirmed_at is null then 'unconfirmed' else 'confirmed' end
     from auth.users u
     where lower(u.email) = lower(trim(p_email))
     limit 1),
    'none'
  );
$$;
grant execute on function public.auth_email_status(text) to anon, authenticated;

-- ---------------------------------------------------------
-- 2. EVENTS — denormalized participant count, status integrity
-- ---------------------------------------------------------

-- Participant rows are only visible to the organizer and the participant
-- themself (RLS), so counting them from the client returned 0/1 for
-- everyone else. Keep an authoritative count on the event row.
alter table public.events
  add column if not exists participant_count int not null default 0;

alter table public.events drop constraint if exists events_fee_non_negative;
alter table public.events add constraint events_fee_non_negative check (fee >= 0) not valid;

alter table public.events drop constraint if exists events_time_order;
alter table public.events add constraint events_time_order check (end_time > start_time) not valid;

create index if not exists events_privacy_date_idx on public.events (privacy, event_date);
create index if not exists event_participants_event_status_idx
  on public.event_participants (event_id, status);

create or replace function public.generate_event_code(category_key text, kelurahan text)
returns text language plpgsql as $$
declare
  cat_prefix text := coalesce(nullif(upper(left(regexp_replace(coalesce(category_key, ''), '[^a-zA-Z]', '', 'g'), 3)), ''), 'GEN');
  area_prefix text := coalesce(nullif(upper(left(regexp_replace(coalesce(kelurahan, ''), '[^a-zA-Z]', '', 'g'), 3)), ''), 'GEN');
  suffix text := upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 4));
begin
  return cat_prefix || '-' || area_prefix || '-' || suffix;
end;
$$;

-- Capacity-derived status. The explicit ::event_status casts matter: a
-- CASE over bare string literals resolves to type text, and Postgres has
-- no implicit text -> enum cast. That was the root cause of
--   column "status" is of type event_status but expression is of type text
-- raised by the old refresh_event_status() trigger on every join.
create or replace function public.capacity_status(p_count int, p_max int)
returns event_status
language sql immutable
as $$
  select case
    when p_count >= p_max then 'full'::event_status
    when p_count >= p_max * 0.8 then 'almost_full'::event_status
    else 'open'::event_status
  end;
$$;

create or replace function public.approved_count(p_event_id uuid)
returns int
language sql stable security definer set search_path = public
as $$
  select count(*)::int from public.event_participants
  where event_id = p_event_id and status = 'approved';
$$;

-- Single source of truth for server-managed event columns. Clients can
-- no longer choose their own codes, forge a status or a participant
-- count, or re-assign an event to another creator.
create or replace function public.events_before_write()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_cat text;
  v_kel text;
  attempts int := 0;
begin
  if tg_op = 'INSERT' then
    select key into v_cat from public.categories where id = new.category_id;
    select kelurahan into v_kel from public.profiles where id = new.creator_id;

    loop
      new.event_code := public.generate_event_code(v_cat, v_kel);
      exit when not exists (select 1 from public.events where event_code = new.event_code);
      attempts := attempts + 1;
      if attempts > 25 then raise exception 'Could not generate a unique event code'; end if;
    end loop;

    attempts := 0;
    loop
      new.share_token := public.generate_share_token();
      exit when not exists (select 1 from public.events where share_token = new.share_token);
      attempts := attempts + 1;
      if attempts > 25 then raise exception 'Could not generate a unique share token'; end if;
    end loop;

    new.participant_count := 0;
    new.status := 'open'::event_status;
  else
    new.id := old.id;
    new.creator_id := old.creator_id;
    new.event_code := old.event_code;
    new.share_token := old.share_token;
    new.created_at := old.created_at;
    new.participant_count := public.approved_count(new.id);
    -- 'cancelled' is the only status a person sets; everything else is
    -- derived from capacity here, and ongoing/completed from the clock
    -- at read time (see event_phase / src/lib/events.ts).
    if new.status is distinct from 'cancelled'::event_status then
      new.status := public.capacity_status(new.participant_count, new.max_participants);
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_events_before_write on public.events;
create trigger trg_events_before_write
before insert or update on public.events
for each row execute function public.events_before_write();

-- Participant changes just "touch" the event; events_before_write does the
-- recount. security definer: the joining user can't UPDATE someone else's
-- event under RLS, which previously made the status update a silent no-op.
create or replace function public.refresh_event_status()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  update public.events set updated_at = now()
  where id = coalesce(new.event_id, old.event_id);
  return null;
end;
$$;

-- Recompute count + status for every existing event (also normalizes any
-- stale 'ongoing'/'completed' values that were stored but never updated).
update public.events set updated_at = updated_at;

create or replace function public.event_phase(e public.events)
returns text
language sql stable
as $$
  select case
    when e.status = 'cancelled' then 'cancelled'
    when public.jakarta_now() >= (e.event_date + e.end_time) then 'completed'
    when public.jakarta_now() >= (e.event_date + e.start_time) then 'ongoing'
    else e.status::text
  end;
$$;

-- ---------------------------------------------------------
-- 3. JOIN / LEAVE / APPROVE — server-side, race-safe
-- ---------------------------------------------------------

create or replace function public.join_event(p_event_id uuid, p_token text default null)
returns participation_status
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_event public.events;
  v_existing public.event_participants;
  v_status participation_status;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_onboarded() then raise exception 'PROFILE_INCOMPLETE'; end if;

  -- Row lock serializes concurrent joins on the same event, so two people
  -- can't both take the last spot.
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;

  if v_event.creator_id = v_uid then raise exception 'OWNER_CANNOT_JOIN'; end if;

  select * into v_existing from public.event_participants
  where event_id = p_event_id and user_id = v_uid;

  -- An invite (share token / event code) bypasses discovery, not rules:
  -- private events still need it, approval-required events still need approval.
  if v_event.privacy = 'private' and v_existing.id is null and (
       p_token is null
    or (upper(trim(p_token)) <> v_event.share_token and upper(trim(p_token)) <> v_event.event_code)
  ) then
    raise exception 'INVITE_REQUIRED';
  end if;

  if v_event.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if public.jakarta_now() >= (v_event.event_date + v_event.start_time) then
    raise exception 'EVENT_STARTED';
  end if;

  if v_existing.id is not null then
    if v_existing.status = 'rejected' then raise exception 'REQUEST_REJECTED'; end if;
    if v_existing.status in ('approved', 'pending') then return v_existing.status; end if;
  end if;

  if public.approved_count(p_event_id) >= v_event.max_participants then
    raise exception 'EVENT_FULL';
  end if;

  v_status := case when v_event.join_permission = 'open'
                   then 'approved'::participation_status
                   else 'pending'::participation_status end;

  insert into public.event_participants (event_id, user_id, status)
  values (p_event_id, v_uid, v_status)
  on conflict (event_id, user_id)
  do update set status = excluded.status, joined_at = now();

  return v_status;
end;
$$;

create or replace function public.leave_event(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_event public.events;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_event from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if public.jakarta_now() >= (v_event.event_date + v_event.start_time) then
    raise exception 'EVENT_STARTED';
  end if;
  delete from public.event_participants
  where event_id = p_event_id and user_id = auth.uid() and status in ('pending', 'approved');
end;
$$;

-- Organizer (or admin) approves / rejects a request. Approval re-checks
-- capacity under the same row lock as join_event.
create or replace function public.set_participant_status(p_participant_id uuid, p_status participation_status)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_row public.event_participants;
  v_event public.events;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_status not in ('approved', 'rejected') then raise exception 'INVALID_STATUS'; end if;

  select * into v_row from public.event_participants where id = p_participant_id;
  if not found then raise exception 'PARTICIPANT_NOT_FOUND'; end if;

  select * into v_event from public.events where id = v_row.event_id for update;
  if v_event.creator_id <> auth.uid() and not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  if v_event.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;

  if p_status = 'approved' and v_row.status <> 'approved'
     and public.approved_count(v_event.id) >= v_event.max_participants then
    raise exception 'EVENT_FULL';
  end if;

  update public.event_participants set status = p_status where id = p_participant_id;
end;
$$;

create or replace function public.remove_participant(p_participant_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_event_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select event_id into v_event_id from public.event_participants where id = p_participant_id;
  if v_event_id is null then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  if not public.is_event_owner(v_event_id) and not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  delete from public.event_participants where id = p_participant_id;
end;
$$;

create or replace function public.cancel_event(p_event_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_event_owner(p_event_id) and not public.is_admin() then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.events set status = 'cancelled'::event_status where id = p_event_id;
end;
$$;

-- ---------------------------------------------------------
-- 4. DISCOVERY — nearby search + invite resolution
-- ---------------------------------------------------------

-- Public, not-cancelled, not-yet-finished events within p_radius_km.
-- A bounding box on the indexed lat/lng columns prunes rows before the
-- exact haversine check; the boundary is inclusive (exactly 20 km shows).
-- security invoker: RLS still applies.
create or replace function public.nearby_events(
  p_lat double precision,
  p_lng double precision,
  p_radius_km double precision default 20,
  p_limit int default 100
)
returns setof public.events
language sql stable set search_path = public
as $$
  select e.*
  from public.events e
  where e.privacy = 'public'
    and e.status <> 'cancelled'
    and (e.event_date + e.end_time) > public.jakarta_now()
    and e.latitude is not null and e.longitude is not null
    and e.latitude between p_lat - (p_radius_km / 111.195) * 1.01
                       and p_lat + (p_radius_km / 111.195) * 1.01
    and e.longitude between p_lng - (p_radius_km / (111.195 * greatest(cos(radians(p_lat)), 0.01))) * 1.01
                        and p_lng + (p_radius_km / (111.195 * greatest(cos(radians(p_lat)), 0.01))) * 1.01
    -- + 1e-9 km (a micrometre) absorbs floating-point error, so an event
    -- exactly on the boundary (20.000000000000046 km) still counts as 20 km.
    and public.haversine_km(p_lat, p_lng, e.latitude, e.longitude) <= p_radius_km + 1e-9
  order by public.haversine_km(p_lat, p_lng, e.latitude, e.longitude), e.event_date, e.start_time
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

-- Resolve an invite (share token or event code) to its event, including
-- private events, with no distance restriction. Signed-in users only.
create or replace function public.get_event_by_token(token text)
returns setof public.events
language sql stable security definer set search_path = public
as $$
  select * from public.events
  where auth.uid() is not null
    and (share_token = upper(trim(token)) or event_code = upper(trim(token)))
  limit 1;
$$;
revoke execute on function public.get_event_by_token(text) from public, anon;
grant execute on function public.get_event_by_token(text) to authenticated;

-- ---------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------

-- Only fully registered users create events.
drop policy if exists "authenticated users can create events" on public.events;
drop policy if exists "onboarded users can create events" on public.events;
create policy "onboarded users can create events" on public.events
  for insert with check (auth.uid() = creator_id and public.is_onboarded());

-- Participation writes go through join_event / set_participant_status
-- (which enforce capacity, privacy and approval). Previously a user could
-- INSERT themselves as 'approved' on an approval-required or full event,
-- or UPDATE their own pending request to 'approved'.
drop policy if exists "users can join events" on public.event_participants;
drop policy if exists "users can update own participation" on public.event_participants;
drop policy if exists "users can cancel own participation" on public.event_participants;
drop policy if exists "users can leave own participation" on public.event_participants;
create policy "users can leave own participation" on public.event_participants
  for delete using (user_id = auth.uid() and status in ('pending', 'approved'));

commit;
