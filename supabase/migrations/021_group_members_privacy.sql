-- 021: Group member lists respect blocks and privacy settings. Idempotent.
-- group_get (019) listed every member to any signed-in user. Now a member is
-- listed only when the viewer may see their profile (_can_view_profile: not
-- blocked either way, profile_visibility allows it) and they haven't hidden
-- their activities (show_activities). The organizer is always listed unless
-- blocked, like an activity's organizer. member_count still counts everyone.

create or replace function public.group_get(p_group uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); g public.groups;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into g from public.groups where id = p_group;
  if not found or public._is_blocked(v_uid, g.creator_id) then raise exception 'GROUP_NOT_FOUND'; end if;
  return public._group_card(g, v_uid) || jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('username', p.username, 'display_name', public._display_name(p.id),
                                          'avatar_url', p.avatar_url, 'role', m.role) order by m.role = 'owner' desc, m.joined_at)
      from (
        select gm.* from public.group_members gm
        join public.profiles p2 on p2.id = gm.user_id
        left join public.privacy_settings s on s.user_id = gm.user_id
        where gm.group_id = p_group
          and p2.account_status = 'active'
          and not public._is_blocked(v_uid, gm.user_id)
          and (gm.role = 'owner'
               or gm.user_id = v_uid
               or (public._can_view_profile(gm.user_id, v_uid) and coalesce(s.show_activities, true)))
        order by gm.role = 'owner' desc, gm.joined_at
        limit 24
      ) m
      join public.profiles p on p.id = m.user_id), '[]'::jsonb));
end;
$$;
revoke execute on function public.group_get(uuid) from public, anon;
grant execute on function public.group_get(uuid) to authenticated;
