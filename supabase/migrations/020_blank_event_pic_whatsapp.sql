-- 020: Organizer WhatsApp privacy, step 2 of 2 (see 016).
-- Run AFTER deploying the app code that reads event_contacts. Idempotent.
-- Blanks events.pic_whatsapp so signed-in users can no longer read every
-- organizer's number through the API, and keeps it blank from now on.

create or replace function public.events_move_contact()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.event_contacts (event_id, pic_whatsapp)
  values (new.id, new.pic_whatsapp)
  on conflict (event_id) do update set pic_whatsapp = excluded.pic_whatsapp;
  update public.events set pic_whatsapp = null where id = new.id;
  return null;
end;
$$;

insert into public.event_contacts (event_id, pic_whatsapp)
select id, pic_whatsapp from public.events where pic_whatsapp is not null
on conflict (event_id) do update set pic_whatsapp = excluded.pic_whatsapp;
update public.events set pic_whatsapp = null where pic_whatsapp is not null;
