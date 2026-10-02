-- 016: Organizer WhatsApp privacy for signed-in users (step 1 of 2).
-- Idempotent. Safe to run BEFORE the new app code is deployed: it only copies.
-- Step 2 (020_blank_event_pic_whatsapp.sql) blanks the old column and must run
-- AFTER the deploy, because the old code expects events.pic_whatsapp.
--
-- Before: any signed-in user could read events.pic_whatsapp of every public
-- activity through the API, even when the organizer hid it (whatsapp_public
-- = false). RLS can't hide one column, so the number moves to its own table
-- whose RLS only shows it to the organizer, approved participants, or anyone
-- who can see the activity when the organizer made it public.

create table if not exists public.event_contacts (
  event_id uuid primary key references public.events(id) on delete cascade,
  pic_whatsapp text not null
);
alter table public.event_contacts enable row level security;
revoke all on public.event_contacts from anon;

drop policy if exists "contact visible to organizer, approved participants or when public" on public.event_contacts;
create policy "contact visible to organizer, approved participants or when public" on public.event_contacts
  for select to authenticated using (
    public.is_staff()
    or exists (
      select 1 from public.events e
      where e.id = event_contacts.event_id
        and (e.creator_id = auth.uid() or e.whatsapp_public)
    )
    or exists (
      select 1 from public.event_participants p
      where p.event_id = event_contacts.event_id and p.user_id = auth.uid() and p.status = 'approved'
    )
  );

drop policy if exists "organizer writes contact" on public.event_contacts;
drop policy if exists "organizer or admin writes contact" on public.event_contacts;
create policy "organizer or admin writes contact" on public.event_contacts
  for all to authenticated
  using (public.is_admin() or exists (select 1 from public.events e where e.id = event_contacts.event_id and e.creator_id = auth.uid()))
  with check (public.is_admin() or exists (select 1 from public.events e where e.id = event_contacts.event_id and e.creator_id = auth.uid()));

-- The new app code writes the number to event_contacts only.
alter table public.events alter column pic_whatsapp drop not null;

-- The old app code (live until the next deploy) still writes the number into
-- events: keep event_contacts in sync. Step 2 makes this also blank the column.
create or replace function public.events_move_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_contacts (event_id, pic_whatsapp)
  values (new.id, new.pic_whatsapp)
  on conflict (event_id) do update set pic_whatsapp = excluded.pic_whatsapp;
  return null;
end;
$$;
drop trigger if exists trg_events_move_contact on public.events;
create trigger trg_events_move_contact
after insert or update of pic_whatsapp on public.events
for each row when (new.pic_whatsapp is not null)
execute function public.events_move_contact();

-- Backfill existing activities.
insert into public.event_contacts (event_id, pic_whatsapp)
select id, pic_whatsapp from public.events where pic_whatsapp is not null
on conflict (event_id) do nothing;
