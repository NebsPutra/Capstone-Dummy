-- =========================================================
-- 013 — Per-network throttle for PIN-recovery requests.
-- Run after 012. Idempotent.
--
-- The forgot-PIN "send code" route (pin-recovery/start) previously leaned
-- entirely on Supabase's own OTP limits. This adds an app-level throttle
-- keyed on the same hashed network id used by verify_login_pin, reusing the
-- security_events table and its (client, type, created_at) index.
-- =========================================================

begin;

-- 1. Allow the new event type.
alter table public.security_events drop constraint if exists security_events_type_check;
alter table public.security_events add constraint security_events_type_check check (type in (
  'login_pin', 'login_password', 'pin_failed', 'pin_locked', 'pin_set', 'pin_changed', 'pin_reset',
  'password_changed', 'email_change_requested', 'email_changed', 'logout_all', 'logout_others',
  'admin_pin_unlocked', 'admin_pin_cleared', 'pin_recovery'));

-- 2. Count recent recovery requests for this network; if under the limit,
--    record this one and allow it. Returns true when the request may proceed.
--    Service-role only (called from the server route), never raises.
create or replace function public.rate_limit_recovery(p_client text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_client is null then return true; end if;
  if (select count(*) from public.security_events
      where client = p_client and type = 'pin_recovery'
        and created_at > now() - interval '15 minutes') >= 5 then
    return false;
  end if;
  insert into public.security_events (type, client) values ('pin_recovery', p_client);
  return true;
end;
$$;

revoke execute on function public.rate_limit_recovery(text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.rate_limit_recovery(text) to service_role;
  end if;
end $$;

commit;
