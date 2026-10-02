-- 019: Groups (clubs like "Sunday Run Kemang"). Idempotent; safe before deploy.
-- Members join with one tap; activities can belong to a group their organizer
-- is a member of. Tables are reachable only through the functions below,
-- except events.group_id, which the activity form writes (checked by trigger).

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid not null references public.categories(id),
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 500),
  area text check (char_length(area) <= 80),
  created_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;

alter table public.events add column if not exists group_id uuid references public.groups(id) on delete set null;
create index if not exists events_group_idx on public.events (group_id) where group_id is not null;

-- An activity can only be put in a group its organizer belongs to.
create or replace function public.events_check_group()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_members where group_id = new.group_id and user_id = new.creator_id) then
    raise exception 'GROUP_NOT_MEMBER' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_events_check_group on public.events;
create trigger trg_events_check_group
before insert or update of group_id on public.events
for each row when (new.group_id is not null)
execute function public.events_check_group();

create or replace function public._group_card(g public.groups, p_uid uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', g.id, 'name', g.name, 'description', g.description, 'area', g.area, 'created_at', g.created_at,
    'category', (select jsonb_build_object('id', c.id, 'key', c.key, 'label', c.label, 'emoji', c.emoji)
                 from public.categories c where c.id = g.category_id),
    'member_count', (select count(*) from public.group_members m where m.group_id = g.id),
    'i_am_member', exists (select 1 from public.group_members m where m.group_id = g.id and m.user_id = p_uid),
    'is_owner', g.creator_id = p_uid,
    'next_activity', (select min(e.event_date) from public.events e
                      where e.group_id = g.id and e.privacy = 'public' and e.status <> 'cancelled'
                        and e.event_date >= (public.jakarta_now())::date));
$$;
revoke execute on function public._group_card(public.groups, uuid) from public, anon, authenticated;

-- All groups, the caller's own first, then the biggest.
create or replace function public.groups_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  return coalesce((
    select jsonb_agg(card order by (card->>'i_am_member')::boolean desc, (card->>'member_count')::int desc, card->>'name')
    from (select public._group_card(g, v_uid) card from public.groups g
          join public.profiles p on p.id = g.creator_id
          where p.account_status = 'active' and not public._is_blocked(v_uid, g.creator_id)
          limit 200) t), '[]'::jsonb);
end;
$$;

-- One group with its first members.
create or replace function public.group_get(p_group uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); g public.groups;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into g from public.groups where id = p_group;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
  return public._group_card(g, v_uid) || jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'display_name', public._display_name(p.id),
                                          'avatar_url', p.avatar_url, 'role', m.role) order by m.role = 'owner' desc, m.joined_at)
      from (select * from public.group_members where group_id = p_group order by role = 'owner' desc, joined_at limit 24) m
      join public.profiles p on p.id = m.user_id
      where p.account_status = 'active'), '[]'::jsonb));
end;
$$;

create or replace function public.group_create(p_name text, p_description text, p_category uuid, p_area text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if not public._is_active_member(v_uid) then raise exception 'NOT_AUTHENTICATED'; end if;
  if (select count(*) from public.groups where creator_id = v_uid) >= 5 then raise exception 'GROUP_LIMIT'; end if;
  insert into public.groups (creator_id, category_id, name, description, area)
  values (v_uid, p_category, trim(p_name), nullif(trim(p_description), ''), nullif(trim(p_area), ''))
  returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, v_uid, 'owner');
  return v_id;
end;
$$;

-- Join / leave. The owner can't leave their own group. Returns whether the caller is now a member.
create or replace function public.group_toggle_membership(p_group uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); g public.groups;
begin
  if not public._is_active_member(v_uid) then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into g from public.groups where id = p_group;
  if not found or public._is_blocked(v_uid, g.creator_id) then raise exception 'GROUP_NOT_FOUND'; end if;
  if g.creator_id = v_uid then raise exception 'GROUP_OWNER_CANNOT_LEAVE'; end if;
  if exists (select 1 from public.group_members where group_id = p_group and user_id = v_uid) then
    delete from public.group_members where group_id = p_group and user_id = v_uid;
    return false;
  end if;
  insert into public.group_members (group_id, user_id) values (p_group, v_uid);
  return true;
end;
$$;

revoke execute on function public.groups_list(), public.group_get(uuid), public.group_create(text, text, uuid, text),
  public.group_toggle_membership(uuid) from public, anon;
grant execute on function public.groups_list(), public.group_get(uuid), public.group_create(text, text, uuid, text),
  public.group_toggle_membership(uuid) to authenticated;
