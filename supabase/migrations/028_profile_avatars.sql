-- 028: Profile pictures. Idempotent; safe before deploy.
--   * "avatars" bucket: public images, 2 MB max, each user writes only to
--     "<user id>/<file>" (same pattern as event-banners).
--   * profiles.avatar_url may only point at the user's own folder in that
--     bucket, so nobody can set an outside URL (tracking pixels, etc.) that
--     every viewer's browser would then load.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "avatar upload own folder" on storage.objects;
create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "avatar delete own folder" on storage.objects;
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
drop policy if exists "avatar read" on storage.objects;
create policy "avatar read" on storage.objects for select
  using (bucket_id = 'avatars');

-- NOT VALID: existing rows are not re-checked (none should break it, but the
-- migration must never fail on old data); every insert/update is checked.
alter table public.profiles drop constraint if exists profiles_avatar_url_own;
alter table public.profiles add constraint profiles_avatar_url_own check (
  avatar_url is null
  or avatar_url ~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/[A-Za-z0-9._-]+$')
) not valid;
