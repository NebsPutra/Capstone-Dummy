-- =========================================================
-- 008 — Event comments (one level of replies), reports, organizer/admin
-- moderation, and notification preferences. Run after 007. Idempotent.
--
-- Comments are read and written only through the functions below, which
-- apply the event's visibility (public events: all members; private
-- events: organizer + approved participants; staff always), blocks,
-- rate limits and moderation state.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. NOTIFICATION PREFERENCES
-- ---------------------------------------------------------

create table if not exists public.notification_prefs (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  muted text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists "own notification prefs read" on public.notification_prefs;
create policy "own notification prefs read" on public.notification_prefs for select using (user_id = auth.uid());
drop policy if exists "own notification prefs insert" on public.notification_prefs;
create policy "own notification prefs insert" on public.notification_prefs for insert with check (user_id = auth.uid());
drop policy if exists "own notification prefs update" on public.notification_prefs;
create policy "own notification prefs update" on public.notification_prefs for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Only these can be muted; security, account, support and join decisions always arrive.
create or replace function public._mutable_notification_types()
returns text[] language sql immutable as $$
  select array['event_comment', 'comment_reply', 'friend_request', 'friend_accepted', 'new_message', 'join_request'];
$$;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'complaint_submitted', 'complaint_status', 'complaint_reply',
  'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status',
  'security_alert', 'friend_request', 'friend_accepted', 'new_message', 'event_comment', 'comment_reply',
  'comment_moderated'));

-- _notify (from 004) now skips types the recipient muted.
create or replace function public._notify(p_user uuid, p_type text, p_params jsonb, p_link text)
returns void language sql security definer set search_path = public as $$
  insert into public.notifications (user_id, type, params, link)
  select p_user, p_type, coalesce(p_params, '{}'), p_link
  where p_user is not null
    and not (p_type = any (public._mutable_notification_types())
             and p_type = any (coalesce((select muted from public.notification_prefs where user_id = p_user), '{}')));
$$;

-- ---------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------

alter table public.events add column if not exists comments_enabled boolean not null default true;

create table if not exists public.event_comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid references public.event_comments(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  pinned boolean not null default false,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderation_reason text,
  report_count int not null default 0,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);
create index if not exists event_comments_event_idx on public.event_comments (event_id, created_at);
create index if not exists event_comments_parent_idx on public.event_comments (parent_id);
create index if not exists event_comments_author_idx on public.event_comments (author_id, created_at desc);
alter table public.event_comments enable row level security;   -- no policies: functions only

create table if not exists public.comment_reports (
  comment_id uuid not null references public.event_comments(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  details text check (char_length(details) <= 500),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  primary key (comment_id, reporter_id)
);
alter table public.comment_reports enable row level security;   -- no policies: functions only

-- ---------------------------------------------------------
-- 3. HELPERS
-- ---------------------------------------------------------

create or replace function public._can_view_event_comments(p_event uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event and (
      e.creator_id = p_uid or public.is_staff() or e.privacy::text = 'public'
      or exists (select 1 from public.event_participants ep
                 where ep.event_id = e.id and ep.user_id = p_uid and ep.status::text = 'approved')));
$$;

create or replace function public._can_moderate_comments(p_event uuid, p_uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_staff() or exists (select 1 from public.events where id = p_event and creator_id = p_uid);
$$;

create or replace function public._comment_author(p_user uuid, p_organizer uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'username', p.username, 'display_name', public._display_name(p.id),
                            'avatar_url', p.avatar_url, 'is_organizer', p.id = p_organizer)
  from public.profiles p where p.id = p_user;
$$;

-- ---------------------------------------------------------
-- 4. READ
-- ---------------------------------------------------------

create or replace function public.event_comments_list(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  e public.events;
  v_mod boolean;
  v_member boolean;
  v_reason text;
  v_comments jsonb;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into e from public.events where id = p_event;
  if not found or not public._can_view_event_comments(p_event, v_uid) then raise exception 'EVENT_NOT_FOUND'; end if;
  v_mod := public._can_moderate_comments(p_event, v_uid);
  v_member := exists (select 1 from public.profiles where id = v_uid and account_status = 'active' and onboarding_completed_at is not null);
  v_reason := case
    when not v_member then 'incomplete'
    when e.status::text = 'cancelled' then 'cancelled'
    when not e.comments_enabled and not v_mod then 'disabled'
    when e.creator_id <> v_uid and public._is_blocked(v_uid, e.creator_id) then 'blocked'
    else null end;

  with visible as (
    select c.*,
           (c.status = 'visible' or v_mod or c.author_id = v_uid) as show_body,
           exists (select 1 from public.event_comments r where r.parent_id = c.id and r.status = 'visible') as has_replies
    from public.event_comments c
    where c.event_id = p_event
      and not public._is_blocked(v_uid, c.author_id)
  ),
  shaped as (
    select v.id, v.parent_id, v.pinned, v.created_at,
      jsonb_build_object(
        'id', v.id,
        'parent_id', v.parent_id,
        'body', case when v.status = 'deleted' then null when v.show_body then v.body end,
        'status', v.status,
        'pinned', v.pinned,
        'created_at', v.created_at,
        'edited', v.edited_at is not null,
        'author', case when v.status = 'deleted' and not v_mod then null else public._comment_author(v.author_id, e.creator_id) end,
        'is_mine', v.author_id = v_uid,
        'can_edit', v.author_id = v_uid and v.status = 'visible',
        'can_delete', (v.author_id = v_uid or v_mod) and v.status <> 'deleted',
        'reported_by_me', exists (select 1 from public.comment_reports r where r.comment_id = v.id and r.reporter_id = v_uid),
        'report_count', case when v_mod then v.report_count end,
        'moderation_reason', case when v_mod or v.author_id = v_uid then v.moderation_reason end) j
    from visible v
    -- Hidden/deleted comments show only to moderators/authors, or as a placeholder when they have replies.
    where v.status = 'visible' or v_mod or (v.author_id = v_uid and v.status <> 'deleted') or v.has_replies
  )
  select coalesce(jsonb_agg(t.j || jsonb_build_object('replies', coalesce((
            select jsonb_agg(r.j order by r.created_at) from shaped r where r.parent_id = t.id), '[]'))
          order by t.pinned desc, t.created_at desc), '[]')
  into v_comments
  from (select * from shaped where parent_id is null order by pinned desc, created_at desc limit 200) t;

  return jsonb_build_object(
    'comments', v_comments,
    'count', (select count(*) from public.event_comments where event_id = p_event and status = 'visible'),
    'comments_enabled', e.comments_enabled,
    'can_post', v_reason is null,
    'blocked_reason', v_reason,
    'is_moderator', v_mod);
end;
$$;

-- ---------------------------------------------------------
-- 5. WRITE
-- ---------------------------------------------------------

create or replace function public.post_event_comment(p_event uuid, p_body text, p_parent uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  v_body text := trim(coalesce(p_body, ''));
  e public.events;
  parent public.event_comments;
  v_id uuid;
  v_params jsonb;
  v_link text;
begin
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then raise exception 'COMMENT_LENGTH'; end if;
  select * into e from public.events where id = p_event;
  if not found or not public._can_view_event_comments(p_event, v_uid) then raise exception 'EVENT_NOT_FOUND'; end if;
  if e.status::text = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if not e.comments_enabled and not public._can_moderate_comments(p_event, v_uid) then raise exception 'COMMENTS_DISABLED'; end if;
  if e.creator_id <> v_uid and public._is_blocked(v_uid, e.creator_id) then raise exception 'NOT_ALLOWED'; end if;

  if p_parent is not null then
    select * into parent from public.event_comments where id = p_parent;
    if not found or parent.event_id <> p_event or parent.status <> 'visible' then raise exception 'COMMENT_NOT_FOUND'; end if;
    if parent.parent_id is not null then p_parent := parent.parent_id; end if;   -- keep threads one level deep
    if public._is_blocked(v_uid, parent.author_id) then raise exception 'NOT_ALLOWED'; end if;
  end if;

  if (select count(*) from public.event_comments where author_id = v_uid and created_at > now() - interval '1 minute') >= 5
     or (select count(*) from public.event_comments where author_id = v_uid and created_at > now() - interval '1 day') >= 100 then
    raise exception 'RATE_LIMITED';
  end if;
  if exists (select 1 from public.event_comments where author_id = v_uid and event_id = p_event and body = v_body
             and created_at > now() - interval '2 minutes') then
    raise exception 'COMMENT_DUPLICATE';
  end if;

  insert into public.event_comments (event_id, author_id, parent_id, body) values (p_event, v_uid, p_parent, v_body)
  returning id into v_id;

  v_params := jsonb_build_object('title', e.title, 'name', public._display_name(v_uid),
                                 'username', (select username from public.profiles where id = v_uid));
  v_link := '/activities/' || e.id || '#comment-' || v_id;
  if p_parent is not null and parent.author_id <> v_uid then
    perform public._notify(parent.author_id, 'comment_reply', v_params, v_link);
  end if;
  if e.creator_id <> v_uid and (p_parent is null or parent.author_id <> e.creator_id) then
    perform public._notify(e.creator_id, 'event_comment', v_params, v_link);
  end if;
  return v_id;
end;
$$;

create or replace function public.edit_event_comment(p_comment uuid, p_body text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  v_body text := trim(coalesce(p_body, ''));
  c public.event_comments;
begin
  if char_length(v_body) = 0 or char_length(v_body) > 1000 then raise exception 'COMMENT_LENGTH'; end if;
  select * into c from public.event_comments where id = p_comment for update;
  if not found or c.author_id <> v_uid or c.status <> 'visible' then raise exception 'COMMENT_NOT_FOUND'; end if;
  if c.body = v_body then return; end if;
  update public.event_comments set body = v_body, edited_at = now() where id = p_comment;
end;
$$;

create or replace function public.moderate_event_comment(p_comment uuid, p_action text, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.event_comments;
  v_title text;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into c from public.event_comments where id = p_comment for update;
  if not found or c.status = 'deleted' then raise exception 'COMMENT_NOT_FOUND'; end if;
  if not public._can_moderate_comments(c.event_id, v_uid) then raise exception 'NOT_ALLOWED'; end if;
  select title into v_title from public.events where id = c.event_id;

  if p_action = 'hide' then
    update public.event_comments set status = 'hidden', pinned = false, moderated_by = v_uid,
      moderation_reason = nullif(left(trim(coalesce(p_reason, '')), 200), '') where id = p_comment;
    update public.comment_reports set resolved_at = now(), resolved_by = v_uid where comment_id = p_comment and resolved_at is null;
    if c.author_id <> v_uid then
      perform public._notify(c.author_id, 'comment_moderated', jsonb_build_object('title', v_title), '/activities/' || c.event_id);
    end if;
  elsif p_action = 'unhide' then
    update public.event_comments set status = 'visible', moderated_by = v_uid, moderation_reason = null where id = p_comment;
  elsif p_action = 'pin' then
    if c.parent_id is not null or c.status <> 'visible' then raise exception 'NOT_ALLOWED'; end if;
    if (select count(*) from public.event_comments where event_id = c.event_id and pinned) >= 3 then raise exception 'PIN_LIMIT'; end if;
    update public.event_comments set pinned = true where id = p_comment;
  elsif p_action = 'unpin' then
    update public.event_comments set pinned = false where id = p_comment;
  else
    raise exception 'NOT_ALLOWED';
  end if;
  perform public._audit('comment_' || p_action, 'comment', p_comment::text, null,
                        jsonb_build_object('event_id', c.event_id, 'reason', p_reason));
end;
$$;

-- Authors delete their own comment (text is erased); organizers/staff hide it.
create or replace function public.delete_event_comment(p_comment uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  c public.event_comments;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into c from public.event_comments where id = p_comment for update;
  if not found or c.status = 'deleted' then raise exception 'COMMENT_NOT_FOUND'; end if;
  if c.author_id = v_uid then
    update public.event_comments set status = 'deleted', body = '[deleted]', pinned = false where id = p_comment;
  elsif public._can_moderate_comments(c.event_id, v_uid) then
    perform public.moderate_event_comment(p_comment, 'hide', null);
  else
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

create or replace function public.report_event_comment(p_comment uuid, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  c public.event_comments;
  v_open int;
begin
  select * into c from public.event_comments where id = p_comment for update;
  if not found or c.status = 'deleted' or not public._can_view_event_comments(c.event_id, v_uid) then raise exception 'COMMENT_NOT_FOUND'; end if;
  if c.author_id = v_uid then raise exception 'NOT_ALLOWED'; end if;
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'misinformation', 'other') then raise exception 'NOT_ALLOWED'; end if;
  if (select count(*) from public.comment_reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.comment_reports (comment_id, reporter_id, reason, details)
  values (p_comment, v_uid, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), ''))
  on conflict do nothing;
  if not found then return; end if;

  select count(*) into v_open from public.comment_reports where comment_id = p_comment and resolved_at is null;
  update public.event_comments set report_count = report_count + 1 where id = p_comment;
  -- Three independent reports hide the comment until someone reviews it.
  if v_open >= 3 and c.status = 'visible' then
    update public.event_comments set status = 'hidden', pinned = false, moderation_reason = 'auto: reports' where id = p_comment;
    perform public._admin_event('comment_auto_hidden', 'warning', 'comment', p_comment::text, jsonb_build_object('event_id', c.event_id));
  elsif v_open = 1 then
    perform public._admin_event('comment_reported', 'info', 'comment', p_comment::text, jsonb_build_object('event_id', c.event_id, 'reason', p_reason));
  end if;
end;
$$;

create or replace function public.set_event_comments_enabled(p_event uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not (exists (select 1 from public.events where id = p_event and creator_id = v_uid) or public.is_admin()) then
    raise exception 'NOT_ALLOWED';
  end if;
  update public.events set comments_enabled = p_enabled where id = p_event;
  perform public._audit(case when p_enabled then 'comments_enabled' else 'comments_disabled' end, 'event', p_event::text);
end;
$$;

-- ---------------------------------------------------------
-- 6. ADMIN
-- ---------------------------------------------------------

create or replace function public.admin_comments(p_filter text default 'reported', p_search text default null, p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public._require_rank(1);
  return (
    with base as (
      select c.* from public.event_comments c
      where (p_filter = 'all'
             or (p_filter = 'reported' and exists (select 1 from public.comment_reports r where r.comment_id = c.id and r.resolved_at is null))
             or (p_filter = 'hidden' and c.status = 'hidden'))
        and (q is null or c.body ilike '%' || q || '%'
             or exists (select 1 from public.profiles p where p.id = c.author_id and p.username ilike '%' || q || '%'))
    )
    select jsonb_build_object(
      'total', (select count(*) from base),
      'rows', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
        select jsonb_build_object(
          'id', c.id, 'body', c.body, 'status', c.status, 'pinned', c.pinned, 'created_at', c.created_at,
          'report_count', c.report_count, 'moderation_reason', c.moderation_reason,
          'open_reports', (select count(*) from public.comment_reports r where r.comment_id = c.id and r.resolved_at is null),
          'reasons', coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'details', r.details) order by r.created_at)
                               from public.comment_reports r where r.comment_id = c.id and r.resolved_at is null), '[]'),
          'event', (select jsonb_build_object('id', e.id, 'title', e.title, 'ref', e.ref) from public.events e where e.id = c.event_id),
          'author', (select jsonb_build_object('id', p.id, 'username', p.username) from public.profiles p where p.id = c.author_id)) x
        from base c order by c.created_at desc
        limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) s), '[]')));
end;
$$;

create or replace function public.admin_resolve_comment(p_comment uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  if p_action = 'dismiss' then
    update public.comment_reports set resolved_at = now(), resolved_by = auth.uid() where comment_id = p_comment and resolved_at is null;
    update public.event_comments set status = 'visible', moderation_reason = null
    where id = p_comment and status = 'hidden' and moderation_reason = 'auto: reports';
    perform public._audit('comment_reports_dismissed', 'comment', p_comment::text);
  elsif p_action in ('hide', 'unhide') then
    perform public.moderate_event_comment(p_comment, p_action, 'admin review');
    update public.comment_reports set resolved_at = now(), resolved_by = auth.uid() where comment_id = p_comment and resolved_at is null;
  else
    raise exception 'NOT_ALLOWED';
  end if;
end;
$$;

create or replace function public.admin_comment_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'total', (select count(*) from public.event_comments where status = 'visible'),
    'in_range', (select count(*) from public.event_comments where created_at >= p_from and created_at < p_to),
    'hidden', (select count(*) from public.event_comments where status = 'hidden'),
    'open_reports', (select count(distinct comment_id) from public.comment_reports where resolved_at is null),
    'commenters', (select count(distinct author_id) from public.event_comments where created_at >= p_from and created_at < p_to),
    'series', coalesce((select jsonb_agg(jsonb_build_object('t', d, 'v', c) order by d)
                        from (select (created_at at time zone 'Asia/Jakarta')::date d, count(*) c from public.event_comments
                              where created_at >= p_from and created_at < p_to group by 1) x), '[]'),
    'top_events', coalesce((select jsonb_agg(jsonb_build_object('title', title, 'v', c) order by c desc)
                            from (select e.title, count(*) c from public.event_comments ec join public.events e on e.id = ec.event_id
                                  where ec.created_at >= p_from and ec.created_at < p_to and ec.status = 'visible'
                                  group by e.id, e.title order by 2 desc limit 8) x), '[]'));
end;
$$;

-- ---------------------------------------------------------
-- 7. GRANTS
-- ---------------------------------------------------------

revoke execute on function public._can_view_event_comments(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._can_moderate_comments(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._comment_author(uuid, uuid) from public, anon, authenticated;

commit;
