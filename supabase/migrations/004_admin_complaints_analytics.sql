-- =========================================================
-- 004 — Admin roles ("God Mode"), complaints / help center, notifications,
--       audit log, activity feed, platform settings, analytics, exports,
--       storage buckets for event banners and complaint attachments.
--
-- Run after 003. Idempotent; adds tables/columns/functions only and keeps
-- all existing data. Role checks compare role::text on purpose: enum values
-- added in a transaction can't be used as enum literals until it commits,
-- and this file runs as one transaction.
--
-- Afterwards, promote your own account (as a separate query):
--   update public.profiles set role = 'super_admin'
--   where id = (select id from auth.users where email = 'you@example.com');
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. ROLES & ACCOUNT STATUS
--    participant (= USER) < moderator < admin < super_admin (= God Mode)
-- ---------------------------------------------------------

alter type public.user_role add value if not exists 'moderator';
alter type public.user_role add value if not exists 'super_admin';

do $$
begin
  if not exists (select 1 from pg_type where typname = 'account_status') then
    create type public.account_status as enum ('active', 'suspended', 'deactivated');
  end if;
end $$;

alter table public.profiles
  add column if not exists account_status public.account_status not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_changed_at timestamptz;

create or replace function public.role_rank(r text)
returns int language sql immutable as $$
  select case r when 'super_admin' then 3 when 'admin' then 2 when 'moderator' then 1 else 0 end;
$$;

-- Rank of the signed-in user; suspended/deactivated accounts have no power.
create or replace function public.my_role_rank()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select public.role_rank(role::text) from public.profiles
     where id = auth.uid() and account_status = 'active'),
    0);
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$ select public.my_role_rank() >= 1 $$;

-- Redefined: admin now means admin OR super_admin (was role = 'admin').
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$ select public.my_role_rank() >= 2 $$;

create or replace function public.is_super_admin() returns boolean
language sql stable security definer set search_path = public as $$ select public.my_role_rank() >= 3 $$;

create or replace function public._require_rank(p_min int) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if public.my_role_rank() < p_min then raise exception 'NOT_ALLOWED'; end if;
end;
$$;

-- Only active, fully-registered users (or staff) can create/join events.
create or replace function public.is_onboarded() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and account_status = 'active'
      and (onboarding_completed_at is not null or public.role_rank(role::text) >= 1)
  );
$$;

-- Privileged profile columns: role only by super_admin; account status,
-- username and onboarding only by admins (or the onboarding RPC).
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
    new.username := old.username;
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
-- 2. AUDIT LOG (append-only) + ADMIN ACTIVITY FEED
-- ---------------------------------------------------------

create table if not exists public.audit_logs (
  id bigserial primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity, entity_id);

create or replace function public.audit_logs_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_logs is append-only';
end;
$$;
drop trigger if exists trg_audit_logs_immutable on public.audit_logs;
create trigger trg_audit_logs_immutable before update or delete on public.audit_logs
for each row execute function public.audit_logs_immutable();

-- Internal writer (not callable by clients; see revokes at the end).
create or replace function public._audit(
  p_action text, p_entity text, p_entity_id text,
  p_old jsonb default null, p_new jsonb default null, p_meta jsonb default null
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (actor_id, actor_role, action, entity, entity_id, old_value, new_value, metadata)
  values (
    auth.uid(),
    (select role::text from public.profiles where id = auth.uid()),
    p_action, p_entity, p_entity_id, p_old, p_new, p_meta
  );
end;
$$;

-- Keys whose values differ between two row images (ignoring noise columns).
create or replace function public._diff(a jsonb, b jsonb, out old_part jsonb, out new_part jsonb)
language sql immutable as $$
  select
    (select jsonb_object_agg(k, a -> k) from jsonb_object_keys(a) k
      where k not in ('updated_at', 'participant_count', 'last_activity_at') and (a -> k) is distinct from (b -> k)),
    (select jsonb_object_agg(k, b -> k) from jsonb_object_keys(b) k
      where k not in ('updated_at', 'participant_count', 'last_activity_at') and (a -> k) is distinct from (b -> k));
$$;

create table if not exists public.admin_events (
  id bigserial primary key,
  type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  entity text,
  entity_id text,
  params jsonb not null default '{}',
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists admin_events_created_idx on public.admin_events (created_at desc);

create or replace function public._admin_event(
  p_type text, p_severity text, p_entity text, p_entity_id text, p_params jsonb default '{}'
) returns void language sql security definer set search_path = public as $$
  insert into public.admin_events (type, severity, entity, entity_id, params)
  values (p_type, p_severity, p_entity, p_entity_id, coalesce(p_params, '{}'));
$$;

-- ---------------------------------------------------------
-- 3. USER NOTIFICATIONS
-- ---------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in (
    'complaint_submitted', 'complaint_status', 'complaint_reply',
    'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status'
  )),
  params jsonb not null default '{}',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

create or replace function public._notify(p_user uuid, p_type text, p_params jsonb, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, params, link)
  select p_user, p_type, coalesce(p_params, '{}'), p_link where p_user is not null;
$$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where user_id = auth.uid() and read_at is null and (p_ids is null or id = any (p_ids));
$$;

-- ---------------------------------------------------------
-- 4. REFERENCE DATA: soft-disable hobbies/categories, hobby timestamps,
--    human-readable event references (EVT-2026-00125)
-- ---------------------------------------------------------

alter table public.interests
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order int not null default 0;
alter table public.categories
  add column if not exists is_active boolean not null default true,
  add column if not exists sort_order int not null default 0;

-- Needed for hobby-trend analytics. Existing rows get the migration time.
alter table public.user_interests add column if not exists created_at timestamptz not null default now();

create sequence if not exists public.event_no_seq;
alter table public.events
  add column if not exists event_no bigint,
  add column if not exists ref text;
create unique index if not exists events_ref_idx on public.events (ref);
create index if not exists events_created_idx on public.events (created_at);
create index if not exists events_status_idx on public.events (status);
create index if not exists profiles_created_idx on public.profiles (created_at);
create index if not exists profiles_city_idx on public.profiles (city_id);
create index if not exists event_participants_joined_idx on public.event_participants (joined_at);

-- events_before_write (from 002) + ref assignment. The ref is set once and
-- can't be changed afterwards.
create or replace function public.events_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
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

    new.event_no := nextval('public.event_no_seq');
    new.ref := 'EVT-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-' || lpad(new.event_no::text, 5, '0');
    new.participant_count := 0;
    new.status := 'open'::event_status;
  else
    new.id := old.id;
    new.creator_id := old.creator_id;
    new.event_code := old.event_code;
    new.share_token := old.share_token;
    new.created_at := old.created_at;
    new.event_no := coalesce(old.event_no, new.event_no);
    new.ref := coalesce(old.ref, new.ref);
    new.participant_count := public.approved_count(new.id);
    if new.status is distinct from 'cancelled'::event_status then
      new.status := public.capacity_status(new.participant_count, new.max_participants);
    end if;
  end if;
  return new;
end;
$$;

-- Backfill refs for existing events, oldest first.
do $$
declare
  r record;
  v_no bigint;
begin
  for r in select id, created_at from public.events where ref is null order by created_at loop
    v_no := nextval('public.event_no_seq');
    update public.events
    set event_no = v_no,
        ref = 'EVT-' || to_char(r.created_at at time zone 'Asia/Jakarta', 'YYYY') || '-' || lpad(v_no::text, 5, '0')
    where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------
-- 5. COMPLAINTS / HELP CENTER
-- ---------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_type where typname = 'complaint_category') then
    create type public.complaint_category as enum (
      'account', 'login_registration', 'event', 'event_organizer', 'participant', 'payment_fee',
      'location_gps', 'app_bug', 'content', 'harassment_abuse', 'technical', 'other');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_status') then
    create type public.complaint_status as enum (
      'OPEN', 'IN_REVIEW', 'WAITING_FOR_USER', 'RESOLVED', 'CLOSED', 'REJECTED');
  end if;
  if not exists (select 1 from pg_type where typname = 'complaint_severity') then
    create type public.complaint_severity as enum ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  end if;
end $$;

create sequence if not exists public.complaint_no_seq;

create table if not exists public.complaints (
  id uuid primary key default uuid_generate_v4(),
  ref text unique not null,
  reporter_id uuid references public.profiles(id) on delete set null,
  is_anonymous boolean not null default false,
  category public.complaint_category not null,
  severity public.complaint_severity not null default 'MEDIUM',
  status public.complaint_status not null default 'OPEN',
  subject text not null check (char_length(subject) between 3 and 150),
  description text not null check (char_length(description) between 10 and 5000),
  contact text check (contact is null or char_length(contact) <= 200),
  related_event_id uuid references public.events(id) on delete set null,
  related_user_id uuid references public.profiles(id) on delete set null,
  assigned_to uuid references public.profiles(id) on delete set null,
  email_status text not null default 'pending' check (email_status in ('pending', 'sent', 'failed', 'skipped')),
  email_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_activity_at timestamptz not null default now()
);
create index if not exists complaints_status_idx on public.complaints (status, created_at desc);
create index if not exists complaints_reporter_idx on public.complaints (reporter_id);
create index if not exists complaints_event_idx on public.complaints (related_event_id);

create table if not exists public.complaint_messages (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  from_staff boolean not null default false,
  is_internal boolean not null default false, -- internal admin notes, never shown to the user
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists complaint_messages_idx on public.complaint_messages (complaint_id, created_at);

create table if not exists public.complaint_attachments (
  id uuid primary key default uuid_generate_v4(),
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  message_id uuid references public.complaint_messages(id) on delete set null,
  uploaded_by uuid references public.profiles(id) on delete set null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.complaint_status_history (
  id bigserial primary key,
  complaint_id uuid not null references public.complaints(id) on delete cascade,
  kind text not null check (kind in ('submitted', 'status', 'assigned', 'severity')),
  from_value text,
  to_value text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists complaint_history_idx on public.complaint_status_history (complaint_id, created_at);

create or replace function public.complaints_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.ref := 'CPL-' || to_char(now() at time zone 'Asia/Jakarta', 'YYYY') || '-' ||
               lpad(nextval('public.complaint_no_seq')::text, 4, '0');
  else
    new.id := old.id;
    new.ref := old.ref;
    new.reporter_id := old.reporter_id;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists trg_complaints_before_write on public.complaints;
create trigger trg_complaints_before_write before insert or update on public.complaints
for each row execute function public.complaints_before_write();

-- Timeline + notifications + admin feed for complaint changes.
create or replace function public.complaints_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.complaint_status_history (complaint_id, kind, to_value, changed_by)
    values (new.id, 'submitted', new.status::text, new.reporter_id);
    perform public._notify(new.reporter_id, 'complaint_submitted', jsonb_build_object('ref', new.ref), '/help/' || new.id);
    perform public._admin_event(
      'complaint_submitted',
      case when new.severity::text = 'CRITICAL' then 'critical' when new.severity::text = 'HIGH' then 'warning' else 'info' end,
      'complaint', new.id::text,
      jsonb_build_object('ref', new.ref, 'category', new.category, 'severity', new.severity, 'subject', new.subject));
    return null;
  end if;

  if new.status is distinct from old.status then
    insert into public.complaint_status_history (complaint_id, kind, from_value, to_value, changed_by)
    values (new.id, 'status', old.status::text, new.status::text, auth.uid());
    perform public._notify(new.reporter_id, 'complaint_status',
      jsonb_build_object('ref', new.ref, 'status', new.status), '/help/' || new.id);
  end if;
  if new.assigned_to is distinct from old.assigned_to then
    insert into public.complaint_status_history (complaint_id, kind, from_value, to_value, changed_by)
    values (new.id, 'assigned', old.assigned_to::text, new.assigned_to::text, auth.uid());
  end if;
  if new.severity is distinct from old.severity then
    insert into public.complaint_status_history (complaint_id, kind, from_value, to_value, changed_by)
    values (new.id, 'severity', old.severity::text, new.severity::text, auth.uid());
    if new.severity::text = 'CRITICAL' then
      perform public._admin_event('complaint_critical', 'critical', 'complaint', new.id::text,
        jsonb_build_object('ref', new.ref, 'subject', new.subject));
    end if;
  end if;
  if new.email_status = 'failed' and old.email_status is distinct from 'failed' then
    perform public._admin_event('email_failed', 'warning', 'complaint', new.id::text, jsonb_build_object('ref', new.ref));
  end if;
  return null;
end;
$$;
drop trigger if exists trg_complaints_after_write on public.complaints;
create trigger trg_complaints_after_write after insert or update on public.complaints
for each row execute function public.complaints_after_write();

create or replace function public.submit_complaint(
  p_category text,
  p_subject text,
  p_description text,
  p_severity text default 'MEDIUM',
  p_contact text default null,
  p_related_event uuid default null,
  p_related_user uuid default null,
  p_anonymous boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_row public.complaints;
  v_limit int;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  -- Controlled vocabularies: these casts reject anything outside the enums.
  perform p_category::public.complaint_category, coalesce(p_severity, 'MEDIUM')::public.complaint_severity;
  v_limit := coalesce((select (value #>> '{}')::int from public.platform_settings
                       where key = 'complaint_rate_limit_per_hour'), 5);
  if (select count(*) from public.complaints where reporter_id = v_uid and created_at > now() - interval '1 hour') >= v_limit then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.complaints (reporter_id, is_anonymous, category, severity, subject, description, contact,
                                 related_event_id, related_user_id)
  values (v_uid, coalesce(p_anonymous, false), p_category::public.complaint_category,
          coalesce(p_severity, 'MEDIUM')::public.complaint_severity, trim(p_subject), trim(p_description),
          nullif(trim(coalesce(p_contact, '')), ''), p_related_event, p_related_user)
  returning * into v_row;

  -- Several open complaints about one event: worth a review.
  if p_related_event is not null and (
    select count(*) from public.complaints
    where related_event_id = p_related_event and status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')
  ) >= 2 then
    perform public._admin_event('event_multiple_reports', 'warning', 'event', p_related_event::text,
      jsonb_build_object('count', (select count(*) from public.complaints where related_event_id = p_related_event)));
  end if;

  return jsonb_build_object('id', v_row.id, 'ref', v_row.ref);
end;
$$;

create or replace function public.add_complaint_attachment(
  p_complaint uuid, p_path text, p_name text, p_mime text, p_size int, p_message uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from public.complaints where id = p_complaint and (reporter_id = auth.uid() or public.is_staff())) then
    raise exception 'NOT_ALLOWED';
  end if;
  -- Files must live in the uploader's own storage folder.
  if split_part(p_path, '/', 1) <> auth.uid()::text then raise exception 'NOT_ALLOWED'; end if;
  if p_size > 5 * 1024 * 1024 or p_mime not in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf') then
    raise exception 'INVALID_FILE';
  end if;
  insert into public.complaint_attachments (complaint_id, message_id, uploaded_by, storage_path, file_name, mime_type, size_bytes)
  values (p_complaint, p_message, auth.uid(), p_path, left(p_name, 200), p_mime, p_size)
  returning id into v_id;
  return v_id;
end;
$$;

-- Reporter reply or staff reply / internal note. Status side effects:
--   user replies while WAITING_FOR_USER -> IN_REVIEW
--   staff public reply may set a new status in the same step
create or replace function public.add_complaint_message(
  p_complaint uuid, p_body text, p_internal boolean default false, p_new_status text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_c public.complaints;
  v_staff boolean := public.is_staff();
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into v_c from public.complaints where id = p_complaint for update;
  if not found then raise exception 'COMPLAINT_NOT_FOUND'; end if;
  if not v_staff and v_c.reporter_id is distinct from auth.uid() then raise exception 'NOT_ALLOWED'; end if;
  if not v_staff and v_c.status::text in ('CLOSED', 'REJECTED') then raise exception 'COMPLAINT_CLOSED'; end if;

  insert into public.complaint_messages (complaint_id, author_id, from_staff, is_internal, body)
  values (p_complaint, auth.uid(), v_staff, v_staff and coalesce(p_internal, false), trim(p_body))
  returning id into v_id;

  if v_staff and not coalesce(p_internal, false) then
    perform public._notify(v_c.reporter_id, 'complaint_reply', jsonb_build_object('ref', v_c.ref), '/help/' || v_c.id);
    perform public._audit('complaint_replied', 'complaint', v_c.id::text, null, null, jsonb_build_object('ref', v_c.ref));
  elsif v_staff then
    perform public._audit('complaint_note_added', 'complaint', v_c.id::text, null, null, jsonb_build_object('ref', v_c.ref));
  end if;

  if v_staff and p_new_status is not null then
    update public.complaints set status = p_new_status::public.complaint_status, last_activity_at = now() where id = p_complaint;
  elsif not v_staff and v_c.status::text = 'WAITING_FOR_USER' then
    update public.complaints set status = 'IN_REVIEW', last_activity_at = now() where id = p_complaint;
    perform public._admin_event('complaint_user_reply', 'info', 'complaint', v_c.id::text, jsonb_build_object('ref', v_c.ref));
  else
    update public.complaints set last_activity_at = now() where id = p_complaint;
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_update_complaint(
  p_complaint uuid, p_status text default null, p_assigned_to uuid default null,
  p_unassign boolean default false, p_severity text default null
) returns void language plpgsql security definer set search_path = public as $$
declare v_old public.complaints; v_new public.complaints;
begin
  perform public._require_rank(1);
  select * into v_old from public.complaints where id = p_complaint for update;
  if not found then raise exception 'COMPLAINT_NOT_FOUND'; end if;
  if p_assigned_to is not null and public.role_rank((select role::text from public.profiles where id = p_assigned_to)) < 1 then
    raise exception 'INVALID_ASSIGNEE';
  end if;
  update public.complaints set
    status = coalesce(p_status::public.complaint_status, status),
    severity = coalesce(p_severity::public.complaint_severity, severity),
    assigned_to = case when p_unassign then null else coalesce(p_assigned_to, assigned_to) end,
    last_activity_at = now()
  where id = p_complaint returning * into v_new;
  perform public._audit('complaint_updated', 'complaint', p_complaint::text,
    jsonb_build_object('status', v_old.status, 'severity', v_old.severity, 'assigned_to', v_old.assigned_to),
    jsonb_build_object('status', v_new.status, 'severity', v_new.severity, 'assigned_to', v_new.assigned_to),
    jsonb_build_object('ref', v_new.ref));
end;
$$;

-- Used by the server route that emails new complaints to the admin
-- address. The reporter may fetch/mark their own pending complaint once;
-- staff may do it any time (resend).
create or replace function public.complaint_email_payload(p_complaint uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v jsonb;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select jsonb_build_object(
    'id', c.id, 'ref', c.ref, 'created_at', c.created_at, 'category', c.category, 'severity', c.severity,
    'status', c.status, 'subject', c.subject, 'description', c.description, 'contact', c.contact,
    'is_anonymous', c.is_anonymous,
    'reporter', case when c.is_anonymous then null else jsonb_build_object(
        'name', coalesce(p.full_name, p.nickname, p.username), 'username', p.username, 'email', u.email) end,
    'event', case when e.id is null then null else jsonb_build_object('id', e.id, 'ref', e.ref, 'title', e.title) end,
    'related_user', case when ru.id is null then null else jsonb_build_object('username', ru.username, 'name', coalesce(ru.full_name, ru.nickname)) end,
    'attachments', (select coalesce(jsonb_agg(jsonb_build_object('name', a.file_name, 'path', a.storage_path)), '[]')
                    from public.complaint_attachments a where a.complaint_id = c.id),
    'email_status', c.email_status,
    'email_enabled', coalesce((select (value #>> '{}')::boolean from public.platform_settings
                               where key = 'complaint_email_enabled'), true))
  into v
  from public.complaints c
  left join public.profiles p on p.id = c.reporter_id
  left join auth.users u on u.id = c.reporter_id
  left join public.events e on e.id = c.related_event_id
  left join public.profiles ru on ru.id = c.related_user_id
  where c.id = p_complaint
    and (public.is_staff() or (c.reporter_id = auth.uid() and c.email_status = 'pending'));
  if v is null then raise exception 'NOT_ALLOWED'; end if;
  return v;
end;
$$;

create or replace function public.set_complaint_email_status(p_complaint uuid, p_status text, p_error text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_status not in ('sent', 'failed', 'skipped') then raise exception 'INVALID_STATUS'; end if;
  update public.complaints set email_status = p_status, email_error = left(p_error, 500)
  where id = p_complaint
    and (public.is_staff() or (reporter_id = auth.uid() and email_status = 'pending'));
  if not found then raise exception 'NOT_ALLOWED'; end if;
end;
$$;

-- ---------------------------------------------------------
-- 6. PLATFORM SETTINGS, SAVED VIEWS, EXPORT JOBS
-- ---------------------------------------------------------

create table if not exists public.platform_settings (
  key text primary key,
  value jsonb not null,
  is_public boolean not null default false, -- readable by every signed-in user
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings (key, value, is_public) values
  ('dashboard_radius_km', '20', true),
  ('default_event_capacity', '10', true),
  ('complaint_rate_limit_per_hour', '5', false),
  ('complaint_email_enabled', 'true', false),
  ('feature_flags', '{"event_banners": true, "complaint_attachments": true, "gps_assist": true}', true)
on conflict (key) do nothing;

create or replace function public.admin_set_setting(p_key text, p_value jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  perform public._require_rank(2);
  select value into v_old from public.platform_settings where key = p_key;
  if not found then raise exception 'UNKNOWN_SETTING'; end if;
  update public.platform_settings set value = p_value, updated_by = auth.uid(), updated_at = now() where key = p_key;
  perform public._audit('setting_changed', 'setting', p_key, v_old, p_value);
end;
$$;

create table if not exists public.saved_views (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  page text not null,
  name text not null check (char_length(name) between 1 and 60),
  filters jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.export_jobs (
  id uuid primary key default uuid_generate_v4(),
  requested_by uuid references public.profiles(id) on delete set null,
  dataset text not null,
  format text not null check (format in ('xlsx', 'docx', 'png')),
  scope text not null default 'full',
  filters jsonb not null default '{}',
  status text not null default 'running' check (status in ('running', 'completed', 'failed')),
  row_count int,
  error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create or replace function public.start_export(p_dataset text, p_format text, p_scope text, p_filters jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  perform public._require_rank(2);
  insert into public.export_jobs (requested_by, dataset, format, scope, filters)
  values (auth.uid(), p_dataset, p_format, coalesce(p_scope, 'full'), coalesce(p_filters, '{}'))
  returning id into v_id;
  perform public._audit('data_exported', 'export', v_id::text, null,
    jsonb_build_object('dataset', p_dataset, 'format', p_format, 'scope', p_scope, 'filters', p_filters));
  return v_id;
end;
$$;

create or replace function public.finish_export(p_id uuid, p_ok boolean, p_rows int, p_error text default null)
returns void language sql security definer set search_path = public as $$
  update public.export_jobs
  set status = case when p_ok then 'completed' else 'failed' end, row_count = p_rows,
      error = left(p_error, 500), completed_at = now()
  where id = p_id and requested_by = auth.uid();
$$;

-- Client-reported actions for the audit log (whitelisted).
create or replace function public.log_admin_action(p_action text, p_meta jsonb default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  if p_action not in ('admin_login', 'chart_exported', 'dashboard_exported') then raise exception 'NOT_ALLOWED'; end if;
  -- One admin_login entry per 12 hours is enough.
  if p_action = 'admin_login' and exists (
    select 1 from public.audit_logs where actor_id = auth.uid() and action = 'admin_login'
      and created_at > now() - interval '12 hours') then
    return;
  end if;
  perform public._audit(p_action, 'session', auth.uid()::text, null, null, p_meta);
end;
$$;

-- Unexpected client errors surface in the admin feed / System Health.
create or replace function public.report_client_error(p_context text, p_message text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.admin_events where type = 'system_error'
        and params ->> 'user' = auth.uid()::text and created_at > now() - interval '1 hour') >= 10 then
    return; -- rate limit
  end if;
  perform public._admin_event('system_error', 'warning', 'client', null,
    jsonb_build_object('context', left(p_context, 100), 'message', left(p_message, 500), 'user', auth.uid()));
end;
$$;

-- ---------------------------------------------------------
-- 7. ACTIVITY TRIGGERS (feed, notifications, audit of staff edits)
-- ---------------------------------------------------------

create or replace function public.profiles_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public._admin_event('user_registered', 'info', 'user', new.id::text, jsonb_build_object('username', new.username));
  elsif new.account_status is distinct from old.account_status then
    perform public._admin_event('user_' || new.account_status::text, 'warning', 'user', new.id::text,
      jsonb_build_object('username', new.username));
    perform public._notify(new.id, 'account_status', jsonb_build_object('status', new.account_status), '/settings');
  end if;
  return null;
end;
$$;
drop trigger if exists trg_profiles_after_write on public.profiles;
create trigger trg_profiles_after_write after insert or update on public.profiles
for each row execute function public.profiles_after_write();

create or replace function public.events_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare d record;
begin
  if tg_op = 'INSERT' then
    perform public._admin_event('event_created', 'info', 'event', new.id::text,
      jsonb_build_object('ref', new.ref, 'title', new.title));
    return null;
  end if;

  if new.status = 'full' and old.status is distinct from 'full' then
    perform public._admin_event('event_full', 'info', 'event', new.id::text, jsonb_build_object('ref', new.ref, 'title', new.title));
  end if;
  if new.status = 'cancelled' and old.status is distinct from 'cancelled' then
    perform public._admin_event('event_cancelled', 'warning', 'event', new.id::text, jsonb_build_object('ref', new.ref, 'title', new.title));
    insert into public.notifications (user_id, type, params, link)
    select ep.user_id, 'event_cancelled', jsonb_build_object('title', new.title), '/activities/' || new.id
    from public.event_participants ep where ep.event_id = new.id and ep.status in ('approved', 'pending');
  end if;

  -- Staff editing someone else's event is audited with before/after values.
  if auth.uid() is not null and auth.uid() <> new.creator_id and public.is_staff() then
    select * into d from public._diff(to_jsonb(old), to_jsonb(new));
    if d.new_part is not null then
      perform public._audit(
        case when new.status = 'cancelled' and old.status <> 'cancelled' then 'event_cancelled'
             when old.status = 'cancelled' and new.status <> 'cancelled' then 'event_restored'
             when new.banner_url is distinct from old.banner_url then 'banner_replaced'
             else 'event_updated' end,
        'event', new.id::text, d.old_part, d.new_part, jsonb_build_object('ref', new.ref));
    end if;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_events_after_write on public.events;
create trigger trg_events_after_write after insert or update on public.events
for each row execute function public.events_after_write();

create or replace function public.participants_after_write()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_event public.events;
begin
  select * into v_event from public.events where id = coalesce(new.event_id, old.event_id);
  if v_event.id is null then return null; end if; -- event itself is being deleted

  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public._notify(v_event.creator_id, 'join_request', jsonb_build_object('title', v_event.title), '/notifications');
  elsif tg_op = 'UPDATE' and new.status is distinct from old.status and new.status in ('approved', 'rejected') then
    perform public._notify(new.user_id, 'join_' || new.status::text, jsonb_build_object('title', v_event.title), '/activities/' || v_event.id);
  end if;

  if auth.uid() is not null and public.is_staff() and auth.uid() <> v_event.creator_id
     and auth.uid() <> coalesce(new.user_id, old.user_id) then
    perform public._audit(
      case tg_op when 'INSERT' then 'participant_added' when 'DELETE' then 'participant_removed' else 'participant_updated' end,
      'event', v_event.id::text,
      case when tg_op <> 'INSERT' then jsonb_build_object('user_id', old.user_id, 'status', old.status) end,
      case when tg_op <> 'DELETE' then jsonb_build_object('user_id', new.user_id, 'status', new.status) end,
      jsonb_build_object('ref', v_event.ref));
  end if;
  return null;
end;
$$;
drop trigger if exists trg_participants_after_write on public.event_participants;
create trigger trg_participants_after_write after insert or update or delete on public.event_participants
for each row execute function public.participants_after_write();

-- ---------------------------------------------------------
-- 8. ADMIN MANAGEMENT RPCs
-- ---------------------------------------------------------

create or replace function public.admin_list_users(
  p_search text default null, p_status text default null, p_role text default null, p_city text default null,
  p_sort text default 'newest', p_limit int default 25, p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public._require_rank(1);
  return (
    with base as (
      select p.*, u.email, u.last_sign_in_at
      from public.profiles p left join auth.users u on u.id = p.id
      where (q is null or p.full_name ilike '%' || q || '%' or p.nickname ilike '%' || q || '%'
             or p.username ilike '%' || q || '%' or u.email ilike '%' || q || '%')
        and (p_status is null or p.account_status::text = p_status)
        and (p_role is null or p.role::text = p_role)
        and (p_city is null or p.city_id = p_city)
    ),
    page as (
      select * from base
      order by
        case when p_sort = 'oldest' then created_at end asc,
        case when p_sort = 'name' then coalesce(full_name, nickname, username) end asc,
        case when p_sort = 'last_active' then last_sign_in_at end desc nulls last,
        created_at desc
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', b.id, 'username', b.username, 'display_name', coalesce(b.full_name, b.nickname, b.username),
        'email', b.email, 'role', b.role, 'account_status', b.account_status, 'city', b.city,
        'gender', b.gender, 'created_at', b.created_at, 'last_sign_in_at', b.last_sign_in_at,
        'onboarded', b.onboarding_completed_at is not null,
        'events_created', (select count(*) from public.events e where e.creator_id = b.id),
        'events_joined', (select count(*) from public.event_participants ep where ep.user_id = b.id and ep.status = 'approved'),
        'complaints', (select count(*) from public.complaints c where c.reporter_id = b.id))) from page b), '[]'))
  );
end;
$$;

create or replace function public.admin_user_detail(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public._require_rank(1);
  return (
    select jsonb_build_object(
      'profile', to_jsonb(p) - 'last_lat' - 'last_lng',
      'email', u.email, 'last_sign_in_at', u.last_sign_in_at, 'email_confirmed_at', u.email_confirmed_at,
      'interests', (select coalesce(jsonb_agg(ui.interest_id), '[]') from public.user_interests ui where ui.user_id = p.id),
      'created_events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'ref', e.ref, 'title', e.title,
          'event_date', e.event_date, 'status', e.status) order by e.event_date desc), '[]')
          from public.events e where e.creator_id = p.id),
      'joined_events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'ref', e.ref, 'title', e.title,
          'event_date', e.event_date, 'participation', ep.status) order by e.event_date desc), '[]')
          from public.event_participants ep join public.events e on e.id = ep.event_id where ep.user_id = p.id),
      'complaints', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'ref', c.ref, 'subject', c.subject,
          'status', c.status, 'created_at', c.created_at) order by c.created_at desc), '[]')
          from public.complaints c where c.reporter_id = p.id or c.related_user_id = p.id),
      'history', (select coalesce(jsonb_agg(jsonb_build_object('action', a.action, 'created_at', a.created_at,
          'actor', (select username from public.profiles where id = a.actor_id), 'new_value', a.new_value)
          order by a.created_at desc), '[]')
          from (select * from public.audit_logs where entity = 'user' and entity_id = p.id::text
                order by created_at desc limit 50) a))
    from public.profiles p left join auth.users u on u.id = p.id
    where p.id = p_user);
end;
$$;

create or replace function public.admin_update_user(p_user uuid, p_patch jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb; v_new jsonb; d record;
  allowed text[] := array['full_name', 'nickname', 'gender', 'whatsapp_number', 'bio', 'province_id', 'province',
                          'city_id', 'city', 'kecamatan_id', 'kecamatan', 'kelurahan_id', 'kelurahan', 'area_lat', 'area_lng'];
  k text;
begin
  perform public._require_rank(2);
  for k in select jsonb_object_keys(p_patch) loop
    if not k = any (allowed) then raise exception 'FIELD_NOT_EDITABLE: %', k; end if;
  end loop;
  select to_jsonb(p) into v_old from public.profiles p where id = p_user;
  if v_old is null then raise exception 'USER_NOT_FOUND'; end if;

  update public.profiles p set
    full_name = case when p_patch ? 'full_name' then p_patch ->> 'full_name' else full_name end,
    nickname = case when p_patch ? 'nickname' then p_patch ->> 'nickname' else nickname end,
    gender = case when p_patch ? 'gender' then (p_patch ->> 'gender')::public.gender_type else gender end,
    whatsapp_number = case when p_patch ? 'whatsapp_number' then p_patch ->> 'whatsapp_number' else whatsapp_number end,
    bio = case when p_patch ? 'bio' then p_patch ->> 'bio' else bio end,
    province_id = case when p_patch ? 'province_id' then p_patch ->> 'province_id' else province_id end,
    province = case when p_patch ? 'province' then p_patch ->> 'province' else province end,
    city_id = case when p_patch ? 'city_id' then p_patch ->> 'city_id' else city_id end,
    city = case when p_patch ? 'city' then p_patch ->> 'city' else city end,
    kecamatan_id = case when p_patch ? 'kecamatan_id' then p_patch ->> 'kecamatan_id' else kecamatan_id end,
    kecamatan = case when p_patch ? 'kecamatan' then p_patch ->> 'kecamatan' else kecamatan end,
    kelurahan_id = case when p_patch ? 'kelurahan_id' then p_patch ->> 'kelurahan_id' else kelurahan_id end,
    kelurahan = case when p_patch ? 'kelurahan' then p_patch ->> 'kelurahan' else kelurahan end,
    area_lat = case when p_patch ? 'area_lat' then (p_patch ->> 'area_lat')::double precision else area_lat end,
    area_lng = case when p_patch ? 'area_lng' then (p_patch ->> 'area_lng')::double precision else area_lng end
  where id = p_user
  returning to_jsonb(p) into v_new;

  select * into d from public._diff(v_old, v_new);
  if d.new_part is not null then perform public._audit('user_updated', 'user', p_user::text, d.old_part, d.new_part); end if;
end;
$$;

create or replace function public.admin_set_user_interests(p_user uuid, p_interest_ids uuid[], p_primary uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_old jsonb;
begin
  perform public._require_rank(2);
  if p_primary is null or not (p_primary = any (p_interest_ids)) then raise exception 'PRIMARY_NOT_SELECTED'; end if;
  select jsonb_build_object('interests', coalesce(jsonb_agg(interest_id), '[]'),
                            'primary', (select primary_interest_id from public.profiles where id = p_user))
    into v_old from public.user_interests where user_id = p_user;
  delete from public.user_interests where user_id = p_user and interest_id <> all (p_interest_ids);
  insert into public.user_interests (user_id, interest_id) select p_user, i from unnest(p_interest_ids) i on conflict do nothing;
  update public.profiles set primary_interest_id = p_primary where id = p_user;
  perform public._audit('user_interests_changed', 'user', p_user::text, v_old,
    jsonb_build_object('interests', to_jsonb(p_interest_ids), 'primary', p_primary));
end;
$$;

create or replace function public.admin_set_account_status(p_user uuid, p_status text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text; v_target_rank int;
begin
  perform public._require_rank(2);
  if p_user = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  select account_status::text, public.role_rank(role::text) into v_old, v_target_rank from public.profiles where id = p_user;
  if v_old is null then raise exception 'USER_NOT_FOUND'; end if;
  -- Admins can't suspend peers or superiors; only a super admin can.
  if v_target_rank >= public.my_role_rank() and not public.is_super_admin() then raise exception 'NOT_ALLOWED'; end if;
  update public.profiles set account_status = p_status::public.account_status,
    status_reason = nullif(trim(coalesce(p_reason, '')), ''), status_changed_at = now()
  where id = p_user;
  perform public._audit(case p_status when 'active' then 'user_restored' when 'suspended' then 'user_suspended' else 'user_deactivated' end,
    'user', p_user::text, jsonb_build_object('account_status', v_old),
    jsonb_build_object('account_status', p_status, 'reason', p_reason));
end;
$$;

create or replace function public.admin_set_role(p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare v_old text;
begin
  perform public._require_rank(3); -- super_admin only
  if p_role not in ('participant', 'moderator', 'admin', 'super_admin') then raise exception 'INVALID_ROLE'; end if;
  select role::text into v_old from public.profiles where id = p_user;
  if v_old is null then raise exception 'USER_NOT_FOUND'; end if;
  if v_old = 'super_admin' and p_role <> 'super_admin'
     and (select count(*) from public.profiles where role::text = 'super_admin' and account_status = 'active') <= 1 then
    raise exception 'LAST_SUPER_ADMIN';
  end if;
  update public.profiles set role = p_role::public.user_role where id = p_user;
  perform public._audit('role_changed', 'user', p_user::text, jsonb_build_object('role', v_old), jsonb_build_object('role', p_role));
end;
$$;

-- Privacy-preserving "delete": strips personal data and deactivates the
-- account. (Removing the auth login itself needs the service-role key.)
create or replace function public.admin_anonymize_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(3);
  if p_user = auth.uid() then raise exception 'CANNOT_CHANGE_SELF'; end if;
  update public.profiles set
    full_name = null, nickname = null, bio = null, whatsapp_number = null, gender = null, age = null,
    avatar_url = null, province_id = null, province = null, city_id = null, city = null,
    kecamatan_id = null, kecamatan = null, kelurahan_id = null, kelurahan = null,
    area_lat = null, area_lng = null, last_lat = null, last_lng = null,
    username = 'deleted_' || substr(replace(id::text, '-', ''), 1, 10),
    account_status = 'deactivated', status_reason = 'anonymized', status_changed_at = now()
  where id = p_user;
  delete from public.user_interests where user_id = p_user;
  perform public._audit('user_anonymized', 'user', p_user::text);
end;
$$;

-- Events matching the admin filters (shared by list + analytics).
create or replace function public._events_in_scope(
  p_from date, p_to date, p_category uuid, p_city text, p_status text, p_organizer uuid, p_search text
) returns setof public.events language sql stable security definer set search_path = public as $$
  select e.* from public.events e left join public.profiles o on o.id = e.creator_id
  where (p_from is null or e.event_date >= p_from)
    and (p_to is null or e.event_date <= p_to)
    and (p_category is null or e.category_id = p_category)
    and (p_city is null or o.city_id = p_city)
    and (p_status is null or public.event_phase(e) = p_status)
    and (p_organizer is null or e.creator_id = p_organizer)
    and (p_search is null or e.title ilike '%' || p_search || '%' or e.ref = upper(p_search)
         or e.event_code = upper(p_search) or e.location_name ilike '%' || p_search || '%'
         or o.username ilike '%' || p_search || '%');
$$;

create or replace function public.admin_list_events(
  p_search text default null, p_status text default null, p_category uuid default null, p_city text default null,
  p_from date default null, p_to date default null, p_organizer uuid default null,
  p_limit int default 25, p_offset int default 0
) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return (
    with base as (
      select * from public._events_in_scope(p_from, p_to, p_category, p_city, p_status, p_organizer,
                                             nullif(trim(coalesce(p_search, '')), ''))
    ),
    page as (
      select * from base order by event_date desc, start_time desc
      limit least(greatest(p_limit, 1), 200) offset greatest(p_offset, 0)
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'ref', e.ref, 'title', e.title, 'event_date', e.event_date, 'start_time', e.start_time,
        'end_time', e.end_time, 'status', e.status, 'phase', public.event_phase(e::public.events), 'privacy', e.privacy,
        'fee', e.fee, 'max_participants', e.max_participants, 'participant_count', e.participant_count,
        'location_name', e.location_name, 'latitude', e.latitude, 'longitude', e.longitude,
        'category', (select jsonb_build_object('key', c.key, 'label', c.label, 'emoji', c.emoji) from public.categories c where c.id = e.category_id),
        'organizer', (select jsonb_build_object('id', o.id, 'username', o.username, 'name', coalesce(o.full_name, o.nickname), 'city', o.city)
                      from public.profiles o where o.id = e.creator_id),
        'open_complaints', (select count(*) from public.complaints c where c.related_event_id = e.id
                             and c.status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')))
        order by e.event_date desc, e.start_time desc) from page e), '[]'))
  );
end;
$$;

create or replace function public.admin_add_participant(p_event uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_event public.events;
begin
  perform public._require_rank(2);
  select * into v_event from public.events where id = p_event for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if public.approved_count(p_event) >= v_event.max_participants then raise exception 'EVENT_FULL'; end if;
  insert into public.event_participants (event_id, user_id, status) values (p_event, p_user, 'approved')
  on conflict (event_id, user_id) do update set status = 'approved';
end;
$$;

create or replace function public.admin_restore_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(2);
  update public.events set status = 'open' where id = p_event and status = 'cancelled';
  if not found then raise exception 'EVENT_NOT_CANCELLED'; end if;
end;
$$;

create or replace function public.admin_bulk_cancel_events(p_ids uuid[])
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require_rank(2);
  update public.events set status = 'cancelled' where id = any (p_ids) and status <> 'cancelled';
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.admin_upsert_interest(p_id uuid, p_key text, p_label text, p_emoji text, p_active boolean, p_sort int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old jsonb;
begin
  perform public._require_rank(2);
  if p_id is null then
    insert into public.interests (key, label, emoji, is_active, sort_order)
    values (lower(regexp_replace(p_key, '[^a-zA-Z0-9_]', '_', 'g')), p_label, p_emoji, coalesce(p_active, true), coalesce(p_sort, 0))
    returning id into v_id;
    perform public._audit('hobby_created', 'hobby', v_id::text, null, jsonb_build_object('key', p_key, 'label', p_label));
  else
    select to_jsonb(i) into v_old from public.interests i where id = p_id;
    -- The key is referenced by translations; it can't change after creation.
    update public.interests set label = p_label, emoji = p_emoji, is_active = coalesce(p_active, is_active),
      sort_order = coalesce(p_sort, sort_order) where id = p_id returning id into v_id;
    perform public._audit('hobby_updated', 'hobby', p_id::text, v_old, jsonb_build_object('label', p_label, 'emoji', p_emoji, 'is_active', p_active));
  end if;
  return v_id;
end;
$$;

create or replace function public.admin_upsert_category(p_id uuid, p_key text, p_label text, p_emoji text, p_active boolean, p_sort int default 0)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_old jsonb;
begin
  perform public._require_rank(2);
  if p_id is null then
    insert into public.categories (key, label, emoji, is_active, sort_order)
    values (lower(regexp_replace(p_key, '[^a-zA-Z0-9_]', '_', 'g')), p_label, p_emoji, coalesce(p_active, true), coalesce(p_sort, 0))
    returning id into v_id;
    perform public._audit('category_created', 'category', v_id::text, null, jsonb_build_object('key', p_key, 'label', p_label));
  else
    select to_jsonb(c) into v_old from public.categories c where id = p_id;
    update public.categories set label = p_label, emoji = p_emoji, is_active = coalesce(p_active, is_active),
      sort_order = coalesce(p_sort, sort_order) where id = p_id returning id into v_id;
    perform public._audit('category_updated', 'category', p_id::text, v_old, jsonb_build_object('label', p_label, 'emoji', p_emoji, 'is_active', p_active));
  end if;
  return v_id;
end;
$$;

-- Global admin search. Exact references (EVT-…, CPL-…, event codes, share
-- tokens) come first.
create or replace function public.admin_search(p_q text)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare q text := trim(coalesce(p_q, '')); v jsonb;
begin
  perform public._require_rank(1);
  if char_length(q) < 2 then return '[]'; end if;
  select coalesce(jsonb_agg(r), '[]') into v from (
    (select jsonb_build_object('type', 'event', 'id', id, 'title', title, 'subtitle', ref, 'exact', true) r
       from public.events where ref = upper(q) or event_code = upper(q) or share_token = upper(q))
    union all
    (select jsonb_build_object('type', 'complaint', 'id', id, 'title', subject, 'subtitle', ref, 'exact', true)
       from public.complaints where ref = upper(q))
    union all
    (select jsonb_build_object('type', 'user', 'id', p.id, 'title', coalesce(p.full_name, p.nickname, p.username),
        'subtitle', '@' || p.username || coalesce(' · ' || u.email, ''), 'exact', false)
       from public.profiles p left join auth.users u on u.id = p.id
      where p.full_name ilike '%' || q || '%' or p.nickname ilike '%' || q || '%' or p.username ilike '%' || q || '%'
         or u.email ilike '%' || q || '%' limit 8)
    union all
    (select jsonb_build_object('type', 'event', 'id', id, 'title', title, 'subtitle', ref || ' · ' || location_name, 'exact', false)
       from public.events where (title ilike '%' || q || '%' or location_name ilike '%' || q || '%')
        and ref is distinct from upper(q) limit 8)
    union all
    (select jsonb_build_object('type', 'complaint', 'id', id, 'title', subject, 'subtitle', ref, 'exact', false)
       from public.complaints where subject ilike '%' || q || '%' limit 8)
    union all
    (select jsonb_build_object('type', 'category', 'id', id, 'title', emoji || ' ' || label, 'subtitle', key, 'exact', false)
       from public.categories where label ilike '%' || q || '%' or key ilike '%' || q || '%' limit 5)
    union all
    (select jsonb_build_object('type', 'location', 'id', city_id, 'title', max(city), 'subtitle', count(*)::text, 'exact', false)
       from public.profiles where city ilike '%' || q || '%' and city_id is not null group by city_id limit 5)
  ) s;
  return v;
end;
$$;

-- ---------------------------------------------------------
-- 9. ANALYTICS (aggregated in the database; only counts leave it)
-- ---------------------------------------------------------

create or replace function public._bucket_unit(p_from timestamptz, p_to timestamptz)
returns text language sql immutable as $$
  select case when p_to - p_from > interval '400 days' then 'month'
              when p_to - p_from > interval '100 days' then 'week' else 'day' end;
$$;

create or replace function public.admin_dashboard_kpis(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v_len interval := p_to - p_from;
  v_today date := (public.jakarta_now())::date;
  v_week_start date := v_today - ((extract(isodow from v_today)::int) - 1);
  v_month_start date := date_trunc('month', v_today)::date;
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'new_users', (select count(*) from public.profiles where created_at >= p_from and created_at < p_to),
    'new_users_prev', (select count(*) from public.profiles where created_at >= p_from - v_len and created_at < p_from),
    'active_users', (select count(*) from auth.users where last_sign_in_at >= p_from and last_sign_in_at < p_to),
    'suspended_users', (select count(*) from public.profiles where account_status <> 'active'),
    'total_events', (select count(*) from public.events),
    'events_created', (select count(*) from public.events where created_at >= p_from and created_at < p_to),
    'events_created_prev', (select count(*) from public.events where created_at >= p_from - v_len and created_at < p_from),
    'upcoming_events', (select count(*) from public.events e where e.status <> 'cancelled' and (e.event_date + e.start_time) > public.jakarta_now()),
    'completed_events', (select count(*) from public.events e where e.status <> 'cancelled' and (e.event_date + e.end_time) <= public.jakarta_now()),
    'cancelled_events', (select count(*) from public.events where status = 'cancelled'),
    'total_participants', (select count(*) from public.event_participants where status = 'approved'),
    'joins', (select count(*) from public.event_participants where status = 'approved' and joined_at >= p_from and joined_at < p_to),
    'joins_prev', (select count(*) from public.event_participants where status = 'approved' and joined_at >= p_from - v_len and joined_at < p_from),
    'active_communities', (select count(distinct category_id) from public.events e
                            where e.status <> 'cancelled' and e.event_date >= (p_from at time zone 'Asia/Jakarta')::date
                              and e.event_date <= (p_to at time zone 'Asia/Jakarta')::date),
    'open_complaints', (select count(*) from public.complaints where status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')),
    'critical_complaints', (select count(*) from public.complaints where severity::text = 'CRITICAL' and status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')),
    'events_this_week', (select count(*) from public.events where status <> 'cancelled' and event_date between v_week_start and v_week_start + 6),
    'events_this_month', (select count(*) from public.events where status <> 'cancelled'
                           and event_date >= v_month_start and event_date < (v_month_start + interval '1 month')::date)
  );
end;
$$;

create or replace function public.admin_user_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  u text := public._bucket_unit(p_from, p_to);
  v_before int := (select count(*) from public.profiles where created_at < p_from);
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'unit', u,
    'growth', (
      select coalesce(jsonb_agg(jsonb_build_object('t', to_char(g.b, 'YYYY-MM-DD'), 'new', g.n, 'total', g.total) order by g.b), '[]')
      from (
        select s.b, coalesce(c.n, 0) n, v_before + sum(coalesce(c.n, 0)) over (order by s.b) total
        from generate_series(date_trunc(u, p_from at time zone 'Asia/Jakarta'), date_trunc(u, p_to at time zone 'Asia/Jakarta'), ('1 ' || u)::interval) s(b)
        left join (select date_trunc(u, created_at at time zone 'Asia/Jakarta') b, count(*) n from public.profiles
                   where created_at >= p_from and created_at < p_to group by 1) c using (b)
      ) g),
    'total', (select count(*) from public.profiles),
    'onboarded', (select count(*) from public.profiles where onboarding_completed_at is not null),
    'active', (select count(*) from auth.users where last_sign_in_at >= p_from and last_sign_in_at < p_to),
    'inactive', (select count(*) from public.profiles p join auth.users x on x.id = p.id
                 where x.last_sign_in_at is null or x.last_sign_in_at < p_from),
    -- Retention (measurable with auth data): signed in again 7+ days after signing up.
    'retained', (select count(*) from public.profiles p join auth.users x on x.id = p.id
                 where p.created_at < now() - interval '7 days' and x.last_sign_in_at >= p.created_at + interval '7 days'),
    'retention_base', (select count(*) from public.profiles where created_at < now() - interval '7 days'),
    'by_city', (select coalesce(jsonb_agg(jsonb_build_object('id', city_id, 'label', city, 'v', n) order by n desc), '[]')
                from (select city_id, max(city) city, count(*) n from public.profiles where city_id is not null
                      group by city_id order by n desc limit 15) x),
    'by_kecamatan', (select coalesce(jsonb_agg(jsonb_build_object('label', kecamatan || ', ' || city, 'v', n) order by n desc), '[]')
                from (select kecamatan_id, max(kecamatan) kecamatan, max(city) city, count(*) n from public.profiles
                      where kecamatan_id is not null group by kecamatan_id order by n desc limit 15) x),
    'by_kelurahan', (select coalesce(jsonb_agg(jsonb_build_object('label', kelurahan || ', ' || kecamatan, 'v', n) order by n desc), '[]')
                from (select kelurahan_id, max(kelurahan) kelurahan, max(kecamatan) kecamatan, count(*) n from public.profiles
                      where kelurahan_id is not null group by kelurahan_id order by n desc limit 15) x),
    'by_gender', (select coalesce(jsonb_agg(jsonb_build_object('key', coalesce(gender::text, 'unknown'), 'v', n)), '[]')
                  from (select gender, count(*) n from public.profiles group by gender) x),
    'by_age', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'v', n) order by k), '[]') from (
                 select case when age is null then 'unknown' when age < 18 then '<18' when age < 25 then '18-24'
                             when age < 35 then '25-34' when age < 45 then '35-44' else '45+' end k, count(*) n
                 from public.profiles group by 1) x),
    'by_primary', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji, 'v', n) order by n desc), '[]')
                   from (select primary_interest_id, count(*) n from public.profiles where primary_interest_id is not null group by 1) x
                   join public.interests i on i.id = x.primary_interest_id),
    'by_hobby', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji, 'v', n) order by n desc), '[]')
                 from (select interest_id, count(*) n from public.user_interests group by 1) x
                 join public.interests i on i.id = x.interest_id)
  );
end;
$$;

create or replace function public.admin_event_analytics(
  p_from timestamptz, p_to timestamptz, p_category uuid default null, p_city text default null,
  p_status text default null, p_organizer uuid default null
) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  u text := public._bucket_unit(p_from, p_to);
  d_from date := (p_from at time zone 'Asia/Jakarta')::date;
  d_to date := (p_to at time zone 'Asia/Jakarta')::date;
begin
  perform public._require_rank(1);
  return (
    with ea as (select * from public._events_in_scope(d_from, d_to, p_category, p_city, p_status, p_organizer, null))
    select jsonb_build_object(
      'unit', u,
      'total', (select count(*) from ea),
      'created_series', (
        select coalesce(jsonb_agg(jsonb_build_object('t', to_char(s.b, 'YYYY-MM-DD'), 'v', coalesce(c.n, 0)) order by s.b), '[]')
        from generate_series(date_trunc(u, p_from at time zone 'Asia/Jakarta'), date_trunc(u, p_to at time zone 'Asia/Jakarta'), ('1 ' || u)::interval) s(b)
        left join (select date_trunc(u, created_at at time zone 'Asia/Jakarta') b, count(*) n from public.events
                   where created_at >= p_from and created_at < p_to
                     and (p_category is null or category_id = p_category) group by 1) c using (b)),
      'participation_series', (
        select coalesce(jsonb_agg(jsonb_build_object('t', to_char(s.b, 'YYYY-MM-DD'), 'v', coalesce(c.n, 0)) order by s.b), '[]')
        from generate_series(date_trunc(u, p_from at time zone 'Asia/Jakarta'), date_trunc(u, p_to at time zone 'Asia/Jakarta'), ('1 ' || u)::interval) s(b)
        left join (select date_trunc(u, ep.joined_at at time zone 'Asia/Jakarta') b, count(*) n
                   from public.event_participants ep join public.events e on e.id = ep.event_id
                   where ep.status = 'approved' and ep.joined_at >= p_from and ep.joined_at < p_to
                     and (p_category is null or e.category_id = p_category) group by 1) c using (b)),
      'by_phase', (select coalesce(jsonb_agg(jsonb_build_object('key', k, 'v', n)), '[]')
                   from (select public.event_phase(e::public.events) k, count(*) n from ea e group by 1) x),
      'by_category', (select coalesce(jsonb_agg(jsonb_build_object('key', c.key, 'label', c.label, 'emoji', c.emoji, 'v', n,
                        'participants', p) order by n desc), '[]')
                      from (select category_id, count(*) n, sum(participant_count) p from ea group by 1) x
                      join public.categories c on c.id = x.category_id),
      'by_city', (select coalesce(jsonb_agg(jsonb_build_object('label', city, 'v', n) order by n desc), '[]')
                  from (select coalesce(o.city, '—') city, count(*) n from ea e left join public.profiles o on o.id = e.creator_id
                        group by 1 order by n desc limit 12) x),
      'top_places', (select coalesce(jsonb_agg(jsonb_build_object('label', location_name, 'v', n) order by n desc), '[]')
                     from (select location_name, count(*) n from ea group by 1 order by n desc limit 10) x),
      'free', (select count(*) from ea where fee = 0),
      'paid', (select count(*) from ea where fee > 0),
      'avg_fee', (select coalesce(round(avg(fee)), 0) from ea where fee > 0),
      'avg_participants', (select coalesce(round(avg(participant_count)::numeric, 1), 0) from ea where status <> 'cancelled'),
      'capacity', (select coalesce(sum(max_participants), 0) from ea where status <> 'cancelled'),
      'participants', (select coalesce(sum(participant_count), 0) from ea where status <> 'cancelled'),
      'joins', (select count(*) from public.event_participants ep join ea e on e.id = ep.event_id where ep.status = 'approved'),
      'cancelled', (select count(*) from ea where status = 'cancelled'),
      'completed', (select count(*) from ea e where public.event_phase(e::public.events) = 'completed'),
      -- Weekday (1 = Monday) x start hour, for the activity heatmap.
      'heatmap', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'h', h, 'v', n)), '[]')
                  from (select extract(isodow from event_date)::int d, extract(hour from start_time)::int h, count(*) n
                        from ea where status <> 'cancelled' group by 1, 2) x),
      'upcoming_weeks', (
        select coalesce(jsonb_agg(jsonb_build_object('t', to_char(w, 'YYYY-MM-DD'), 'v',
            (select count(*) from public.events e where e.status <> 'cancelled'
               and e.event_date >= w::date and e.event_date < (w + interval '7 days')::date)) order by w), '[]')
        from generate_series(date_trunc('week', public.jakarta_now()), date_trunc('week', public.jakarta_now()) + interval '7 weeks', interval '1 week') w)
    )
  );
end;
$$;

create or replace function public.admin_hobby_analytics(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u text := public._bucket_unit(p_from, p_to);
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'unit', u,
    'popular', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'emoji', i.emoji,
                   'v', coalesce(x.n, 0), 'primary', coalesce(pr.n, 0)) order by coalesce(x.n, 0) desc), '[]')
                from public.interests i
                left join (select interest_id, count(*) n from public.user_interests group by 1) x on x.interest_id = i.id
                left join (select primary_interest_id, count(*) n from public.profiles group by 1) pr on pr.primary_interest_id = i.id),
    -- New selections per period for the 5 most popular hobbies.
    'growth', (
      with top as (select interest_id from public.user_interests group by 1 order by count(*) desc limit 5)
      select coalesce(jsonb_agg(jsonb_build_object('t', to_char(s.b, 'YYYY-MM-DD'), 'key', i.key, 'label', i.label,
               'v', (select count(*) from public.user_interests ui where ui.interest_id = t.interest_id
                       and date_trunc(u, ui.created_at at time zone 'Asia/Jakarta') = s.b))
             order by s.b), '[]')
      from generate_series(date_trunc(u, p_from at time zone 'Asia/Jakarta'), date_trunc(u, p_to at time zone 'Asia/Jakarta'), ('1 ' || u)::interval) s(b)
      cross join top t join public.interests i on i.id = t.interest_id),
    -- Approved joins by users who have the hobby.
    'participation', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'users', x.users,
                        'joins', x.joins, 'per_user', round(x.joins::numeric / nullif(x.users, 0), 2)) order by x.joins desc), '[]')
                      from (select ui.interest_id, count(distinct ui.user_id) users, count(ep.id) joins
                            from public.user_interests ui
                            left join public.event_participants ep on ep.user_id = ui.user_id and ep.status = 'approved'
                            group by 1) x join public.interests i on i.id = x.interest_id),
    -- Hobby x city (top 8 cities) for the heatmap.
    'by_city', (
      with cities as (select city_id from public.profiles where city_id is not null group by 1 order by count(*) desc limit 8)
      select coalesce(jsonb_agg(jsonb_build_object('city', x.city, 'key', i.key, 'label', i.label, 'v', x.n)), '[]')
      from (select p.city_id, max(p.city) city, ui.interest_id, count(*) n
            from public.user_interests ui join public.profiles p on p.id = ui.user_id
            where p.city_id in (select city_id from cities) group by p.city_id, ui.interest_id) x
      join public.interests i on i.id = x.interest_id),
    'by_gender', (select coalesce(jsonb_agg(jsonb_build_object('key', i.key, 'label', i.label, 'gender', g, 'v', n)), '[]')
                  from (select ui.interest_id, coalesce(p.gender::text, 'unknown') g, count(*) n
                        from public.user_interests ui join public.profiles p on p.id = ui.user_id group by 1, 2) x
                  join public.interests i on i.id = x.interest_id)
  );
end;
$$;

create or replace function public.admin_activity_feed(p_limit int default 30)
returns setof public.admin_events language sql stable security definer set search_path = public as $$
  select * from public.admin_events where public.is_staff() order by created_at desc limit least(p_limit, 200);
$$;

-- Neutral, reviewable signals — never an accusation.
create or replace function public.admin_alerts()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare
  v jsonb := '[]';
  v_24h int := (select count(*) from public.complaints where created_at > now() - interval '1 day');
  v_base numeric := (select count(*) from public.complaints
                     where created_at between now() - interval '15 days' and now() - interval '1 day') / 14.0;
begin
  perform public._require_rank(1);
  v := v || coalesce((select jsonb_agg(jsonb_build_object('type', 'multiple_reports', 'severity', 'warning',
            'entity', 'event', 'id', e.id, 'params', jsonb_build_object('title', e.title, 'ref', e.ref, 'count', x.n)))
          from (select related_event_id, count(*) n from public.complaints
                where related_event_id is not null and status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')
                group by 1 having count(*) >= 2) x join public.events e on e.id = x.related_event_id), '[]');
  v := v || coalesce((select jsonb_agg(jsonb_build_object('type', 'critical_complaint', 'severity', 'critical',
            'entity', 'complaint', 'id', id, 'params', jsonb_build_object('ref', ref, 'subject', subject)))
          from public.complaints where severity::text = 'CRITICAL' and status::text in ('OPEN', 'IN_REVIEW', 'WAITING_FOR_USER')), '[]');
  v := v || coalesce((select jsonb_agg(jsonb_build_object('type', 'over_capacity', 'severity', 'critical',
            'entity', 'event', 'id', id, 'params', jsonb_build_object('title', title, 'ref', ref,
            'count', participant_count, 'max', max_participants)))
          from public.events where participant_count > max_participants), '[]');
  v := v || coalesce((select jsonb_agg(jsonb_build_object('type', 'invalid_location', 'severity', 'warning',
            'entity', 'event', 'id', id, 'params', jsonb_build_object('title', title, 'ref', ref)))
          from public.events where latitude not between -11.5 and 6.5 or longitude not between 94 and 141.5
             or (latitude = 0 and longitude = 0)), '[]');
  v := v || coalesce((select jsonb_agg(jsonb_build_object('type', 'organizer_inactive', 'severity', 'info',
            'entity', 'event', 'id', e.id, 'params', jsonb_build_object('title', e.title, 'ref', e.ref)))
          from public.events e join public.profiles o on o.id = e.creator_id
          where o.account_status <> 'active' and e.status <> 'cancelled' and (e.event_date + e.end_time) > public.jakarta_now()), '[]');
  if exists (select 1 from public.complaints where email_status = 'failed') then
    v := v || jsonb_build_array(jsonb_build_object('type', 'email_failed', 'severity', 'warning', 'entity', 'complaint',
      'params', jsonb_build_object('count', (select count(*) from public.complaints where email_status = 'failed'))));
  end if;
  -- Sudden increase: 24h complaints >= 5 and >= 3x the previous 14-day daily average.
  if v_24h >= 5 and v_24h >= 3 * greatest(v_base, 1) then
    v := v || jsonb_build_array(jsonb_build_object('type', 'complaint_spike', 'severity', 'warning', 'entity', 'complaint',
      'params', jsonb_build_object('count', v_24h)));
  end if;
  if exists (select 1 from public.admin_events where type = 'system_error' and created_at > now() - interval '1 day') then
    v := v || jsonb_build_array(jsonb_build_object('type', 'system_errors', 'severity', 'warning', 'entity', 'system',
      'params', jsonb_build_object('count', (select count(*) from public.admin_events
                                              where type = 'system_error' and created_at > now() - interval '1 day'))));
  end if;
  if exists (select 1 from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)) then
    v := v || jsonb_build_array(jsonb_build_object('type', 'missing_profiles', 'severity', 'critical', 'entity', 'system',
      'params', jsonb_build_object('count', (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)))));
  end if;
  return v;
end;
$$;

create or replace function public.admin_data_quality()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'incomplete_profiles', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', username, 'created_at', created_at)), '[]')
       from (select id, username, created_at from public.profiles where onboarding_completed_at is null
               and public.role_rank(role::text) = 0 and created_at < now() - interval '1 day' order by created_at limit 50) x),
    'profiles_without_location', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', username)), '[]')
       from (select id, username from public.profiles where onboarding_completed_at is not null and kelurahan_id is null limit 50) x),
    'events_without_banner', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', title, 'ref', ref)), '[]')
       from (select id, title, ref from public.events where banner_url is null and status <> 'cancelled'
               and (event_date + end_time) > public.jakarta_now() order by event_date limit 50) x),
    'invalid_coordinates', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', title, 'ref', ref)), '[]')
       from (select id, title, ref from public.events where latitude not between -11.5 and 6.5
               or longitude not between 94 and 141.5 or (latitude = 0 and longitude = 0) limit 50) x),
    'duplicate_events', (select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', title, 'ref', ref, 'count', n)), '[]')
       from (select (array_agg(id order by created_at))[1] id, min(title) title, min(ref) ref, count(*) n from public.events
             group by creator_id, lower(title), event_date having count(*) > 1 limit 50) x),
    'orphan_auth_users', (select count(*) from auth.users u where not exists (select 1 from public.profiles p where p.id = u.id)),
    'inactive_organizer_events', (select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'label', e.title, 'ref', e.ref)), '[]')
       from public.events e join public.profiles o on o.id = e.creator_id
       where o.account_status <> 'active' and e.status <> 'cancelled' and (e.event_date + e.end_time) > public.jakarta_now())
  );
end;
$$;

create or replace function public.admin_system_health()
returns jsonb language plpgsql stable security definer set search_path = public, auth, storage as $$
declare v_storage jsonb; v_buckets jsonb; v_db bigint;
begin
  perform public._require_rank(2);
  begin
    select coalesce(jsonb_object_agg(bucket_id, jsonb_build_object('files', n, 'bytes', b)), '{}') into v_storage
    from (select bucket_id, count(*) n, coalesce(sum((metadata ->> 'size')::bigint), 0) b from storage.objects group by 1) x;
    select coalesce(jsonb_agg(id), '[]') into v_buckets from storage.buckets where id in ('event-banners', 'complaint-attachments');
  exception when others then
    v_storage := null; v_buckets := null;
  end;
  begin v_db := pg_database_size(current_database()); exception when others then v_db := null; end;
  return jsonb_build_object(
    'db_time', now(),
    'db_bytes', v_db,
    'storage', v_storage,
    'buckets', v_buckets,
    'emails_failed', (select count(*) from public.complaints where email_status = 'failed'),
    'emails_pending', (select count(*) from public.complaints where email_status = 'pending' and created_at < now() - interval '10 minutes'),
    'errors_24h', (select count(*) from public.admin_events where type = 'system_error' and created_at > now() - interval '1 day'),
    'recent_errors', (select coalesce(jsonb_agg(jsonb_build_object('created_at', created_at, 'context', params ->> 'context',
                        'message', params ->> 'message') order by created_at desc), '[]')
                      from (select * from public.admin_events where type = 'system_error' order by created_at desc limit 10) x),
    'auth_users', (select count(*) from auth.users)
  );
end;
$$;

-- ---------------------------------------------------------
-- 10. STORAGE (event banners: public; complaint attachments: private)
-- ---------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('event-banners', 'event-banners', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('complaint-attachments', 'complaint-attachments', false, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

-- Uploads go to "<user id>/<file>"; users manage only their own folder.
drop policy if exists "banner upload own folder" on storage.objects;
create policy "banner upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'event-banners' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "banner manage own folder" on storage.objects;
create policy "banner manage own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'event-banners' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "banner read" on storage.objects;
create policy "banner read" on storage.objects for select
  using (bucket_id = 'event-banners');

drop policy if exists "complaint files upload own folder" on storage.objects;
create policy "complaint files upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'complaint-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "complaint files read own or staff" on storage.objects;
create policy "complaint files read own or staff" on storage.objects for select to authenticated
  using (bucket_id = 'complaint-attachments' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_staff()));

-- ---------------------------------------------------------
-- 11. RLS
-- ---------------------------------------------------------

alter table public.audit_logs enable row level security;
alter table public.admin_events enable row level security;
alter table public.notifications enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_messages enable row level security;
alter table public.complaint_attachments enable row level security;
alter table public.complaint_status_history enable row level security;
alter table public.platform_settings enable row level security;
alter table public.saved_views enable row level security;
alter table public.export_jobs enable row level security;

-- Reads only; all writes go through the functions above.
drop policy if exists "audit readable by admins" on public.audit_logs;
create policy "audit readable by admins" on public.audit_logs for select using (public.is_admin());

drop policy if exists "admin events readable by staff" on public.admin_events;
create policy "admin events readable by staff" on public.admin_events for select using (public.is_staff());
drop policy if exists "admin events acknowledge" on public.admin_events;
create policy "admin events acknowledge" on public.admin_events for update using (public.is_staff()) with check (public.is_staff());

drop policy if exists "own notifications" on public.notifications;
create policy "own notifications" on public.notifications for select using (user_id = auth.uid());

drop policy if exists "complaints own or staff" on public.complaints;
create policy "complaints own or staff" on public.complaints for select using (reporter_id = auth.uid() or public.is_staff());

drop policy if exists "complaint messages visible" on public.complaint_messages;
create policy "complaint messages visible" on public.complaint_messages for select using (
  public.is_staff() or (not is_internal and exists (
    select 1 from public.complaints c where c.id = complaint_id and c.reporter_id = auth.uid())));

drop policy if exists "complaint attachments visible" on public.complaint_attachments;
create policy "complaint attachments visible" on public.complaint_attachments for select using (
  public.is_staff() or exists (select 1 from public.complaints c where c.id = complaint_id and c.reporter_id = auth.uid()));

drop policy if exists "complaint history visible" on public.complaint_status_history;
create policy "complaint history visible" on public.complaint_status_history for select using (
  public.is_staff() or exists (select 1 from public.complaints c where c.id = complaint_id and c.reporter_id = auth.uid()));

drop policy if exists "public settings readable" on public.platform_settings;
create policy "public settings readable" on public.platform_settings for select using (
  (is_public and auth.uid() is not null) or public.is_admin());

drop policy if exists "saved views own" on public.saved_views;
create policy "saved views own" on public.saved_views for all
  using (owner_id = auth.uid() and public.is_staff()) with check (owner_id = auth.uid() and public.is_staff());

drop policy if exists "export jobs admins" on public.export_jobs;
create policy "export jobs admins" on public.export_jobs for select using (public.is_admin());

-- Staff can see every event and participation (incl. private); admins can
-- edit any event (every change is audited by events_after_write).
drop policy if exists "staff read all events" on public.events;
create policy "staff read all events" on public.events for select using (public.is_staff());
drop policy if exists "admins update events" on public.events;
create policy "admins update events" on public.events for update using (public.is_admin());
drop policy if exists "staff read participants" on public.event_participants;
create policy "staff read participants" on public.event_participants for select using (public.is_staff());

-- Internal helpers must not be callable through the API.
revoke execute on function public._audit(text, text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public._admin_event(text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public._notify(uuid, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public._events_in_scope(date, date, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

commit;
