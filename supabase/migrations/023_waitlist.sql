-- 023: Waiting list for full activities. Idempotent; safe before deploy.
-- A separate table (not a new participation status), so capacity counts and
-- every existing query stay as they are. When a spot frees up (someone leaves
-- or is removed, or the organizer raises the maximum) the first person waiting
-- gets it automatically: "open" activities -> approved, approval-required ones
-- -> a pending request for the organizer. They're notified (waitlist_promoted).

create table if not exists public.event_waitlist (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
create index if not exists event_waitlist_order_idx on public.event_waitlist (event_id, created_at);
alter table public.event_waitlist enable row level security;
revoke all on public.event_waitlist from anon;
revoke insert, update, delete on public.event_waitlist from authenticated;

-- Read: your own entry; the organizer sees their activity's list.
drop policy if exists "own or organizer reads waitlist" on public.event_waitlist;
create policy "own or organizer reads waitlist" on public.event_waitlist
  for select to authenticated using (user_id = auth.uid() or public.is_event_owner(event_id));

-- Fill free spots from the front of the list. Caller holds the event row lock
-- (or runs inside a trigger on the participant/event change).
create or replace function public._promote_waitlist(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare e public.events; w public.event_waitlist; v_taken int;
begin
  select * into e from public.events where id = p_event;
  if not found or e.status = 'cancelled' or public.jakarta_now() >= (e.event_date + e.start_time) then return; end if;
  loop
    -- Approval-required: a pending request also holds a place in line for a spot.
    select count(*) into v_taken from public.event_participants
    where event_id = p_event and (status = 'approved' or (e.join_permission = 'approval_required' and status = 'pending'));
    exit when v_taken >= e.max_participants;

    select * into w from public.event_waitlist where event_id = p_event order by created_at limit 1 for update skip locked;
    exit when not found;

    delete from public.event_waitlist where event_id = p_event and user_id = w.user_id;
    insert into public.event_participants (event_id, user_id, status)
    values (p_event, w.user_id, case when e.join_permission = 'open' then 'approved' else 'pending' end::participation_status)
    on conflict (event_id, user_id) do update set status = excluded.status, joined_at = now();
    perform public._notify(w.user_id, 'waitlist_promoted',
      jsonb_build_object('title', e.title, 'pending', e.join_permission <> 'open'), '/activities/' || p_event);
  end loop;
end;
$$;
revoke execute on function public._promote_waitlist(uuid) from public, anon, authenticated;

create or replace function public.participants_promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._promote_waitlist(old.event_id);
  return null;
end;
$$;
drop trigger if exists trg_participants_promote_waitlist on public.event_participants;
create trigger trg_participants_promote_waitlist
after delete or update of status on public.event_participants
for each row when (old.status in ('approved', 'pending'))
execute function public.participants_promote_waitlist();

create or replace function public.events_promote_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public._promote_waitlist(new.id);
  return null;
end;
$$;
drop trigger if exists trg_events_promote_waitlist on public.events;
create trigger trg_events_promote_waitlist
after update of max_participants on public.events
for each row when (new.max_participants > old.max_participants)
execute function public.events_promote_waitlist();

-- Join the list. Same access rules as join_event (private needs the invite).
-- Returns your position (1 = next in line).
create or replace function public.join_waitlist(p_event_id uuid, p_token text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); e public.events;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not public.is_onboarded() then raise exception 'PROFILE_INCOMPLETE'; end if;
  select * into e from public.events where id = p_event_id for update;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if e.creator_id = v_uid then raise exception 'OWNER_CANNOT_JOIN'; end if;
  if e.privacy = 'private' and (p_token is null
     or (upper(trim(p_token)) <> e.share_token and upper(trim(p_token)) <> e.event_code)) then
    raise exception 'INVITE_REQUIRED';
  end if;
  if e.status = 'cancelled' then raise exception 'EVENT_CANCELLED'; end if;
  if public.jakarta_now() >= (e.event_date + e.start_time) then raise exception 'EVENT_STARTED'; end if;
  if exists (select 1 from public.event_participants
             where event_id = p_event_id and user_id = v_uid and status in ('approved', 'pending', 'rejected')) then
    raise exception 'NOT_ALLOWED';
  end if;
  insert into public.event_waitlist (event_id, user_id) values (p_event_id, v_uid) on conflict do nothing;
  return (select count(*) from public.event_waitlist w
          where w.event_id = p_event_id
            and w.created_at <= (select created_at from public.event_waitlist where event_id = p_event_id and user_id = v_uid));
end;
$$;

create or replace function public.leave_waitlist(p_event_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.event_waitlist where event_id = p_event_id and user_id = auth.uid();
$$;

-- Your place in line (0 when you're not on it) and the list length.
create or replace function public.waitlist_status(p_event_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'position', (select count(*) from public.event_waitlist w
                 where w.event_id = p_event_id
                   and w.created_at <= (select created_at from public.event_waitlist
                                        where event_id = p_event_id and user_id = auth.uid())),
    'length', (select count(*) from public.event_waitlist where event_id = p_event_id));
$$;

-- Joined directly (e.g. grabbed a freed spot): no longer waiting.
create or replace function public.participants_leave_waitlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from public.event_waitlist where event_id = new.event_id and user_id = new.user_id;
  return null;
end;
$$;
drop trigger if exists trg_participants_leave_waitlist on public.event_participants;
create trigger trg_participants_leave_waitlist
after insert or update of status on public.event_participants
for each row when (new.status in ('approved', 'pending'))
execute function public.participants_leave_waitlist();

revoke execute on function public.join_waitlist(uuid, text), public.leave_waitlist(uuid), public.waitlist_status(uuid) from public, anon;
grant execute on function public.join_waitlist(uuid, text), public.leave_waitlist(uuid), public.waitlist_status(uuid) to authenticated;
