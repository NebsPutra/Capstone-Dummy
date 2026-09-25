-- Fix: infinite recursion between events and event_participants RLS policies.
-- Run this once in the Supabase SQL Editor against your existing project.

-- Security-definer helpers bypass RLS internally, breaking the cross-table loop.
create or replace function public.is_event_owner(_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.events e
    where e.id = _event_id and e.creator_id = auth.uid()
  );
$$;

create or replace function public.is_event_participant(_event_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_participants ep
    where ep.event_id = _event_id and ep.user_id = auth.uid()
  );
$$;

-- Re-point the three recursive policies at the helper functions.
drop policy if exists "public events readable" on public.events;
create policy "public events readable" on public.events
  for select using (
    privacy = 'public'
    or creator_id = auth.uid()
    or public.is_event_participant(id)
  );

drop policy if exists "participants visible to creator or self" on public.event_participants;
create policy "participants visible to creator or self" on public.event_participants
  for select using (
    user_id = auth.uid()
    or public.is_event_owner(event_id)
  );

drop policy if exists "users can update own participation" on public.event_participants;
create policy "users can update own participation" on public.event_participants
  for update using (
    user_id = auth.uid()
    or public.is_event_owner(event_id)
  );
