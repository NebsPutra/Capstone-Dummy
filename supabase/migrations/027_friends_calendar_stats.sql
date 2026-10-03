-- 027: Friends going, calendar feed, engagement stats, review reports. Idempotent; safe before deploy.
--   1. organizer_reviews() also returns event_id (for "Report" on a review).
--   2. friends_going(): for a list of activities, how many of your friends are
--      going and up to 2 names (friends who hide their activities are left out).
--   3. Calendar feed: a secret per-user token; calendar_feed() returns that
--      person's activities for /api/calendar/<token>.ics (subscribe once in
--      Google/Apple Calendar). reset_calendar_token() invalidates old links.
--   4. admin_engagement_stats(from, to): show-up rate, ratings, waiting list,
--      reminders, alerts, push, for the admin analytics page.

-- 1 ---------------------------------------------------------------------------
create or replace function public.organizer_reviews(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x order by x->>'created_at' desc), '[]'::jsonb) from (
    select jsonb_build_object('rating', r.rating, 'comment', r.comment, 'created_at', r.created_at,
                              'activity', e.title, 'event_id', e.id) x
    from public.event_ratings r join public.events e on e.id = r.event_id
    where e.creator_id = p_user and r.comment is not null
    order by r.created_at desc limit 10) t;
$$;

-- 2 ---------------------------------------------------------------------------
create or replace function public.friends_going(p_events uuid[])
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(event_id, jsonb_build_object('count', n, 'names', names)), '{}'::jsonb)
  from (
    select ep.event_id, count(*) as n,
           (array_agg(public._display_name(ep.user_id) order by ep.joined_at))[1:2] as names
    from public.event_participants ep
    join public.friendships f
      on f.status = 'accepted'
     and ((f.requester_id = auth.uid() and f.addressee_id = ep.user_id)
       or (f.addressee_id = auth.uid() and f.requester_id = ep.user_id))
    left join public.privacy_settings s on s.user_id = ep.user_id
    where ep.event_id = any (p_events[1:100]) and ep.status = 'approved'
      and coalesce(s.show_activities, true)
    group by ep.event_id
  ) t;
$$;
revoke execute on function public.friends_going(uuid[]) from public, anon;
grant execute on function public.friends_going(uuid[]) to authenticated;

-- 3 ---------------------------------------------------------------------------
create table if not exists public.calendar_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- 64 hex chars from two random UUIDs (built in; no extension needed).
  token text not null unique default md5(gen_random_uuid()::text) || md5(gen_random_uuid()::text),
  created_at timestamptz not null default now()
);
alter table public.calendar_tokens enable row level security;
revoke all on public.calendar_tokens from anon, authenticated;

-- Your feed token (created on first use).
create or replace function public.my_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  insert into public.calendar_tokens (user_id) values (auth.uid()) on conflict do nothing;
  select token into v from public.calendar_tokens where user_id = auth.uid();
  return v;
end;
$$;

create or replace function public.reset_calendar_token()
returns text language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'NOT_AUTHENTICATED'; end if;
  delete from public.calendar_tokens where user_id = auth.uid();
  return public.my_calendar_token();
end;
$$;

-- The feed itself: callable without signing in (calendar apps can't), so the
-- token is the secret. Activities you organize or are going to, from 30 days ago on.
create or replace function public.calendar_feed(p_token text)
returns table (id uuid, title text, description text, location_name text, address text,
               event_date date, start_time time, end_time time, cancelled boolean)
language sql stable security definer set search_path = public as $$
  select e.id, e.title, e.description, e.location_name, e.address, e.event_date, e.start_time, e.end_time,
         e.status = 'cancelled'
  from public.calendar_tokens c
  join public.events e on e.creator_id = c.user_id
       or exists (select 1 from public.event_participants ep
                  where ep.event_id = e.id and ep.user_id = c.user_id and ep.status = 'approved')
  where c.token = p_token and length(p_token) >= 32
    and e.event_date >= (public.jakarta_now())::date - 30
  order by e.event_date, e.start_time
  limit 500;
$$;

revoke execute on function public.my_calendar_token(), public.reset_calendar_token() from public, anon;
grant execute on function public.my_calendar_token(), public.reset_calendar_token() to authenticated;
revoke execute on function public.calendar_feed(text) from public;
grant execute on function public.calendar_feed(text) to anon, authenticated;

-- 4 ---------------------------------------------------------------------------
-- Same range arguments and access as the other admin analytics (moderator+).
create or replace function public.admin_engagement_stats(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_rank(1);
  return (
    with finished as (
      select e.id from public.events e
      where e.status <> 'cancelled' and (e.event_date + e.end_time) < public.jakarta_now()
        and (e.event_date + e.end_time) >= (p_from at time zone 'Asia/Jakarta')
        and (e.event_date + e.end_time) < (p_to at time zone 'Asia/Jakarta')
    ),
    took_attendance as (
      select distinct ep.event_id from public.event_participants ep
      join finished f on f.id = ep.event_id where ep.checked_in_at is not null
    ),
    attendance as (
      select count(*) filter (where ep.status = 'approved') as approved,
             count(*) filter (where ep.checked_in_at is not null) as present
      from public.event_participants ep join took_attendance t on t.event_id = ep.event_id
    ),
    ratings as (
      select count(*) as n, round(avg(r.rating)::numeric, 2) as average
      from public.event_ratings r where r.created_at >= p_from and r.created_at < p_to
    ),
    notif as (
      select type, count(*) as n from public.notifications
      where created_at >= p_from and created_at < p_to
        and type in ('event_reminder', 'rate_activity', 'waitlist_promoted', 'event_changed',
                     'organizer_message', 'group_new_event', 'interest_match')
      group by type
    )
    select jsonb_build_object(
      'finished_activities', (select count(*) from finished),
      'activities_with_checkin', (select count(*) from took_attendance),
      'show_up_rate', (select case when approved > 0 then round(100.0 * present / approved, 1) end from attendance),
      'ratings', (select n from ratings),
      'average_rating', (select average from ratings),
      'waiting_now', (select count(*) from public.event_waitlist),
      'notifications', coalesce((select jsonb_object_agg(type, n) from notif), '{}'::jsonb),
      'push_devices', (select count(*) from public.push_subscriptions),
      'groups', (select count(*) from public.groups),
      'open_play_requests', (select count(*) from public.play_requests where closed_at is null)
    )
  );
end;
$$;
revoke execute on function public.admin_engagement_stats(timestamptz, timestamptz) from public, anon;
grant execute on function public.admin_engagement_stats(timestamptz, timestamptz) to authenticated;
