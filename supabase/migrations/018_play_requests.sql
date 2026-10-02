-- 018: "Looking for players" (ajakan main). Idempotent; safe before deploy.
-- Someone posts "need 3 more for badminton"; others tap "Me too". When enough
-- people are in, the poster creates a real activity and everyone who was
-- interested gets a notification. Tables are only reachable through the
-- security-definer functions below (same pattern as event comments).

create table if not exists public.play_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  title text not null check (char_length(title) between 3 and 80),
  note text check (char_length(note) <= 300),
  area text check (char_length(area) <= 80),
  players_needed int not null check (players_needed between 2 and 30),
  event_id uuid references public.events(id) on delete set null,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists play_requests_open_idx on public.play_requests (created_at desc) where closed_at is null;

create table if not exists public.play_request_interests (
  request_id uuid not null references public.play_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (request_id, user_id)
);

alter table public.play_requests enable row level security;
alter table public.play_request_interests enable row level security;
revoke all on public.play_requests, public.play_request_interests from anon, authenticated;

-- New notification type for "your table is ready".
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'complaint_submitted', 'complaint_status', 'complaint_reply',
  'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status',
  'security_alert', 'friend_request', 'friend_accepted', 'new_message', 'event_comment', 'comment_reply',
  'comment_moderated', 'play_request_ready'));

create or replace function public._is_active_member(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles
                 where id = p_user and account_status = 'active' and onboarding_completed_at is not null);
$$;
revoke execute on function public._is_active_member(uuid) from public, anon, authenticated;

-- Open requests from the last 30 days, newest first.
create or replace function public.play_requests_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return coalesce((
    select jsonb_agg(j order by created_at desc) from (
      select r.created_at, jsonb_build_object(
        'id', r.id, 'title', r.title, 'note', r.note, 'area', r.area,
        'players_needed', r.players_needed, 'created_at', r.created_at,
        'category', jsonb_build_object('id', c.id, 'key', c.key, 'label', c.label, 'emoji', c.emoji),
        'creator', jsonb_build_object('username', p.username, 'display_name', public._display_name(p.id)),
        -- The poster counts as one player.
        'players_in', 1 + (select count(*) from public.play_request_interests i where i.request_id = r.id),
        'i_am_in', exists (select 1 from public.play_request_interests i where i.request_id = r.id and i.user_id = v_uid),
        'is_mine', r.creator_id = v_uid) j
      from public.play_requests r
      join public.categories c on c.id = r.category_id
      join public.profiles p on p.id = r.creator_id
      where r.closed_at is null
        and r.created_at > now() - interval '30 days'
        and p.account_status = 'active'
        and not public._is_blocked(v_uid, r.creator_id)
      order by r.created_at desc
      limit 100
    ) t), '[]'::jsonb);
end;
$$;

create or replace function public.play_request_create(
  p_category uuid, p_title text, p_note text, p_area text, p_players int
) returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if not public._is_active_member(v_uid) then raise exception 'NOT_AUTHENTICATED'; end if;
  -- At most 5 open requests per person, against spam.
  if (select count(*) from public.play_requests where creator_id = v_uid and closed_at is null) >= 5 then
    raise exception 'PLAY_REQUEST_LIMIT';
  end if;
  insert into public.play_requests (creator_id, category_id, title, note, area, players_needed)
  values (v_uid, p_category, trim(p_title), nullif(trim(p_note), ''), nullif(trim(p_area), ''), p_players)
  returning id into v_id;
  return v_id;
end;
$$;

-- "Me too" on/off. Returns whether the caller is now in.
create or replace function public.play_request_toggle(p_request uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.play_requests;
begin
  if not public._is_active_member(v_uid) then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into r from public.play_requests where id = p_request;
  if not found or r.closed_at is not null or r.creator_id = v_uid or public._is_blocked(v_uid, r.creator_id) then
    raise exception 'PLAY_REQUEST_NOT_FOUND';
  end if;
  if exists (select 1 from public.play_request_interests where request_id = p_request and user_id = v_uid) then
    delete from public.play_request_interests where request_id = p_request and user_id = v_uid;
    return false;
  end if;
  insert into public.play_request_interests (request_id, user_id) values (p_request, v_uid);
  return true;
end;
$$;

-- The poster closes the request, optionally linking the activity they created;
-- then everyone who tapped "Me too" is notified with a link to it.
create or replace function public.play_request_close(p_request uuid, p_event uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); r public.play_requests;
begin
  select * into r from public.play_requests where id = p_request;
  if not found or r.creator_id is distinct from v_uid then raise exception 'PLAY_REQUEST_NOT_FOUND'; end if;
  if r.closed_at is not null then return; end if;
  if p_event is not null and not exists (select 1 from public.events where id = p_event and creator_id = v_uid) then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  update public.play_requests set closed_at = now(), event_id = p_event where id = p_request;
  if p_event is not null then
    perform public._notify(i.user_id, 'play_request_ready', jsonb_build_object('title', r.title), '/activities/' || p_event)
    from public.play_request_interests i where i.request_id = p_request;
  end if;
end;
$$;

revoke execute on function public.play_requests_list(), public.play_request_create(uuid, text, text, text, int),
  public.play_request_toggle(uuid), public.play_request_close(uuid, uuid) from public, anon;
grant execute on function public.play_requests_list(), public.play_request_create(uuid, text, text, text, int),
  public.play_request_toggle(uuid), public.play_request_close(uuid, uuid) to authenticated;
