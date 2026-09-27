-- =========================================================
-- 006 — Usernames, privacy settings, friends, blocks, social links,
-- public profiles and social analytics. Run after 005. Idempotent; adds only.
--
-- Everything another member can learn about a user goes through the
-- security-definer functions below, which apply that user's privacy
-- settings and blocks. Migration 007 then removes direct API access to the
-- sensitive profile columns (deploy the app code between 006 and 007).
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. USERNAMES
-- ---------------------------------------------------------

alter table public.profiles add column if not exists username_changed_at timestamptz;

-- Case-insensitive uniqueness (skipped, with a notice, if old data has
-- case-only duplicates; set_username() still checks case-insensitively).
do $$
begin
  if not exists (select 1 from pg_indexes where schemaname = 'public' and indexname = 'profiles_username_lower_key') then
    if exists (select lower(username) from public.profiles group by 1 having count(*) > 1) then
      raise notice 'profiles_username_lower_key not created: case-duplicate usernames exist';
    else
      create unique index profiles_username_lower_key on public.profiles (lower(username));
    end if;
  end if;
end $$;

create table if not exists public.reserved_usernames (
  name text primary key check (name = lower(name)),
  created_at timestamptz not null default now()
);
alter table public.reserved_usernames enable row level security;
drop policy if exists "staff read reserved usernames" on public.reserved_usernames;
create policy "staff read reserved usernames" on public.reserved_usernames for select using (public.is_staff());

insert into public.reserved_usernames (name)
select unnest(array[
  'admin', 'administrator', 'root', 'system', 'sysadmin', 'support', 'help', 'helpdesk', 'komunitas', 'official',
  'staff', 'moderator', 'mod', 'security', 'api', 'www', 'mail', 'email', 'login', 'logout', 'register', 'signup',
  'signin', 'settings', 'profile', 'profiles', 'dashboard', 'explore', 'create', 'community', 'notifications',
  'messages', 'inbox', 'friends', 'u', 'user', 'users', 'me', 'null', 'undefined', 'anonymous', 'deleted',
  'everyone', 'account', 'billing', 'privacy', 'terms', 'about', 'contact', 'team', 'owner', 'verified'])
on conflict do nothing;

create table if not exists public.username_history (
  id bigserial primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  old_username text not null,
  new_username text not null,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists username_history_old_idx on public.username_history (lower(old_username), created_at desc);
create index if not exists username_history_user_idx on public.username_history (user_id, created_at desc);
alter table public.username_history enable row level security;
drop policy if exists "own or staff username history" on public.username_history;
create policy "own or staff username history" on public.username_history for select using (user_id = auth.uid() or public.is_staff());

-- 'invalid' | 'reserved' | 'taken' | 'current' | 'available'
create or replace function public._username_status(p_name text, p_user uuid, p_ignore_reserved boolean default false)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  n text := lower(regexp_replace(trim(coalesce(p_name, '')), '^@', ''));
begin
  if n !~ '^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$' or n like '%\_\_%' then return 'invalid'; end if;
  if exists (select 1 from public.profiles where id = p_user and lower(username) = n) then return 'current'; end if;
  if not p_ignore_reserved and (
       exists (select 1 from public.reserved_usernames where name = n)
       or n ~ '^(admin|komunitas|official|support|moderator|staff|deleted)') then
    return 'reserved';
  end if;
  if exists (select 1 from public.profiles where lower(username) = n and id <> coalesce(p_user, '00000000-0000-0000-0000-000000000000'::uuid)) then
    return 'taken';
  end if;
  -- A name someone else gave up in the last 30 days stays theirs (anti-impersonation).
  if exists (select 1 from public.username_history h
             where lower(h.old_username) = n and h.user_id <> coalesce(p_user, '00000000-0000-0000-0000-000000000000'::uuid)
               and h.created_at > now() - interval '30 days') then
    return 'taken';
  end if;
  return 'available';
end;
$$;

create or replace function public.username_available(p_username text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return jsonb_build_object(
    'status', public._username_status(p_username, auth.uid()),
    'normalized', lower(regexp_replace(trim(coalesce(p_username, '')), '^@', '')),
    'next_change_at', (select username_changed_at + interval '30 days' from public.profiles
                       where id = auth.uid() and onboarding_completed_at is not null
                         and username_changed_at > now() - interval '30 days'));
end;
$$;

-- Change your own username. Free during registration; afterwards once per 30 days.
create or replace function public.set_username(p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_me public.profiles;
  v_new text := lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
  v_status text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_me from public.profiles where id = v_uid for update;
  if v_me.account_status <> 'active' then raise exception 'ACCOUNT_SUSPENDED'; end if;
  v_status := public._username_status(v_new, v_uid);
  if v_status = 'current' then return v_me.username; end if;
  if v_status = 'invalid' then raise exception 'USERNAME_INVALID'; end if;
  if v_status = 'reserved' then raise exception 'USERNAME_RESERVED'; end if;
  if v_status = 'taken' then raise exception 'USERNAME_TAKEN'; end if;
  if v_me.onboarding_completed_at is not null and v_me.username_changed_at > now() - interval '30 days' then
    raise exception 'USERNAME_COOLDOWN';
  end if;

  insert into public.username_history (user_id, old_username, new_username, changed_by)
  values (v_uid, v_me.username, v_new, v_uid);
  perform set_config('komunitas.username', 'on', true);
  begin
    update public.profiles
      set username = v_new,
          username_changed_at = case when onboarding_completed_at is not null then now() else username_changed_at end
      where id = v_uid;
  exception when unique_violation then
    raise exception 'USERNAME_TAKEN';
  end;
  perform set_config('komunitas.username', '', true);
  return v_new;
end;
$$;

-- profiles_guard (from 004) + the set_username() bypass for the username column.
create or replace function public.profiles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    return new; -- service role, SQL editor, auth triggers
  end if;

  if tg_op = 'INSERT' then
    new.role := 'participant';
    new.onboarding_completed_at := null;
    new.account_status := 'active';
    return new;
  end if;

  if not public.is_super_admin() then
    new.role := old.role;
  end if;

  if not public.is_admin() then
    if old.account_status <> 'active' then raise exception 'ACCOUNT_SUSPENDED'; end if;
    new.id := old.id;
    if coalesce(current_setting('komunitas.username', true), '') <> 'on' then
      new.username := old.username;
      new.username_changed_at := old.username_changed_at;
    end if;
    new.account_status := old.account_status;
    new.status_reason := old.status_reason;
    new.status_changed_at := old.status_changed_at;
    if coalesce(current_setting('komunitas.onboarding', true), '') <> 'on' then
      new.onboarding_completed_at := old.onboarding_completed_at;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------
-- 2. PRIVACY SETTINGS (one row per user, created automatically)
-- ---------------------------------------------------------

create table if not exists public.privacy_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'everyone' check (profile_visibility in ('everyone', 'friends', 'only_me')),
  show_full_name boolean not null default false,
  show_gender boolean not null default false,
  show_age boolean not null default false,
  show_location boolean not null default true,   -- city only, never the kelurahan
  show_activities boolean not null default true,
  show_friends text not null default 'friends' check (show_friends in ('everyone', 'friends', 'only_me')),
  friend_requests text not null default 'everyone' check (friend_requests in ('everyone', 'nobody')),
  messages text not null default 'friends' check (messages in ('everyone', 'friends', 'nobody')),
  searchable boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.privacy_settings enable row level security;
drop policy if exists "own privacy read" on public.privacy_settings;
create policy "own privacy read" on public.privacy_settings for select using (user_id = auth.uid());
drop policy if exists "own privacy insert" on public.privacy_settings;
create policy "own privacy insert" on public.privacy_settings for insert with check (user_id = auth.uid());
drop policy if exists "own privacy update" on public.privacy_settings;
create policy "own privacy update" on public.privacy_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());

insert into public.privacy_settings (user_id) select id from public.profiles on conflict do nothing;

create or replace function public.profiles_create_privacy()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.privacy_settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;
drop trigger if exists trg_profiles_create_privacy on public.profiles;
create trigger trg_profiles_create_privacy after insert on public.profiles
for each row execute function public.profiles_create_privacy();

create or replace function public.privacy_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  return new;
end;
$$;
drop trigger if exists trg_privacy_touch on public.privacy_settings;
create trigger trg_privacy_touch before update on public.privacy_settings
for each row execute function public.privacy_touch();

-- ---------------------------------------------------------
-- 3. BLOCKS
-- ---------------------------------------------------------

create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists user_blocks_blocked_idx on public.user_blocks (blocked_id);
alter table public.user_blocks enable row level security;
drop policy if exists "own blocks" on public.user_blocks;
create policy "own blocks" on public.user_blocks for select using (blocker_id = auth.uid());

create or replace function public._is_blocked(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;

-- ---------------------------------------------------------
-- 4. FRIENDS
-- ---------------------------------------------------------

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_key on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);
alter table public.friendships enable row level security;
drop policy if exists "own friendships" on public.friendships;
create policy "own friendships" on public.friendships for select using (auth.uid() in (requester_id, addressee_id));

create or replace function public._friend_ids(p_user uuid)
returns setof uuid language sql stable security definer set search_path = public as $$
  select case when requester_id = p_user then addressee_id else requester_id end
  from public.friendships where status = 'accepted' and p_user in (requester_id, addressee_id);
$$;

create or replace function public._are_friends(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.friendships
                 where status = 'accepted' and least(requester_id, addressee_id) = least(a, b)
                   and greatest(requester_id, addressee_id) = greatest(a, b));
$$;

-- 'self' | 'blocked' (viewer blocked them) | 'unavailable' (they blocked viewer)
-- | 'friends' | 'outgoing' | 'incoming' | 'none'
create or replace function public._relationship(p_viewer uuid, p_target uuid)
returns text language plpgsql stable security definer set search_path = public as $$
declare f public.friendships;
begin
  if p_viewer = p_target then return 'self'; end if;
  if exists (select 1 from public.user_blocks where blocker_id = p_viewer and blocked_id = p_target) then return 'blocked'; end if;
  if exists (select 1 from public.user_blocks where blocker_id = p_target and blocked_id = p_viewer) then return 'unavailable'; end if;
  select * into f from public.friendships
  where least(requester_id, addressee_id) = least(p_viewer, p_target) and greatest(requester_id, addressee_id) = greatest(p_viewer, p_target);
  if not found or f.status = 'declined' then return 'none'; end if;
  if f.status = 'accepted' then return 'friends'; end if;
  return case when f.requester_id = p_viewer then 'outgoing' else 'incoming' end;
end;
$$;

-- Nickname first; the legal name only if the user allowed it; else @username.
create or replace function public._display_name(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(p.nickname), ''),
                  case when coalesce(s.show_full_name, false) then nullif(trim(p.full_name), '') end,
                  '@' || p.username)
  from public.profiles p left join public.privacy_settings s on s.user_id = p.id
  where p.id = p_user;
$$;

create or replace function public._can_view_profile(p_target uuid, p_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when p_target = p_viewer then true
    when p_viewer is null or public._is_blocked(p_target, p_viewer) then false
    else case coalesce((select profile_visibility from public.privacy_settings where user_id = p_target), 'everyone')
      when 'everyone' then true
      when 'friends' then public._are_friends(p_target, p_viewer)
      else false end
  end;
$$;

-- A small, privacy-safe card for lists (search, friends, requests).
create or replace function public._person_card(p_user uuid, p_viewer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_id', p.id,
    'username', p.username,
    'display_name', public._display_name(p.id),
    'avatar_url', p.avatar_url,
    'city', case when public._can_view_profile(p.id, p_viewer) and coalesce(s.show_location, true) then p.city end,
    'primary_interest', case when public._can_view_profile(p.id, p_viewer) then
        (select jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji) from public.interests i where i.id = p.primary_interest_id) end,
    'mutual', case when p.id = p_viewer then 0 else
        (select count(*) from public._friend_ids(p.id) a where a in (select public._friend_ids(p_viewer))) end,
    'relationship', public._relationship(p_viewer, p.id))
  from public.profiles p left join public.privacy_settings s on s.user_id = p.id
  where p.id = p_user;
$$;

create or replace function public._require_active_member()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.profiles where id = v_uid and account_status = 'active' and onboarding_completed_at is not null) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;
  return v_uid;
end;
$$;

-- A member others can interact with: onboarded, active, not blocked either way.
create or replace function public._reachable(p_viewer uuid, p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = p_target and account_status = 'active' and onboarding_completed_at is not null)
     and not public._is_blocked(p_viewer, p_target);
$$;

create or replace function public.send_friend_request(p_user uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  f public.friendships;
begin
  if p_user = v_uid then raise exception 'NOT_ALLOWED'; end if;
  if not public._reachable(v_uid, p_user) then raise exception 'USER_NOT_FOUND'; end if;

  select * into f from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_user) and greatest(requester_id, addressee_id) = greatest(v_uid, p_user)
  for update;

  if found then
    if f.status = 'accepted' then return 'friends'; end if;
    if f.status = 'pending' and f.requester_id = v_uid then return 'outgoing'; end if;
    if f.status = 'pending' then
      -- They already asked us: sending back means accepting.
      update public.friendships set status = 'accepted', responded_at = now() where id = f.id;
      perform public._notify(p_user, 'friend_accepted',
        jsonb_build_object('username', (select username from public.profiles where id = v_uid), 'name', public._display_name(v_uid)),
        '/u/' || (select username from public.profiles where id = v_uid));
      return 'friends';
    end if;
    -- declined earlier
    if f.requester_id = v_uid and f.responded_at > now() - interval '7 days' then raise exception 'FRIEND_REQUEST_COOLDOWN'; end if;
    delete from public.friendships where id = f.id;
  end if;

  if coalesce((select friend_requests from public.privacy_settings where user_id = p_user), 'everyone') = 'nobody' then
    raise exception 'FRIEND_REQUESTS_OFF';
  end if;
  if (select count(*) from public.friendships where requester_id = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_uid, p_user);
  perform public._notify(p_user, 'friend_request',
    jsonb_build_object('username', (select username from public.profiles where id = v_uid), 'name', public._display_name(v_uid)),
    '/community?tab=requests');
  return 'outgoing';
end;
$$;

create or replace function public.respond_friend_request(p_user uuid, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  f public.friendships;
begin
  select * into f from public.friendships
  where requester_id = p_user and addressee_id = v_uid and status = 'pending' for update;
  if not found then raise exception 'REQUEST_NOT_FOUND'; end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = f.id;
    perform public._notify(p_user, 'friend_accepted',
      jsonb_build_object('username', (select username from public.profiles where id = v_uid), 'name', public._display_name(v_uid)),
      '/u/' || (select username from public.profiles where id = v_uid));
    return 'friends';
  end if;
  update public.friendships set status = 'declined', responded_at = now() where id = f.id;
  return 'none';
end;
$$;

-- Cancel my pending request, or unfriend.
create or replace function public.remove_friend(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_user) and greatest(requester_id, addressee_id) = greatest(v_uid, p_user)
    and (status = 'accepted' or (status = 'pending' and requester_id = v_uid));
end;
$$;

create or replace function public.block_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_user = v_uid or not exists (select 1 from public.profiles where id = p_user) then raise exception 'NOT_ALLOWED'; end if;
  insert into public.user_blocks (blocker_id, blocked_id) values (v_uid, p_user) on conflict do nothing;
  delete from public.friendships
  where least(requester_id, addressee_id) = least(v_uid, p_user) and greatest(requester_id, addressee_id) = greatest(v_uid, p_user);
end;
$$;

create or replace function public.unblock_user(p_user uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.user_blocks where blocker_id = auth.uid() and blocked_id = p_user;
$$;

create or replace function public.my_friends()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return coalesce((
    select jsonb_agg(public._person_card(x.fid, v_uid) || jsonb_build_object('since', x.since) order by lower(public._display_name(x.fid)))
    from (select case when requester_id = v_uid then addressee_id else requester_id end fid, responded_at since
          from public.friendships where status = 'accepted' and v_uid in (requester_id, addressee_id)) x
    where exists (select 1 from public.profiles where id = x.fid and account_status = 'active')), '[]');
end;
$$;

create or replace function public.my_friend_requests()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return jsonb_build_object(
    'incoming', coalesce((select jsonb_agg(public._person_card(requester_id, v_uid) || jsonb_build_object('sent_at', created_at) order by created_at desc)
                          from public.friendships f where addressee_id = v_uid and status = 'pending'
                            and exists (select 1 from public.profiles where id = f.requester_id and account_status = 'active')), '[]'),
    'outgoing', coalesce((select jsonb_agg(public._person_card(addressee_id, v_uid) || jsonb_build_object('sent_at', created_at) order by created_at desc)
                          from public.friendships where requester_id = v_uid and status = 'pending'), '[]'));
end;
$$;

create or replace function public.search_people(p_query text, p_limit int default 20)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  q text := lower(regexp_replace(trim(coalesce(p_query, '')), '^@', ''));
  pat text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if length(q) < 2 then return '[]'; end if;
  pat := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((
    select jsonb_agg(public._person_card(id, v_uid) order by rank, lower(username))
    from (
      select p.id, p.username,
             case when lower(p.username) = q then 0 when public._are_friends(p.id, v_uid) then 1
                  when lower(p.username) like pat || '%' then 2 else 3 end rank
      from public.profiles p left join public.privacy_settings s on s.user_id = p.id
      where p.id <> v_uid and p.account_status = 'active' and p.onboarding_completed_at is not null
        and (lower(p.username) like pat || '%' or lower(p.nickname) like '%' || pat || '%')
        and (coalesce(s.searchable, true) or public._are_friends(p.id, v_uid))
        and not public._is_blocked(p.id, v_uid)
      order by rank, lower(p.username)
      limit least(greatest(coalesce(p_limit, 20), 1), 50)
    ) r), '[]');
end;
$$;

-- People you may know: same primary interest or city, not yet connected.
create or replace function public.suggested_people(p_limit int default 12)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  me public.profiles;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into me from public.profiles where id = v_uid;
  return coalesce((
    select jsonb_agg(public._person_card(id, v_uid) order by score desc, created_at desc)
    from (
      select p.id, p.created_at,
             (case when p.primary_interest_id = me.primary_interest_id then 2 else 0 end)
           + (case when p.city_id = me.city_id then 1 else 0 end) score
      from public.profiles p left join public.privacy_settings s on s.user_id = p.id
      where p.id <> v_uid and p.account_status = 'active' and p.onboarding_completed_at is not null
        and coalesce(s.searchable, true)
        and (p.primary_interest_id = me.primary_interest_id or p.city_id = me.city_id)
        and public._relationship(v_uid, p.id) = 'none'
      order by score desc, p.created_at desc
      limit least(greatest(coalesce(p_limit, 12), 1), 30)
    ) r), '[]');
end;
$$;

-- ---------------------------------------------------------
-- 5. SOCIAL LINKS
-- ---------------------------------------------------------

create table if not exists public.social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram', 'tiktok', 'x', 'facebook', 'linkedin', 'youtube', 'strava', 'website')),
  value text not null,
  visibility text not null default 'everyone' check (visibility in ('everyone', 'friends', 'only_me')),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, platform),
  -- Handles only (the app builds the URL); websites must be https.
  constraint social_links_value_format check (
    case when platform = 'website' then value ~ '^https://[^\s<>"''`]{3,200}$'
         else value ~ '^[A-Za-z0-9._-]{1,60}$' end)
);
alter table public.social_links enable row level security;
drop policy if exists "own links read" on public.social_links;
create policy "own links read" on public.social_links for select using (user_id = auth.uid());
drop policy if exists "own links insert" on public.social_links;
create policy "own links insert" on public.social_links for insert with check (user_id = auth.uid());
drop policy if exists "own links update" on public.social_links;
create policy "own links update" on public.social_links for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own links delete" on public.social_links;
create policy "own links delete" on public.social_links for delete using (user_id = auth.uid());

-- ---------------------------------------------------------
-- 6. PUBLIC PROFILE
-- ---------------------------------------------------------

create or replace function public.get_public_profile(p_username text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  p public.profiles;
  s public.privacy_settings;
  rel text;
  can_view boolean;
  is_friend boolean;
  friends_visible boolean;
  today date := (now() at time zone 'Asia/Jakarta')::date;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into p from public.profiles where lower(username) = lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
  if not found then return null; end if;
  if p.id <> v_uid and (p.account_status <> 'active' or p.onboarding_completed_at is null) then return null; end if;
  rel := public._relationship(v_uid, p.id);
  if rel = 'unavailable' then return null; end if;   -- they blocked the viewer: look like a missing profile
  select * into s from public.privacy_settings where user_id = p.id;
  is_friend := rel = 'friends';
  can_view := rel <> 'blocked' and public._can_view_profile(p.id, v_uid);
  friends_visible := p.id = v_uid or case coalesce(s.show_friends, 'friends')
    when 'everyone' then can_view when 'friends' then is_friend else false end;

  return jsonb_build_object(
    'user_id', p.id,
    'username', p.username,
    'display_name', public._display_name(p.id),
    'avatar_url', p.avatar_url,
    'member_since', p.created_at,
    'relationship', rel,
    'is_self', p.id = v_uid,
    'can_view', can_view,
    'visibility', coalesce(s.profile_visibility, 'everyone'),
    'accepts_requests', coalesce(s.friend_requests, 'everyone') = 'everyone',
    'mutual_friends', case when p.id = v_uid then 0 else
        (select count(*) from public._friend_ids(p.id) a where a in (select public._friend_ids(v_uid))) end,
    'friends_count', case when friends_visible then (select count(*) from public._friend_ids(p.id)) end,
    'details', case when not can_view then null else jsonb_build_object(
      'bio', p.bio,
      'full_name', case when coalesce(s.show_full_name, false) then p.full_name end,
      'city', case when coalesce(s.show_location, true) then p.city end,
      'province', case when coalesce(s.show_location, true) then p.province end,
      'gender', case when coalesce(s.show_gender, false) then p.gender::text end,
      'age', case when coalesce(s.show_age, false) then p.age end,
      'primary_interest', (select jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji) from public.interests i where i.id = p.primary_interest_id),
      'interests', coalesce((select jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji) order by i.sort_order)
                             from public.user_interests ui join public.interests i on i.id = ui.interest_id where ui.user_id = p.id), '[]'),
      'stats', case when coalesce(s.show_activities, true) or p.id = v_uid then jsonb_build_object(
          'hosted', (select count(*) from public.events e where e.creator_id = p.id and e.status::text <> 'cancelled'),
          'joined', (select count(*) from public.event_participants ep where ep.user_id = p.id and ep.status::text = 'approved')) end,
      'upcoming', case when coalesce(s.show_activities, true) or p.id = v_uid then coalesce((
          select jsonb_agg(jsonb_build_object('id', e.id, 'title', e.title, 'event_date', e.event_date, 'start_time', e.start_time, 'location', e.location_name)
                           order by e.event_date, e.start_time)
          from (select * from public.events e
                where e.creator_id = p.id and e.privacy::text = 'public' and e.status::text <> 'cancelled' and e.event_date >= today
                order by e.event_date, e.start_time limit 6) e), '[]') end,
      'links', coalesce((select jsonb_agg(jsonb_build_object('platform', l.platform, 'value', l.value, 'visibility', l.visibility) order by l.sort_order, l.platform)
                         from public.social_links l
                         where l.user_id = p.id and (p.id = v_uid or l.visibility = 'everyone' or (l.visibility = 'friends' and is_friend))), '[]'))
    end);
end;
$$;

-- Friends list on someone's profile (respects "who can see my friends").
create or replace function public.user_friends(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  vis text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  vis := coalesce((select show_friends from public.privacy_settings where user_id = p_user), 'friends');
  if not (p_user = v_uid or (vis = 'everyone' and public._can_view_profile(p_user, v_uid))
          or (vis = 'friends' and public._are_friends(p_user, v_uid))) then
    raise exception 'NOT_ALLOWED';
  end if;
  return coalesce((
    select jsonb_agg(public._person_card(fid, v_uid) order by lower(public._display_name(fid)))
    from (select fid from public._friend_ids(p_user) fid limit 200) x
    where exists (select 1 from public.profiles where id = x.fid and account_status = 'active')
      and not public._is_blocked(x.fid, v_uid)), '[]');
end;
$$;

create or replace function public.my_blocked_users()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'username', p.username, 'display_name', public._display_name(p.id), 'blocked_at', b.created_at)
                            order by b.created_at desc), '[]')
  from public.user_blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid();
$$;

-- Own full row / all rows for staff. Views run with the owner's rights, so
-- they keep working after 007 limits direct column access on profiles.
create or replace view public.my_profile as
  select * from public.profiles where id = auth.uid();
create or replace view public.staff_profiles as
  select * from public.profiles where public.is_staff();
revoke all on public.my_profile, public.staff_profiles from anon;
grant select on public.my_profile, public.staff_profiles to authenticated;

-- Anonymized accounts (004 admin_anonymize_user) leave no social traces.
create or replace function public.profiles_anonymized_cleanup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.username like 'deleted\_%' and old.username not like 'deleted\_%' then
    delete from public.social_links where user_id = new.id;
    delete from public.friendships where new.id in (requester_id, addressee_id);
    delete from public.user_blocks where new.id in (blocker_id, blocked_id);
    update public.privacy_settings set profile_visibility = 'only_me', searchable = false, friend_requests = 'nobody', messages = 'nobody'
    where user_id = new.id;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_anonymized_cleanup on public.profiles;
create trigger trg_profiles_anonymized_cleanup after update of username on public.profiles
for each row execute function public.profiles_anonymized_cleanup();

-- ---------------------------------------------------------
-- 7. ADMIN
-- ---------------------------------------------------------

create or replace function public.admin_user_social(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'friends', (select count(*) from public._friend_ids(p_user)),
    'pending_in', (select count(*) from public.friendships where addressee_id = p_user and status = 'pending'),
    'pending_out', (select count(*) from public.friendships where requester_id = p_user and status = 'pending'),
    'blocked_by_user', (select count(*) from public.user_blocks where blocker_id = p_user),
    'blocked_by_others', (select count(*) from public.user_blocks where blocked_id = p_user),
    'privacy', (select to_jsonb(s) - 'user_id' from public.privacy_settings s where user_id = p_user),
    'links', coalesce((select jsonb_agg(jsonb_build_object('platform', platform, 'value', value, 'visibility', visibility) order by sort_order, platform)
                       from public.social_links where user_id = p_user), '[]'),
    'username_history', coalesce((select jsonb_agg(jsonb_build_object('old', h.old_username, 'new', h.new_username, 'at', h.created_at,
                                     'by', (select username from public.profiles where id = h.changed_by)) order by h.created_at desc)
                                  from public.username_history h where h.user_id = p_user), '[]'));
end;
$$;

create or replace function public.admin_set_username(p_user uuid, p_username text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_old text;
  v_new text := lower(regexp_replace(trim(coalesce(p_username, '')), '^@', ''));
  v_status text;
begin
  perform public._require_rank(2);
  select username into v_old from public.profiles where id = p_user;
  if v_old is null then raise exception 'USER_NOT_FOUND'; end if;
  v_status := public._username_status(v_new, p_user, true);   -- staff may assign reserved names
  if v_status = 'current' then return v_old; end if;
  if v_status = 'invalid' then raise exception 'USERNAME_INVALID'; end if;
  if v_status = 'taken' then raise exception 'USERNAME_TAKEN'; end if;
  insert into public.username_history (user_id, old_username, new_username, changed_by) values (p_user, v_old, v_new, auth.uid());
  update public.profiles set username = v_new where id = p_user;
  perform public._audit('username_set', 'user', p_user::text, jsonb_build_object('username', v_old), jsonb_build_object('username', v_new));
  return v_new;
end;
$$;

create or replace function public.admin_reserved_usernames()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return coalesce((select jsonb_agg(name order by name) from public.reserved_usernames), '[]');
end;
$$;

create or replace function public.admin_set_reserved_username(p_name text, p_reserved boolean)
returns void language plpgsql security definer set search_path = public as $$
declare n text := lower(regexp_replace(trim(coalesce(p_name, '')), '^@', ''));
begin
  perform public._require_rank(2);
  if n !~ '^[a-z0-9_]{1,30}$' then raise exception 'USERNAME_INVALID'; end if;
  if p_reserved then
    insert into public.reserved_usernames (name) values (n) on conflict do nothing;
  else
    delete from public.reserved_usernames where name = n;
  end if;
  perform public._audit(case when p_reserved then 'username_reserved' else 'username_unreserved' end, 'setting', n);
end;
$$;

create or replace function public.admin_social_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_sent int; v_accepted int;
begin
  perform public._require_rank(1);
  select count(*), count(*) filter (where status = 'accepted') into v_sent, v_accepted
  from public.friendships where created_at >= p_from and created_at < p_to;
  return jsonb_build_object(
    'friendships', (select count(*) from public.friendships where status = 'accepted'),
    'pending', (select count(*) from public.friendships where status = 'pending'),
    'requests_in_range', v_sent,
    'accepted_in_range', v_accepted,
    'acceptance_rate', case when v_sent > 0 then round(100.0 * v_accepted / v_sent) end,
    'users_with_friends', (select count(distinct u) from (select requester_id u from public.friendships where status = 'accepted'
                                                          union select addressee_id from public.friendships where status = 'accepted') x),
    'avg_friends', (select round(coalesce(avg(c), 0)::numeric, 1) from (
                      select p.id, (select count(*) from public._friend_ids(p.id)) c from public.profiles p
                      where p.onboarding_completed_at is not null and p.account_status = 'active') x),
    'blocks', (select count(*) from public.user_blocks),
    'username_changes_in_range', (select count(*) from public.username_history where created_at >= p_from and created_at < p_to),
    'users_with_links', (select count(distinct user_id) from public.social_links),
    'links_by_platform', coalesce((select jsonb_agg(jsonb_build_object('key', platform, 'v', c) order by c desc)
                                   from (select platform, count(*) c from public.social_links group by platform) x), '[]'),
    'visibility', coalesce((select jsonb_agg(jsonb_build_object('key', profile_visibility, 'v', c) order by c desc)
                            from (select profile_visibility, count(*) c from public.privacy_settings group by 1) x), '[]'),
    'series', coalesce((select jsonb_agg(jsonb_build_object('t', d, 'v', c) order by d)
                        from (select date_trunc('day', created_at at time zone 'Asia/Jakarta')::date d, count(*) c
                              from public.friendships where created_at >= p_from and created_at < p_to group by 1) x), '[]'),
    'top_connected', coalesce((select jsonb_agg(jsonb_build_object('username', username, 'v', c) order by c desc)
                               from (select p.username, (select count(*) from public._friend_ids(p.id)) c
                                     from public.profiles p order by 2 desc limit 10) x where c > 0), '[]'));
end;
$$;

-- ---------------------------------------------------------
-- 8. GRANTS: internal helpers are not callable by clients
-- ---------------------------------------------------------

revoke execute on function public._username_status(text, uuid, boolean) from public, anon, authenticated;
revoke execute on function public._is_blocked(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._friend_ids(uuid) from public, anon, authenticated;
revoke execute on function public._are_friends(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._relationship(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._display_name(uuid) from public, anon, authenticated;
revoke execute on function public._can_view_profile(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._person_card(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._reachable(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._require_active_member() from public, anon, authenticated;

commit;
