-- 017: Recurring activities ("every week"). Idempotent; safe before deploy.
-- Each date is its own event row (own seats, own participants), linked by a
-- shared series_id, so joining, capacity and approval work exactly as before.

alter table public.events add column if not exists series_id uuid;
create index if not exists events_series_idx on public.events (series_id) where series_id is not null;

-- Logged-out visitors may see which dates belong together (see 015).
grant select (series_id) on public.events to anon;

-- Only the organizer can add dates to their own series: stops someone from
-- attaching their activity to another organizer's series.
create or replace function public.events_check_series()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.series_id is not null and exists (
    select 1 from public.events
    where series_id = new.series_id and creator_id <> new.creator_id and id <> new.id
  ) then
    raise exception 'SERIES_NOT_OWNER' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_events_check_series on public.events;
create trigger trg_events_check_series
before insert or update of series_id on public.events
for each row when (new.series_id is not null)
execute function public.events_check_series();
