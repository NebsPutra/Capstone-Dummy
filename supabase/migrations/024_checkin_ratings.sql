-- 024: Check-in (attendance) and "How was it?" ratings. Idempotent; safe before deploy.
-- Check-in: the organizer ticks people off, or shows a QR code that approved
-- participants scan to check themselves in (from 1 hour before the start until
-- 1 hour after the end). Ratings: after an activity, approved participants
-- (only those who checked in, if the organizer used check-in) rate it 1-5 with
-- an optional comment, for up to 14 days. organizer_rating() is the average.

alter table public.event_participants add column if not exists checked_in_at timestamptz;

-- QR check-in codes: only the organizer can read them (not a column on events,
-- which every signed-in user can read).
create table if not exists public.event_checkin_codes (
  event_id uuid primary key references public.events(id) on delete cascade,
  code text not null default upper(substr(md5(gen_random_uuid()::text), 1, 8))
);
alter table public.event_checkin_codes enable row level security;
revoke all on public.event_checkin_codes from anon, authenticated;

create or replace function public._checkin_window_open(e public.events)
returns boolean language sql stable as $$
  select public.jakarta_now() between (e.event_date + e.start_time) - interval '1 hour'
                                  and (e.event_date + e.end_time) + interval '1 hour';
$$;

-- Organizer: the code for the QR (created on first use).
create or replace function public.checkin_code(p_event uuid)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_event_owner(p_event) and not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  insert into public.event_checkin_codes (event_id) values (p_event) on conflict do nothing;
  select code into v_code from public.event_checkin_codes where event_id = p_event;
  return v_code;
end;
$$;

-- Participant: scan the organizer's QR.
create or replace function public.check_in(p_event uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare e public.events;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into e from public.events where id = p_event;
  if not found or e.status = 'cancelled' then raise exception 'EVENT_NOT_FOUND'; end if;
  if not exists (select 1 from public.event_checkin_codes where event_id = p_event and code = upper(trim(p_code))) then
    raise exception 'CHECKIN_CODE_INVALID';
  end if;
  if not public._checkin_window_open(e) then raise exception 'CHECKIN_CLOSED'; end if;
  update public.event_participants set checked_in_at = coalesce(checked_in_at, now())
  where event_id = p_event and user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
end;
$$;

-- Organizer: tick someone off (until 2 days after the end).
create or replace function public.set_attendance(p_participant_id uuid, p_present boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r public.event_participants; e public.events;
begin
  select * into r from public.event_participants where id = p_participant_id;
  if not found or r.status <> 'approved' then raise exception 'PARTICIPANT_NOT_FOUND'; end if;
  select * into e from public.events where id = r.event_id;
  if not public.is_event_owner(e.id) and not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if public.jakarta_now() < (e.event_date + e.start_time) - interval '1 hour'
     or public.jakarta_now() > (e.event_date + e.end_time) + interval '2 days' then
    raise exception 'CHECKIN_CLOSED';
  end if;
  update public.event_participants set checked_in_at = case when p_present then coalesce(checked_in_at, now()) end
  where id = p_participant_id;
end;
$$;

-- Ratings -------------------------------------------------------------------
create table if not exists public.event_ratings (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 300),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);
alter table public.event_ratings enable row level security;
revoke all on public.event_ratings from anon;
revoke insert, update, delete on public.event_ratings from authenticated;
drop policy if exists "own rating readable" on public.event_ratings;
create policy "own rating readable" on public.event_ratings
  for select to authenticated using (user_id = auth.uid() or public.is_event_owner(event_id) or public.is_staff());

create or replace function public.rate_event(p_event uuid, p_rating int, p_comment text default null)
returns void language plpgsql security definer set search_path = public as $$
declare e public.events; r public.event_participants;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into e from public.events where id = p_event;
  if not found or e.status = 'cancelled' then raise exception 'EVENT_NOT_FOUND'; end if;
  if public.jakarta_now() < (e.event_date + e.end_time)
     or public.jakarta_now() > (e.event_date + e.end_time) + interval '14 days' then
    raise exception 'RATING_CLOSED';
  end if;
  select * into r from public.event_participants where event_id = p_event and user_id = auth.uid() and status = 'approved';
  if not found then raise exception 'NOT_ALLOWED'; end if;
  -- If the organizer took attendance, only people who were there can rate.
  if r.checked_in_at is null and exists (
       select 1 from public.event_participants where event_id = p_event and checked_in_at is not null) then
    raise exception 'NOT_ALLOWED';
  end if;
  if p_rating not between 1 and 5 or char_length(coalesce(p_comment, '')) > 300 then raise exception 'INVALID_STATUS'; end if;
  insert into public.event_ratings (event_id, user_id, rating, comment)
  values (p_event, auth.uid(), p_rating, nullif(trim(p_comment), ''))
  on conflict (event_id, user_id) do update set rating = excluded.rating, comment = excluded.comment, created_at = now();
end;
$$;

-- Average rating of everything a person has organized (public: shown on activities).
create or replace function public.organizer_rating(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('average', round(avg(r.rating)::numeric, 1), 'count', count(*))
  from public.event_ratings r join public.events e on e.id = r.event_id
  where e.creator_id = p_user;
$$;

-- Recent comments on an organizer's activities (signed-in users, profile page).
create or replace function public.organizer_reviews(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at,
                              'activity', e.title) x
    from public.event_ratings r join public.events e on e.id = r.event_id
    where e.creator_id = p_user and r.comment is not null
    order by r.created_at desc limit 10) t;
$$;

revoke execute on function public.checkin_code(uuid), public.check_in(uuid, text), public.set_attendance(uuid, boolean),
  public.rate_event(uuid, int, text), public.organizer_reviews(uuid) from public, anon;
grant execute on function public.checkin_code(uuid), public.check_in(uuid, text), public.set_attendance(uuid, boolean),
  public.rate_event(uuid, int, text), public.organizer_reviews(uuid) to authenticated;
revoke execute on function public.organizer_rating(uuid) from public;
grant execute on function public.organizer_rating(uuid) to anon, authenticated;
revoke execute on function public._checkin_window_open(public.events) from public, anon, authenticated;
