-- 025: Reminders and "How was it?" prompts on a schedule (pg_cron). Idempotent.
-- Every hour:
--   * participants of activities starting in 1-24 hours get one reminder;
--   * participants of activities that ended in the last 24 hours get one
--     "How was it?" prompt (only those who checked in, if check-in was used).
-- Emails follow automatically (the notifications webhook, like other types).
--
-- pg_cron must be enabled. If "create extension" fails, enable "pg_cron" in the
-- Supabase dashboard (Database -> Extensions, or Integrations -> Cron) and run
-- this file again.

create extension if not exists pg_cron;

alter table public.events add column if not exists reminder_sent_at timestamptz;
alter table public.events add column if not exists rating_prompt_sent_at timestamptz;

create or replace function public.send_event_reminders()
returns int language plpgsql security definer set search_path = public as $$
declare e record; v_total int := 0; v_n int;
begin
  for e in
    select * from public.events
    where status <> 'cancelled' and reminder_sent_at is null
      and (event_date + start_time) between public.jakarta_now() + interval '1 hour' and public.jakarta_now() + interval '24 hours'
    for update skip locked
  loop
    insert into public.notifications (user_id, type, params, link)
    select ep.user_id, 'event_reminder',
           jsonb_build_object('title', e.title, 'time', to_char(e.start_time, 'HH24:MI'), 'place', e.location_name),
           '/activities/' || e.id
    from public.event_participants ep
    where ep.event_id = e.id and ep.status = 'approved'
      and not ('event_reminder' = any (coalesce((select muted from public.notification_prefs where user_id = ep.user_id), '{}')));
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    update public.events set reminder_sent_at = now() where id = e.id;
  end loop;
  return v_total;
end;
$$;

create or replace function public.send_rating_prompts()
returns int language plpgsql security definer set search_path = public as $$
declare e record; v_total int := 0; v_n int; v_used_checkin boolean;
begin
  for e in
    select * from public.events
    where status <> 'cancelled' and rating_prompt_sent_at is null
      and (event_date + end_time) between public.jakarta_now() - interval '24 hours' and public.jakarta_now()
    for update skip locked
  loop
    v_used_checkin := exists (select 1 from public.event_participants where event_id = e.id and checked_in_at is not null);
    insert into public.notifications (user_id, type, params, link)
    select ep.user_id, 'rate_activity', jsonb_build_object('title', e.title), '/activities/' || e.id
    from public.event_participants ep
    where ep.event_id = e.id and ep.status = 'approved'
      and (not v_used_checkin or ep.checked_in_at is not null)
      and not exists (select 1 from public.event_ratings r where r.event_id = e.id and r.user_id = ep.user_id)
      and not ('rate_activity' = any (coalesce((select muted from public.notification_prefs where user_id = ep.user_id), '{}')));
    get diagnostics v_n = row_count;
    v_total := v_total + v_n;
    update public.events set rating_prompt_sent_at = now() where id = e.id;
  end loop;
  return v_total;
end;
$$;

revoke execute on function public.send_event_reminders(), public.send_rating_prompts() from public, anon, authenticated;

-- Schedule (replace if it already exists).
select cron.unschedule(jobid) from cron.job where jobname in ('komunitas-reminders', 'komunitas-rating-prompts');
select cron.schedule('komunitas-reminders', '5 * * * *', 'select public.send_event_reminders()');
select cron.schedule('komunitas-rating-prompts', '35 * * * *', 'select public.send_rating_prompts()');
