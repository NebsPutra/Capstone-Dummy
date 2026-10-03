-- 022: Activity alerts and "who's going". Idempotent; safe before deploy.
--   1. New notification types (also used by 023-025), some of them muteable.
--   2. Participants are told when the date, time or place of an activity changes.
--   3. Group members are told about a new activity in their group.
--   4. Interest alerts: a new public activity matching your primary interest
--      within 20 km of your registered area (max 3 a day).
--   5. Organizers can message everyone who's going (max 5 a day per activity).
--   6. event_attendees(): who's going, respecting privacy settings.
-- Weekly series (017) only alert once, for their first date.

-- 1. Notification types ------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'complaint_submitted', 'complaint_status', 'complaint_reply',
  'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status',
  'security_alert', 'friend_request', 'friend_accepted', 'new_message', 'event_comment', 'comment_reply',
  'comment_moderated', 'play_request_ready',
  'event_changed', 'group_new_event', 'interest_match', 'organizer_message',
  'waitlist_promoted', 'event_reminder', 'rate_activity'));

-- Types people can switch off in Settings (the rest are about things they joined).
create or replace function public._mutable_notification_types()
returns text[] language sql immutable as $$
  select array['event_comment', 'comment_reply', 'friend_request', 'friend_accepted', 'new_message', 'join_request',
               'group_new_event', 'interest_match', 'event_reminder', 'rate_activity'];
$$;

-- First date of a weekly series (or a one-off activity): the one that alerts.
create or replace function public._is_series_first(e public.events)
returns boolean language sql stable security definer set search_path = public as $$
  select e.series_id is null or not exists (
    select 1 from public.events o
    where o.series_id = e.series_id and (o.event_date, o.id) < (e.event_date, e.id));
$$;

-- 2. Date / time / place changed -----------------------------------------------
create or replace function public.events_notify_changed()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelled' or public.jakarta_now() >= (old.event_date + old.end_time) then
    return null; -- cancellation has its own notice; finished activities don't matter
  end if;
  insert into public.notifications (user_id, type, params, link)
  select ep.user_id, 'event_changed', jsonb_build_object('title', new.title), '/activities/' || new.id
  from public.event_participants ep
  where ep.event_id = new.id and ep.status in ('approved', 'pending');
  return null;
end;
$$;
drop trigger if exists trg_events_notify_changed on public.events;
create trigger trg_events_notify_changed
after update of event_date, start_time, end_time, location_name, address, latitude, longitude on public.events
for each row
when (old.event_date is distinct from new.event_date or old.start_time is distinct from new.start_time
   or old.end_time is distinct from new.end_time or old.location_name is distinct from new.location_name
   or old.address is distinct from new.address
   or old.latitude is distinct from new.latitude or old.longitude is distinct from new.longitude)
execute function public.events_notify_changed();

-- 3 + 4. New activity: group members, then people with a matching interest nearby ---
-- Hobby -> categories; keep in sync with INTEREST_CATEGORY_KEYS in src/lib/interests.ts.
create or replace function public._interest_category_keys(p_interest text)
returns text[] language sql immutable as $$
  select case p_interest
    when 'reading' then array['reading_together', 'book_discussion']
    when 'running' then array['group_run']
    when 'walking' then array['walking']
    when 'cycling' then array['cycling']
    when 'basketball' then array['basketball']
    when 'badminton' then array['badminton']
    when 'futsal' then array['futsal']
    when 'fitness' then array['group_run', 'walking', 'cycling']
    when 'gaming' then array['gaming']
    when 'art' then array['community_gathering', 'other']
    when 'music' then array['community_gathering', 'other']
    when 'social' then array['social_activity', 'community_gathering']
    when 'other' then array['other']
    else array[]::text[] end;
$$;

create or replace function public.events_notify_new()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_cat text;
begin
  if new.privacy <> 'public' or new.status = 'cancelled' or not public._is_series_first(new) then
    return null;
  end if;

  if new.group_id is not null then
    perform public._notify(m.user_id, 'group_new_event',
      jsonb_build_object('title', new.title, 'group', g.name), '/activities/' || new.id)
    from public.group_members m join public.groups g on g.id = m.group_id
    where m.group_id = new.group_id and m.user_id <> new.creator_id;
  end if;

  select key into v_cat from public.categories where id = new.category_id;
  perform public._notify(p.id, 'interest_match', jsonb_build_object('title', new.title), '/activities/' || new.id)
  from public.profiles p
  join public.interests i on i.id = p.primary_interest_id
  where p.id <> new.creator_id
    and p.account_status = 'active' and p.onboarding_completed_at is not null
    and p.area_lat is not null and p.area_lng is not null
    and v_cat = any (public._interest_category_keys(i.key))
    and public.haversine_km(p.area_lat, p.area_lng, new.latitude, new.longitude) <= 20
    -- not twice for the same activity (group members already heard about it)
    and not exists (select 1 from public.group_members m where m.group_id = new.group_id and m.user_id = p.id)
    -- at most 3 interest alerts per person per day
    and (select count(*) from public.notifications n
         where n.user_id = p.id and n.type = 'interest_match' and n.created_at > now() - interval '1 day') < 3
  limit 500;
  return null;
end;
$$;
drop trigger if exists trg_events_notify_new on public.events;
create trigger trg_events_notify_new after insert on public.events
for each row execute function public.events_notify_new();

-- 5. Organizer message to everyone who's going ---------------------------------
create or replace function public.message_participants(p_event uuid, p_message text)
returns int language plpgsql security definer set search_path = public as $$
declare v_event public.events; v_msg text := trim(coalesce(p_message, '')); v_sent int;
begin
  select * into v_event from public.events where id = p_event;
  if not found then raise exception 'EVENT_NOT_FOUND'; end if;
  if v_event.creator_id is distinct from auth.uid() and not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if char_length(v_msg) < 1 or char_length(v_msg) > 300 then raise exception 'MESSAGE_LENGTH'; end if;
  if (select count(distinct created_at) from public.notifications
      where type = 'organizer_message' and link = '/activities/' || p_event
        and created_at > now() - interval '1 day') >= 5 then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.notifications (user_id, type, params, link)
  select ep.user_id, 'organizer_message', jsonb_build_object('title', v_event.title, 'message', v_msg), '/activities/' || p_event
  from public.event_participants ep
  where ep.event_id = p_event and ep.status in ('approved', 'pending');
  get diagnostics v_sent = row_count;
  return v_sent;
end;
$$;
revoke execute on function public.message_participants(uuid, text) from public, anon;
grant execute on function public.message_participants(uuid, text) to authenticated;

-- 6. Who's going ---------------------------------------------------------------
-- Count for anyone who can see the activity (incl. logged-out visitors on public
-- ones); names and avatars only for signed-in viewers, and only of people whose
-- profile they may see and who haven't hidden their activities.
create or replace function public.event_attendees(p_event uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); e public.events;
begin
  select * into e from public.events where id = p_event;
  if not found or not (e.privacy = 'public' or e.creator_id = v_uid or public.is_event_participant(p_event)) then
    raise exception 'EVENT_NOT_FOUND';
  end if;
  return jsonb_build_object(
    'count', (select count(*) from public.event_participants where event_id = p_event and status = 'approved'),
    'people', case when v_uid is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'display_name', public._display_name(p.id),
                                          'avatar_url', p.avatar_url) order by ep.joined_at)
      from (select * from public.event_participants
            where event_id = p_event and status = 'approved' order by joined_at limit 50) ep
      join public.profiles p on p.id = ep.user_id
      left join public.privacy_settings s on s.user_id = p.id
      where p.account_status = 'active'
        and (p.id = v_uid or (public._can_view_profile(p.id, v_uid) and coalesce(s.show_activities, true)))
    ), '[]'::jsonb) end);
end;
$$;
revoke execute on function public.event_attendees(uuid) from public;
grant execute on function public.event_attendees(uuid) to anon, authenticated;
