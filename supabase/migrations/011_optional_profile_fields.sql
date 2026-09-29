-- =========================================================
-- 011 — WhatsApp number, gender and bio become optional (data minimization).
-- Run after 010. Idempotent; replaces one function only.
--
-- set_user_interests() (the final sign-up step, from 002) refused to finish
-- registration unless the profile had a WhatsApp number, gender and bio.
-- The app no longer requires them: organizers enter a contact WhatsApp on
-- each activity, and gender only feeds optional admin statistics. Name,
-- nickname and area are still required.
-- =========================================================

begin;

create or replace function public.set_user_interests(p_interest_ids uuid[], p_primary uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if p_interest_ids is null or array_length(p_interest_ids, 1) is null then
    raise exception 'INTERESTS_REQUIRED';
  end if;
  if p_primary is null or not (p_primary = any (p_interest_ids)) then
    raise exception 'PRIMARY_NOT_SELECTED';
  end if;

  select * into v_profile from public.profiles where id = v_uid;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;

  -- A first-time registrant must have finished the personal-info step.
  if v_profile.onboarding_completed_at is null and (
       coalesce(trim(v_profile.full_name), '') = ''
    or coalesce(trim(v_profile.nickname), '') = ''
    or v_profile.city_id is null
    or v_profile.kecamatan_id is null
    or v_profile.kelurahan_id is null
  ) then
    raise exception 'PROFILE_INCOMPLETE';
  end if;

  delete from public.user_interests
  where user_id = v_uid and interest_id <> all (p_interest_ids);

  insert into public.user_interests (user_id, interest_id)
  select v_uid, i from unnest(p_interest_ids) as i
  on conflict do nothing;

  perform set_config('komunitas.onboarding', 'on', true);
  update public.profiles
  set primary_interest_id = p_primary,
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = v_uid;
end;
$$;

commit;
