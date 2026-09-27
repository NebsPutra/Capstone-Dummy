-- =========================================================
-- 005 — PIN login, security events, account-security helpers.
-- Run after 004. Idempotent; adds only.
--
-- PINs are stored as bcrypt hashes (pgcrypto) in a table no client role can
-- read. Verification happens in verify_login_pin(), which only the server
-- (service role) may call; it applies per-account lockout and a per-network
-- throttle, and returns results instead of raising so the counters commit.
-- =========================================================

begin;

create extension if not exists pgcrypto;

-- ---------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------

create table if not exists public.user_pins (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  pin_hash text not null,
  failed_attempts int not null default 0,
  lock_level int not null default 0,        -- next lock: 0 → 15 min, 1 → 1 h, 2+ → 24 h
  locked_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.user_pins enable row level security;  -- no policies: never read directly
revoke all on public.user_pins from anon, authenticated;

alter table public.profiles add column if not exists pin_set_at timestamptz;

-- pin_set_at is only written by the PIN functions below.
create or replace function public.profiles_pin_guard()
returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and coalesce(current_setting('komunitas.pin', true), '') <> 'on' then
    if tg_op = 'INSERT' then new.pin_set_at := null; else new.pin_set_at := old.pin_set_at; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_profiles_pin_guard on public.profiles;
create trigger trg_profiles_pin_guard before insert or update on public.profiles
for each row execute function public.profiles_pin_guard();

create table if not exists public.security_events (
  id bigserial primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'login_pin', 'login_password', 'pin_failed', 'pin_locked', 'pin_set', 'pin_changed', 'pin_reset',
    'password_changed', 'email_change_requested', 'email_changed', 'logout_all', 'logout_others',
    'admin_pin_unlocked', 'admin_pin_cleared')),
  client text,   -- hashed network identifier (never the raw IP)
  device text,   -- short user-agent summary
  created_at timestamptz not null default now()
);
create index if not exists security_events_user_idx on public.security_events (user_id, created_at desc);
create index if not exists security_events_client_idx on public.security_events (client, type, created_at desc);
alter table public.security_events enable row level security;
drop policy if exists "own security events" on public.security_events;
create policy "own security events" on public.security_events for select using (user_id = auth.uid());

-- More notification types (security now; social features in later phases).
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'complaint_submitted', 'complaint_status', 'complaint_reply',
  'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status',
  'security_alert', 'friend_request', 'friend_accepted', 'new_message', 'event_comment', 'comment_reply'));

-- ---------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------

-- Obvious PINs: one repeated digit, a straight run up or down, common patterns.
create or replace function public.pin_is_weak(p text)
returns boolean language sql immutable as $$
  select p ~ '^(\d)\1{5}$'
      or position(p in '0123456789012345') > 0
      or position(p in '9876543210987654') > 0
      or p in ('121212', '112233', '123123', '696969', '131313', '101010', '147258', '159753', '111222', '000111');
$$;

-- True when the caller's session was created from an email code in the last
-- 15 minutes (allows a PIN reset without the old PIN).
create or replace function public.recent_email_otp_session()
returns boolean language sql stable as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) a
    where a ->> 'method' in ('otp', 'magiclink', 'email/signup', 'recovery')
      and to_timestamp((a ->> 'timestamp')::double precision) > now() - interval '15 minutes'
  );
$$;

create or replace function public._security_event(p_user uuid, p_type text, p_client text default null, p_device text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.security_events (user_id, type, client, device) values (p_user, p_type, p_client, left(p_device, 200));
$$;

-- ---------------------------------------------------------
-- 3. Signed-in user
-- ---------------------------------------------------------

create or replace function public.pin_status()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'set', exists (select 1 from public.user_pins where user_id = auth.uid()),
    'locked_until', (select locked_until from public.user_pins where user_id = auth.uid() and locked_until > now()));
$$;

-- Create (first time), change (needs current PIN) or reset (needs a fresh
-- email-code session) the caller's PIN.
create or replace function public.set_login_pin(p_pin text, p_current text default null, p_recovery boolean default false)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
  v_row public.user_pins;
  v_type text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_pin is null or p_pin !~ '^\d{6}$' then raise exception 'PIN_FORMAT'; end if;
  if public.pin_is_weak(p_pin) then raise exception 'PIN_WEAK'; end if;

  select * into v_row from public.user_pins where user_id = v_uid for update;
  if found then
    if coalesce(p_recovery, false) then
      if not public.recent_email_otp_session() then raise exception 'REAUTH_REQUIRED'; end if;
      v_type := 'pin_reset';
    else
      if v_row.locked_until > now() then raise exception 'PIN_LOCKED'; end if;
      if p_current is null or crypt(p_current, v_row.pin_hash) <> v_row.pin_hash then
        raise exception 'PIN_INCORRECT';
      end if;
      v_type := 'pin_changed';
    end if;
    if crypt(p_pin, v_row.pin_hash) = v_row.pin_hash then raise exception 'PIN_SAME'; end if;
  else
    v_type := 'pin_set';
  end if;

  insert into public.user_pins (user_id, pin_hash) values (v_uid, crypt(p_pin, gen_salt('bf', 10)))
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, failed_attempts = 0, lock_level = 0, locked_until = null, updated_at = now();

  perform set_config('komunitas.pin', 'on', true);
  update public.profiles set pin_set_at = now() where id = v_uid;
  perform set_config('komunitas.pin', '', true);

  perform public._security_event(v_uid, v_type);
  if v_type <> 'pin_set' then
    perform public._notify(v_uid, 'security_alert', jsonb_build_object('event', v_type), '/profile/security');
  end if;
end;
$$;

-- Events the browser reports after Supabase Auth actions (own log only).
create or replace function public.record_security_event(p_type text, p_device text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_type not in ('login_password', 'password_changed', 'email_change_requested', 'email_changed', 'logout_all', 'logout_others') then
    raise exception 'NOT_ALLOWED';
  end if;
  perform public._security_event(auth.uid(), p_type, null, p_device);
  if p_type in ('password_changed', 'email_changed', 'email_change_requested') then
    perform public._notify(auth.uid(), 'security_alert', jsonb_build_object('event', p_type), '/profile/security');
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 4. Server-only (service role): PIN sign-in check, email lookup
-- ---------------------------------------------------------

create or replace function public.verify_login_pin(p_identifier text, p_pin text, p_client text, p_device text default null)
returns jsonb language plpgsql security definer set search_path = public, auth, extensions as $$
declare
  v_ident text := lower(regexp_replace(trim(coalesce(p_identifier, '')), '^@', ''));
  v_uid uuid;
  v_email text;
  v_status text;
  v_row public.user_pins;
  v_until timestamptz;
begin
  -- Per-network throttle across all accounts (slows credential stuffing).
  if p_client is not null and (select count(*) from public.security_events
      where client = p_client and type = 'pin_failed' and created_at > now() - interval '15 minutes') >= 30 then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited');
  end if;

  select u.id, u.email, p.account_status::text into v_uid, v_email, v_status
  from auth.users u join public.profiles p on p.id = u.id
  where (lower(u.email) = v_ident or lower(p.username) = v_ident) and u.email_confirmed_at is not null
  limit 1;

  if v_uid is null then
    perform public._security_event(null, 'pin_failed', p_client, p_device);
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_row from public.user_pins where user_id = v_uid for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_pin');
  end if;
  if v_row.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', v_row.locked_until);
  end if;

  if p_pin ~ '^\d{6}$' and crypt(p_pin, v_row.pin_hash) = v_row.pin_hash then
    if v_status is distinct from 'active' then
      return jsonb_build_object('ok', false, 'reason', 'suspended');
    end if;
    update public.user_pins set failed_attempts = 0, lock_level = 0, locked_until = null where user_id = v_uid;
    perform public._security_event(v_uid, 'login_pin', p_client, p_device);
    return jsonb_build_object('ok', true, 'user_id', v_uid, 'email', v_email);
  end if;

  perform public._security_event(v_uid, 'pin_failed', p_client, p_device);
  if v_row.failed_attempts + 1 >= 5 then
    v_until := now() + case v_row.lock_level when 0 then interval '15 minutes' when 1 then interval '1 hour' else interval '24 hours' end;
    update public.user_pins
      set failed_attempts = 0, lock_level = lock_level + 1, locked_until = v_until where user_id = v_uid;
    perform public._security_event(v_uid, 'pin_locked', p_client, p_device);
    perform public._notify(v_uid, 'security_alert', jsonb_build_object('event', 'pin_locked'), '/profile/security');
    return jsonb_build_object('ok', false, 'reason', 'locked', 'until', v_until, 'email', v_email, 'just_locked', true);
  end if;
  update public.user_pins set failed_attempts = failed_attempts + 1 where user_id = v_uid;
  return jsonb_build_object('ok', false, 'reason', 'invalid', 'remaining', 5 - (v_row.failed_attempts + 1));
end;
$$;

create or replace function public.email_for_identifier(p_identifier text)
returns text language sql stable security definer set search_path = public, auth as $$
  select u.email from auth.users u left join public.profiles p on p.id = u.id
  where (lower(u.email) = lower(regexp_replace(trim(p_identifier), '^@', ''))
         or lower(p.username) = lower(regexp_replace(trim(p_identifier), '^@', '')))
    and u.email_confirmed_at is not null
  limit 1;
$$;

-- ---------------------------------------------------------
-- 5. Admin: status + unlock/clear (never the PIN or its hash)
-- ---------------------------------------------------------

create or replace function public.admin_user_security(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'pin_set', exists (select 1 from public.user_pins where user_id = p_user),
    'locked_until', (select locked_until from public.user_pins where user_id = p_user and locked_until > now()),
    'failed_attempts', coalesce((select failed_attempts from public.user_pins where user_id = p_user), 0),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('type', type, 'device', device, 'created_at', created_at)
                 order by created_at desc), '[]')
               from (select * from public.security_events where user_id = p_user order by created_at desc limit 30) e));
end;
$$;

create or replace function public.admin_pin_action(p_user uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(2);
  if p_action = 'unlock' then
    update public.user_pins set failed_attempts = 0, locked_until = null where user_id = p_user;
    perform public._security_event(p_user, 'admin_pin_unlocked');
  elsif p_action = 'clear' then
    -- The user then sets a new PIN after proving their email.
    delete from public.user_pins where user_id = p_user;
    perform set_config('komunitas.pin', 'on', true);
    update public.profiles set pin_set_at = null where id = p_user;
    perform set_config('komunitas.pin', '', true);
    perform public._security_event(p_user, 'admin_pin_cleared');
    perform public._notify(p_user, 'security_alert', jsonb_build_object('event', 'admin_pin_cleared'), '/profile/security');
  else
    raise exception 'NOT_ALLOWED';
  end if;
  perform public._audit('pin_' || p_action, 'user', p_user::text);
end;
$$;

-- ---------------------------------------------------------
-- 6. Grants
-- ---------------------------------------------------------

revoke execute on function public.verify_login_pin(text, text, text, text) from public, anon, authenticated;
revoke execute on function public.email_for_identifier(text) from public, anon, authenticated;
revoke execute on function public._security_event(uuid, text, text, text) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.verify_login_pin(text, text, text, text) to service_role;
    grant execute on function public.email_for_identifier(text) to service_role;
  end if;
end $$;

commit;
