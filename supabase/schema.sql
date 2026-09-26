-- =========================================================
-- COMMUNITY SOCIAL ACTIVITY PLATFORM — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`),
-- THEN run supabase/migrations/002_auth_location_events.sql, which replaces
-- several functions/policies below (including the fix for the event_status
-- cast bug in refresh_event_status).
-- =========================================================

create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------
create type user_role as enum ('admin', 'participant');
create type event_privacy as enum ('public', 'private');
create type join_permission as enum ('open', 'approval_required');
create type event_status as enum ('open', 'almost_full', 'full', 'ongoing', 'completed', 'cancelled');
create type participation_status as enum ('pending', 'approved', 'rejected', 'cancelled');

-- ---------------------------------------------------------
-- PROFILES  (1:1 with auth.users)
-- ---------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  role user_role not null default 'participant',
  full_name text,
  nickname text,
  age int,
  gender text,
  whatsapp_number text,
  kelurahan text,
  kecamatan text,
  city text,
  bio text,
  avatar_url text,
  primary_interest_id uuid,
  -- last known coarse location, only ever set from the browser at request time
  last_lat double precision,
  last_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------
-- INTERESTS (fixed catalog, matches Section 4 of spec)
-- ---------------------------------------------------------
create table public.interests (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,       -- e.g. 'running'
  label text not null,            -- e.g. 'Running'
  emoji text not null
);

insert into public.interests (key, label, emoji) values
  ('reading', 'Reading', '📚'),
  ('running', 'Running', '🏃'),
  ('walking', 'Walking', '🚶'),
  ('cycling', 'Cycling', '🚴'),
  ('basketball', 'Basketball', '🏀'),
  ('badminton', 'Badminton', '🏸'),
  ('futsal', 'Futsal', '⚽'),
  ('fitness', 'Fitness', '🏋'),
  ('gaming', 'Gaming', '🎮'),
  ('art', 'Art', '🎨'),
  ('music', 'Music', '🎵'),
  ('social', 'Social activities', '🌱'),
  ('other', 'Other', '✨');

alter table public.profiles
  add constraint profiles_primary_interest_fk
  foreign key (primary_interest_id) references public.interests(id);

create table public.user_interests (
  user_id uuid references public.profiles(id) on delete cascade,
  interest_id uuid references public.interests(id) on delete cascade,
  primary key (user_id, interest_id)
);

-- ---------------------------------------------------------
-- EVENT CATEGORIES (Section 15)
-- ---------------------------------------------------------
create table public.categories (
  id uuid primary key default uuid_generate_v4(),
  key text unique not null,
  label text not null,
  emoji text not null
);

insert into public.categories (key, label, emoji) values
  ('reading_together', 'Reading Together', '📚'),
  ('book_discussion', 'Book Discussion', '📖'),
  ('group_run', 'Group Run', '🏃'),
  ('walking', 'Walking', '🚶'),
  ('cycling', 'Cycling', '🚴'),
  ('badminton', 'Badminton', '🏸'),
  ('basketball', 'Basketball', '🏀'),
  ('futsal', 'Futsal', '⚽'),
  ('gaming', 'Gaming', '🎮'),
  ('community_gathering', 'Community Gathering', '🤝'),
  ('social_activity', 'Social Activity', '❤️'),
  ('other', 'Other', '✨');

-- ---------------------------------------------------------
-- EVENTS
-- ---------------------------------------------------------
create table public.events (
  id uuid primary key default uuid_generate_v4(),
  event_code text unique not null,       -- e.g. RUN-KRG-8F72
  share_token text unique not null,      -- e.g. JOIN-7X82KD

  creator_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),

  title text not null,
  description text,
  banner_url text,

  event_date date not null,
  start_time time not null,
  end_time time not null,

  max_participants int not null check (max_participants > 0),
  fee numeric(12,2) not null default 0,

  location_name text not null,
  address text,
  latitude double precision not null,
  longitude double precision not null,

  pic_name text not null,
  pic_whatsapp text not null,
  pic_contact_instructions text,
  whatsapp_public boolean not null default false,

  privacy event_privacy not null default 'public',
  join_permission join_permission not null default 'open',
  status event_status not null default 'open',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_date_idx on public.events (event_date);
create index events_category_idx on public.events (category_id);
create index events_location_idx on public.events (latitude, longitude);

-- ---------------------------------------------------------
-- EVENT PARTICIPANTS
-- ---------------------------------------------------------
create table public.event_participants (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status participation_status not null default 'approved',
  joined_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------------------------------------------------------
-- HELPER: generate short human-readable codes
-- ---------------------------------------------------------
create or replace function public.generate_event_code(category_key text, kelurahan text)
returns text language plpgsql as $$
declare
  cat_prefix text := upper(left(regexp_replace(category_key, '[^a-zA-Z]', '', 'g'), 3));
  area_prefix text := upper(left(coalesce(regexp_replace(kelurahan, '[^a-zA-Z]', '', 'g'), 'GEN'), 3));
  suffix text := upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 4));
begin
  return cat_prefix || '-' || area_prefix || '-' || suffix;
end;
$$;

create or replace function public.generate_share_token()
returns text language sql as $$
  select 'JOIN-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 6));
$$;

-- ---------------------------------------------------------
-- Auto-update event status based on participant count
-- ---------------------------------------------------------
create or replace function public.refresh_event_status()
returns trigger language plpgsql as $$
declare
  ev record;
  approved_count int;
begin
  select * into ev from public.events where id = coalesce(new.event_id, old.event_id);
  if ev.status in ('completed', 'cancelled') then
    return null;
  end if;

  select count(*) into approved_count
  from public.event_participants
  where event_id = ev.id and status = 'approved';

  update public.events
  set status = case
    when approved_count >= ev.max_participants then 'full'
    when approved_count >= (ev.max_participants * 0.8) then 'almost_full'
    else 'open'
  end
  where id = ev.id;

  return null;
end;
$$;

create trigger trg_refresh_event_status
after insert or update or delete on public.event_participants
for each row execute function public.refresh_event_status();

-- ---------------------------------------------------------
-- updated_at touch trigger
-- ---------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();

create trigger trg_events_updated_at before update on public.events
for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY
-- ---------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.user_interests enable row level security;
alter table public.events enable row level security;
alter table public.event_participants enable row level security;
alter table public.interests enable row level security;
alter table public.categories enable row level security;

-- Reference tables: readable by everyone (incl. anon)
create policy "interests are public read" on public.interests for select using (true);
create policy "categories are public read" on public.categories for select using (true);

-- Profiles: public fields readable by any authenticated user; own row fully editable
create policy "profiles readable by authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

create policy "users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

create policy "users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- user_interests: owner manages their own rows; readable by authenticated users
create policy "user_interests readable" on public.user_interests
  for select using (auth.role() = 'authenticated');

create policy "user_interests owner write" on public.user_interests
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Security-definer helpers: used below to check event ownership /
-- participation from within RLS policies without triggering recursive
-- RLS evaluation on the other table (these bypass RLS internally).
create or replace function public.is_event_owner(_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = _event_id and e.creator_id = auth.uid()
  );
$$;

create or replace function public.is_event_participant(_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.event_id = _event_id and ep.user_id = auth.uid()
  );
$$;

-- Events: public events readable by anyone authenticated; private events
-- are only readable by their creator or participants (app also gates via
-- share_token lookups using a security-definer function, see below).
create policy "public events readable" on public.events
  for select using (
    privacy = 'public'
    or creator_id = auth.uid()
    or public.is_event_participant(id)
  );

create policy "authenticated users can create events" on public.events
  for insert with check (auth.uid() = creator_id);

create policy "creator can update own event" on public.events
  for update using (auth.uid() = creator_id);

create policy "creator can delete own event" on public.events
  for delete using (auth.uid() = creator_id);

-- Event participants: visible to the event's creator and to the participant themself
create policy "participants visible to creator or self" on public.event_participants
  for select using (
    user_id = auth.uid()
    or public.is_event_owner(event_id)
  );

create policy "users can join events" on public.event_participants
  for insert with check (user_id = auth.uid());

create policy "users can update own participation" on public.event_participants
  for update using (
    user_id = auth.uid()
    or public.is_event_owner(event_id)
  );

create policy "users can cancel own participation" on public.event_participants
  for delete using (user_id = auth.uid());

-- ---------------------------------------------------------
-- Security-definer lookup so a private event can be opened via
-- share token / event code without exposing all private events.
-- ---------------------------------------------------------
create or replace function public.get_event_by_token(token text)
returns setof public.events
language sql security definer as $$
  select * from public.events where share_token = token or event_code = token;
$$;
