-- =========================================================
-- 009 — Direct messages (1:1), realtime, read state, mute/archive, reports.
-- Run after 008. Idempotent; adds only.
--
-- Privacy model:
--   * RLS: a user can read a conversation, its members and its messages
--     only if they are a member. Nobody else can, including staff.
--   * Sending goes through send_message(), which enforces blocks, the
--     recipient's "who can message me" setting and rate limits.
--   * Staff never browse conversations. A report shares a snapshot of the
--     single reported message; resolving it is audited.
-- =========================================================

begin;

-- ---------------------------------------------------------
-- 1. TABLES
-- ---------------------------------------------------------

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  direct_key text unique,                -- '<smaller uuid>:<larger uuid>' for 1:1 chats
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);

create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  muted boolean not null default false,
  archived boolean not null default false,
  primary key (conversation_id, user_id)
);
create index if not exists conversation_members_user_idx on public.conversation_members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists messages_conversation_idx on public.messages (conversation_id, created_at desc);
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

create table if not exists public.message_reports (
  message_id uuid not null references public.messages(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'inappropriate', 'scam', 'other')),
  details text check (char_length(details) <= 500),
  snapshot text not null,                -- the reported message only, as it was when reported
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolution text,
  primary key (message_id, reporter_id)
);

-- ---------------------------------------------------------
-- 2. RLS (members only; writes go through functions)
-- ---------------------------------------------------------

create or replace function public._is_conversation_member(p_conversation uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = auth.uid());
$$;

alter table public.conversations enable row level security;
drop policy if exists "members read conversations" on public.conversations;
create policy "members read conversations" on public.conversations for select using (public._is_conversation_member(id));

alter table public.conversation_members enable row level security;
drop policy if exists "members read memberships" on public.conversation_members;
create policy "members read memberships" on public.conversation_members for select using (public._is_conversation_member(conversation_id));

alter table public.messages enable row level security;
drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select using (public._is_conversation_member(conversation_id));

alter table public.message_reports enable row level security;   -- no policies: functions only

revoke insert, update, delete on public.conversations, public.conversation_members, public.messages from anon, authenticated;
revoke all on public.message_reports from anon, authenticated;

-- Realtime: new/changed messages are pushed to members (RLS applies to subscribers).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    execute 'alter publication supabase_realtime add table public.messages';
  end if;
end $$;

-- ---------------------------------------------------------
-- 3. HELPERS
-- ---------------------------------------------------------

create or replace function public._other_member(p_conversation uuid, p_uid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select user_id from public.conversation_members where conversation_id = p_conversation and user_id <> p_uid limit 1;
$$;

-- Null when p_sender may message p_recipient, else the reason.
create or replace function public._message_block_reason(p_sender uuid, p_recipient uuid, p_conversation uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_pref text;
begin
  if p_recipient is null or not exists (select 1 from public.profiles where id = p_recipient and account_status = 'active' and onboarding_completed_at is not null) then
    return 'unavailable';
  end if;
  if exists (select 1 from public.user_blocks where blocker_id = p_sender and blocked_id = p_recipient) then return 'blocked'; end if;
  if exists (select 1 from public.user_blocks where blocker_id = p_recipient and blocked_id = p_sender) then return 'unavailable'; end if;
  -- Once the recipient has written in this chat, the conversation is established.
  if p_conversation is not null and exists (select 1 from public.messages where conversation_id = p_conversation and sender_id = p_recipient) then
    return null;
  end if;
  v_pref := coalesce((select messages from public.privacy_settings where user_id = p_recipient), 'friends');
  if v_pref = 'everyone' then return null; end if;
  if v_pref = 'friends' and public._are_friends(p_sender, p_recipient) then return null; end if;
  return case when v_pref = 'friends' then 'friends_only' else 'nobody' end;
end;
$$;

-- ---------------------------------------------------------
-- 4. CONVERSATIONS
-- ---------------------------------------------------------

create or replace function public.start_conversation(p_user uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  v_key text;
  v_id uuid;
  v_reason text;
begin
  if p_user = v_uid then raise exception 'NOT_ALLOWED'; end if;
  v_key := least(v_uid, p_user)::text || ':' || greatest(v_uid, p_user)::text;
  select id into v_id from public.conversations where direct_key = v_key;
  if v_id is not null then
    update public.conversation_members set archived = false where conversation_id = v_id and user_id = v_uid;
    return v_id;
  end if;

  v_reason := public._message_block_reason(v_uid, p_user);
  if v_reason = 'unavailable' then raise exception 'USER_NOT_FOUND'; end if;
  if v_reason is not null then raise exception 'MESSAGES_NOT_ALLOWED'; end if;
  -- Cold outreach limit: at most 20 new chats a day that the other person never answered.
  if (select count(*) from public.conversations c
      where c.created_by = v_uid and c.created_at > now() - interval '1 day'
        and not exists (select 1 from public.messages m where m.conversation_id = c.id and m.sender_id <> v_uid)) >= 20 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.conversations (direct_key, created_by) values (v_key, v_uid)
  on conflict (direct_key) do update set direct_key = excluded.direct_key
  returning id into v_id;
  insert into public.conversation_members (conversation_id, user_id) values (v_id, v_uid), (v_id, p_user)
  on conflict do nothing;
  return v_id;
end;
$$;

create or replace function public.send_message(p_conversation uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public._require_active_member();
  v_body text := trim(coalesce(p_body, ''));
  v_other uuid;
  v_reason text;
  m public.messages;
begin
  if not exists (select 1 from public.conversation_members where conversation_id = p_conversation and user_id = v_uid) then
    raise exception 'CONVERSATION_NOT_FOUND';
  end if;
  if char_length(v_body) = 0 or char_length(v_body) > 2000 then raise exception 'MESSAGE_LENGTH'; end if;
  v_other := public._other_member(p_conversation, v_uid);
  v_reason := public._message_block_reason(v_uid, v_other, p_conversation);
  if v_reason is not null then raise exception 'MESSAGES_NOT_ALLOWED'; end if;
  if (select count(*) from public.messages where sender_id = v_uid and created_at > now() - interval '1 minute') >= 20
     or (select count(*) from public.messages where sender_id = v_uid and created_at > now() - interval '1 day') >= 1000 then
    raise exception 'RATE_LIMITED';
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (p_conversation, v_uid, v_body) returning * into m;
  update public.conversations set last_message_at = m.created_at where id = p_conversation;
  update public.conversation_members set last_read_at = m.created_at, archived = false where conversation_id = p_conversation and user_id = v_uid;
  update public.conversation_members set archived = false where conversation_id = p_conversation and user_id = v_other;

  -- One notification per unread conversation (never the message text), skipped when muted.
  if not coalesce((select muted from public.conversation_members where conversation_id = p_conversation and user_id = v_other), false)
     and not exists (select 1 from public.notifications where user_id = v_other and type = 'new_message'
                     and read_at is null and params->>'conversation_id' = p_conversation::text) then
    perform public._notify(v_other, 'new_message',
      jsonb_build_object('conversation_id', p_conversation, 'name', public._display_name(v_uid),
                         'username', (select username from public.profiles where id = v_uid)),
      '/messages/' || p_conversation);
  end if;

  return jsonb_build_object('id', m.id, 'conversation_id', m.conversation_id, 'sender_id', m.sender_id,
                            'body', m.body, 'created_at', m.created_at, 'is_mine', true, 'deleted', false);
end;
$$;

create or replace function public.delete_message(p_message uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.messages set deleted_at = now(), body = '[deleted]'
  where id = p_message and sender_id = v_uid and deleted_at is null;
  if not found then raise exception 'NOT_ALLOWED'; end if;
end;
$$;

create or replace function public.mark_conversation_read(p_conversation uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.conversation_members set last_read_at = now() where conversation_id = p_conversation and user_id = v_uid;
  update public.notifications set read_at = now()
  where user_id = v_uid and type = 'new_message' and read_at is null and params->>'conversation_id' = p_conversation::text;
end;
$$;

create or replace function public.set_conversation_prefs(p_conversation uuid, p_muted boolean default null, p_archived boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  update public.conversation_members
    set muted = coalesce(p_muted, muted), archived = coalesce(p_archived, archived)
  where conversation_id = p_conversation and user_id = auth.uid();
  if not found then raise exception 'CONVERSATION_NOT_FOUND'; end if;
end;
$$;

create or replace function public._conversation_card(p_conversation uuid, p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', c.id,
    'last_message_at', c.last_message_at,
    'muted', me.muted,
    'archived', me.archived,
    'other', case when o.id is null then null else jsonb_build_object(
        'id', o.id, 'username', o.username, 'display_name', public._display_name(o.id),
        'avatar_url', case when public._is_blocked(p_uid, o.id) then null else o.avatar_url end,
        'active', o.account_status = 'active') end,
    'blocked_by_me', exists (select 1 from public.user_blocks where blocker_id = p_uid and blocked_id = o.id),
    'send_block', public._message_block_reason(p_uid, o.id, c.id),
    'unread', (select count(*) from public.messages m where m.conversation_id = c.id and m.sender_id <> p_uid
               and m.created_at > me.last_read_at and m.deleted_at is null),
    'last', (select jsonb_build_object('body', case when m.deleted_at is null then left(m.body, 140) end,
                                       'is_mine', m.sender_id = p_uid, 'created_at', m.created_at)
             from public.messages m where m.conversation_id = c.id order by m.created_at desc limit 1))
  from public.conversations c
  join public.conversation_members me on me.conversation_id = c.id and me.user_id = p_uid
  left join public.profiles o on o.id = public._other_member(c.id, p_uid)
  where c.id = p_conversation;
$$;

create or replace function public.my_conversations(p_archived boolean default false)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return coalesce((
    select jsonb_agg(public._conversation_card(c.id, v_uid) order by coalesce(c.last_message_at, c.created_at) desc)
    from public.conversations c
    join public.conversation_members me on me.conversation_id = c.id and me.user_id = v_uid
    where me.archived = coalesce(p_archived, false)
      and (c.last_message_at is not null or c.created_by = v_uid)), '[]');
end;
$$;

create or replace function public.conversation_detail(p_conversation uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public._is_conversation_member(p_conversation) then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  return public._conversation_card(p_conversation, auth.uid());
end;
$$;

create or replace function public.conversation_messages(p_conversation uuid, p_before timestamptz default null, p_limit int default 50)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if not public._is_conversation_member(p_conversation) then raise exception 'CONVERSATION_NOT_FOUND'; end if;
  return coalesce((
    select jsonb_agg(x order by x->>'created_at') from (
      select jsonb_build_object('id', m.id, 'conversation_id', m.conversation_id, 'sender_id', m.sender_id,
                                'body', case when m.deleted_at is null then m.body end, 'deleted', m.deleted_at is not null,
                                'created_at', m.created_at, 'is_mine', m.sender_id = v_uid) x
      from public.messages m
      where m.conversation_id = p_conversation and (p_before is null or m.created_at < p_before)
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 100)) s), '[]');
end;
$$;

create or replace function public.unread_conversation_count()
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.conversation_members me
  where me.user_id = auth.uid() and not me.archived
    and exists (select 1 from public.messages m where m.conversation_id = me.conversation_id and m.sender_id <> me.user_id
                and m.created_at > me.last_read_at and m.deleted_at is null);
$$;

-- Can the caller start a chat with this user? (for the profile "Message" button)
create or replace function public.can_message_user(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_existing uuid;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select id into v_existing from public.conversations
  where direct_key = least(v_uid, p_user)::text || ':' || greatest(v_uid, p_user)::text;
  return jsonb_build_object('conversation_id', v_existing,
                            'reason', case when p_user = v_uid then 'self' else public._message_block_reason(v_uid, p_user, v_existing) end);
end;
$$;

-- ---------------------------------------------------------
-- 5. REPORTS
-- ---------------------------------------------------------

create or replace function public.report_message(p_message uuid, p_reason text, p_details text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  m public.messages;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into m from public.messages where id = p_message;
  if not found or not exists (select 1 from public.conversation_members where conversation_id = m.conversation_id and user_id = v_uid) then
    raise exception 'NOT_ALLOWED';
  end if;
  if m.sender_id = v_uid or m.deleted_at is not null then raise exception 'NOT_ALLOWED'; end if;
  if p_reason not in ('spam', 'harassment', 'inappropriate', 'scam', 'other') then raise exception 'NOT_ALLOWED'; end if;
  if (select count(*) from public.message_reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 30 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.message_reports (message_id, reporter_id, sender_id, reason, details, snapshot)
  values (p_message, v_uid, m.sender_id, p_reason, nullif(left(trim(coalesce(p_details, '')), 500), ''), m.body)
  on conflict do nothing;
  if found then
    perform public._admin_event('message_reported', 'warning', 'user', m.sender_id::text, jsonb_build_object('reason', p_reason));
  end if;
end;
$$;

-- ---------------------------------------------------------
-- 6. ADMIN (reports and counts only; never whole conversations)
-- ---------------------------------------------------------

create or replace function public.admin_message_reports(p_filter text default 'open', p_limit int default 50, p_offset int default 0)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'total', (select count(*) from public.message_reports where p_filter = 'all' or resolved_at is null),
    'rows', coalesce((select jsonb_agg(x order by x->>'created_at' desc) from (
      select jsonb_build_object(
        'message_id', r.message_id, 'reason', r.reason, 'details', r.details, 'snapshot', r.snapshot,
        'created_at', r.created_at, 'resolved_at', r.resolved_at, 'resolution', r.resolution,
        'sender', (select jsonb_build_object('id', p.id, 'username', p.username, 'account_status', p.account_status) from public.profiles p where p.id = r.sender_id),
        'reporter', (select jsonb_build_object('id', p.id, 'username', p.username) from public.profiles p where p.id = r.reporter_id),
        'sender_open_reports', (select count(*) from public.message_reports r2 where r2.sender_id = r.sender_id and r2.resolved_at is null)) x
      from public.message_reports r
      where p_filter = 'all' or r.resolved_at is null
      order by r.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200) offset greatest(coalesce(p_offset, 0), 0)) s), '[]'));
end;
$$;

create or replace function public.admin_resolve_message_report(p_message uuid, p_action text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  if p_action not in ('dismiss', 'remove') then raise exception 'NOT_ALLOWED'; end if;
  if p_action = 'remove' then
    update public.messages set deleted_at = coalesce(deleted_at, now()), body = '[removed by moderator]' where id = p_message;
  end if;
  update public.message_reports set resolved_at = now(), resolved_by = auth.uid(), resolution = p_action
  where message_id = p_message and resolved_at is null;
  perform public._audit('message_report_' || p_action, 'message', p_message::text);
end;
$$;

create or replace function public.admin_messaging_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return jsonb_build_object(
    'messages_in_range', (select count(*) from public.messages where created_at >= p_from and created_at < p_to),
    'active_conversations', (select count(distinct conversation_id) from public.messages where created_at >= p_from and created_at < p_to),
    'messaging_users', (select count(distinct sender_id) from public.messages where created_at >= p_from and created_at < p_to),
    'conversations', (select count(*) from public.conversations where last_message_at is not null),
    'open_reports', (select count(*) from public.message_reports where resolved_at is null),
    'series', coalesce((select jsonb_agg(jsonb_build_object('t', d, 'v', c) order by d)
                        from (select (created_at at time zone 'Asia/Jakarta')::date d, count(*) c from public.messages
                              where created_at >= p_from and created_at < p_to group by 1) x), '[]'));
end;
$$;

-- ---------------------------------------------------------
-- 7. GRANTS
-- ---------------------------------------------------------

revoke execute on function public._other_member(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._message_block_reason(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public._conversation_card(uuid, uuid) from public, anon, authenticated;

commit;
