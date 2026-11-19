-- 031: Deleting an organizer must not delete their activities (BB-49, thesis test).
-- events.creator_id used "on delete cascade", so removing an organizer's login in
-- the Supabase dashboard (auth.users -> profiles -> events) deleted all their
-- activities and every participant record with them.
-- Now the database refuses that delete while the person still organizes
-- activities. Remove accounts through the app instead, which anonymizes the
-- profile and keeps activities and participant history:
--   * the member: Profile -> Account security -> Delete my account
--   * an admin:   Admin -> Users -> (user) -> Anonymize
-- Idempotent (drops and re-adds the constraint).

do $$
declare v_name text;
begin
  select c.conname into v_name
  from pg_constraint c
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any (c.conkey)
  where c.conrelid = 'public.events'::regclass and c.contype = 'f' and a.attname = 'creator_id';
  if v_name is not null then
    execute format('alter table public.events drop constraint %I', v_name);
  end if;
end $$;

alter table public.events
  add constraint events_creator_id_fkey
  foreign key (creator_id) references public.profiles(id) on delete restrict;
