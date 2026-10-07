-- 029: Announcements. Idempotent; safe before deploy.
--   * New notification type "announcement": an admin writes one message and
--     every active, onboarded account gets it in-app, by web push and by email
--     (through the existing notifications webhook).
--   * It's mutable, so anyone can turn "News & tips" off in Settings ->
--     Notifications; _notify() then skips them (no email either).
--   * At most one announcement per hour, so a double click can't send twice.

create or replace function public._mutable_notification_types()
returns text[] language sql immutable as $$
  select array['event_comment', 'comment_reply', 'friend_request', 'friend_accepted', 'new_message', 'join_request',
               'group_new_event', 'interest_match', 'event_reminder', 'rate_activity', 'announcement'];
$$;

-- Who an announcement goes to: active accounts that finished onboarding and
-- haven't muted announcements.
create or replace function public.announcement_recipient_count()
returns int language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  return (
    select count(*)::int from public.profiles p
    where p.account_status = 'active' and p.onboarding_completed_at is not null
      and not ('announcement' = any (coalesce((select muted from public.notification_prefs where user_id = p.id), '{}')))
  );
end;
$$;

create or replace function public.send_announcement(p_title text, p_body text, p_link text default '/create')
returns int language plpgsql security definer set search_path = public as $$
declare
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_link text := coalesce(nullif(btrim(p_link), ''), '/create');
  v_started timestamptz := clock_timestamp();
  v_sent int;
begin
  if not public.is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if char_length(v_title) not between 3 and 80 or char_length(v_body) not between 10 and 500 then
    raise exception 'INVALID_INPUT';
  end if;
  -- Only links inside the app (no outside URLs in a mass email).
  if v_link !~ '^/[A-Za-z0-9/_?=&-]*$' then raise exception 'INVALID_INPUT'; end if;
  if exists (select 1 from public.audit_logs where action = 'announcement_sent' and created_at > now() - interval '1 hour') then
    raise exception 'TOO_SOON';
  end if;

  -- _notify() applies each person's mute settings.
  perform public._notify(p.id, 'announcement', jsonb_build_object('title', v_title, 'body', v_body), v_link)
  from public.profiles p
  where p.account_status = 'active' and p.onboarding_completed_at is not null;

  select count(*)::int into v_sent from public.notifications
  where type = 'announcement' and created_at >= now() and params ->> 'title' = v_title;

  perform public._audit('announcement_sent', 'announcement', null, null,
    jsonb_build_object('title', v_title, 'body', v_body, 'link', v_link),
    jsonb_build_object('recipients', v_sent, 'seconds', round(extract(epoch from clock_timestamp() - v_started)::numeric, 1)));
  return v_sent;
end;
$$;

revoke execute on function public.announcement_recipient_count() from public, anon;
revoke execute on function public.send_announcement(text, text, text) from public, anon;
grant execute on function public.announcement_recipient_count() to authenticated;
grant execute on function public.send_announcement(text, text, text) to authenticated;
