-- Demo data for presentations: realistic public activities around Jakarta,
-- 2 groups and 2 "Find players" requests, so every screen has content.
-- NOT a migration: run it by hand in the Supabase SQL editor only if you want
-- demo content in the live database. Everything is created by the first admin
-- account and dated relative to today, so it is always upcoming.
--
-- Every demo row has a fixed id starting with a/b/c/d0000000-0000-4000-8000-,
-- so it can be removed at any time with the REMOVE block at the bottom, even
-- after titles were edited or people joined. Running this file twice does not
-- create duplicates (on conflict do nothing).

begin;

-- 1. Groups (owner = first admin).
with me as (
  select id from public.profiles where role in ('super_admin', 'admin') order by created_at limit 1
)
insert into public.groups (id, creator_id, category_id, name, description, area)
select v.id::uuid, me.id, c.id, v.name, v.description, v.area
from (values
  ('a0000000-0000-4000-8000-000000000001', 'group_run', 'Lari Pagi Senayan',
   'Easy-paced Saturday runs around GBK. All paces welcome, we wait at every lap.', 'Senayan, Jakarta Pusat'),
  ('a0000000-0000-4000-8000-000000000002', 'book_discussion', 'Klub Buku Blok M',
   'One book a month, discussed over coffee. Indonesian and English books.', 'Blok M, Jakarta Selatan')
) as v(id, cat, name, description, area)
join public.categories c on c.key = v.cat
cross join me
on conflict (id) do nothing;

insert into public.group_members (group_id, user_id, role)
select g.id, g.creator_id, 'owner' from public.groups g
where g.id in ('a0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000002')
on conflict do nothing;

-- 2. Activities. Two weekly series share a series_id; two belong to the groups.
--    The organizer contact is the admin's WhatsApp (moved to event_contacts by trigger).
with me as (
  select id, coalesce(nullif(nickname, ''), full_name, 'Komunitas') as name,
         coalesce(whatsapp_number, '+628120000000') as wa
  from public.profiles where role in ('super_admin', 'admin') order by created_at limit 1
)
insert into public.events (
  id, creator_id, category_id, title, description, event_date, start_time, end_time,
  max_participants, fee, location_name, address, latitude, longitude,
  pic_name, pic_whatsapp, whatsapp_public, privacy, join_permission, skill_level, series_id, group_id
)
select v.id::uuid, me.id, c.id, v.title, v.description,
       -- The two weekly series land on their real weekday (next Saturday / Sunday);
       -- everything else is "today + days".
       case
         when v.series = 'b0000000-0000-4000-8000-000000000001'
           then current_date + ((6 - extract(dow from current_date)::int + 7) % 7) + (v.days - 2)
         when v.series = 'b0000000-0000-4000-8000-000000000002'
           then current_date + ((7 - extract(dow from current_date)::int) % 7) + (v.days - 1)
         else current_date + v.days
       end, v.start_t::time, v.end_t::time,
       v.max_p, v.fee, v.place, v.address, v.lat, v.lng,
       me.name, me.wa, false, 'public', v.perm::join_permission, v.level, v.series::uuid, v.grp::uuid
from (values
  -- id, title, category, description, days from today, start, end, max, fee, place, address, lat, lng, join, level, series, group
  ('c0000000-0000-4000-8000-000000000001', 'Saturday Easy Run at GBK', 'group_run', 'A relaxed 5 km around the GBK loop. Nobody gets left behind. Stretching together after.', 2, '06:00', '07:30', 30, 0, 'Gelora Bung Karno', 'Jl. Pintu Satu Senayan, Jakarta Pusat', -6.2185, 106.8018, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002', 'Saturday Easy Run at GBK', 'group_run', 'A relaxed 5 km around the GBK loop. Nobody gets left behind. Stretching together after.', 9, '06:00', '07:30', 30, 0, 'Gelora Bung Karno', 'Jl. Pintu Satu Senayan, Jakarta Pusat', -6.2185, 106.8018, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000003', 'Saturday Easy Run at GBK', 'group_run', 'A relaxed 5 km around the GBK loop. Nobody gets left behind. Stretching together after.', 16, '06:00', '07:30', 30, 0, 'Gelora Bung Karno', 'Jl. Pintu Satu Senayan, Jakarta Pusat', -6.2185, 106.8018, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000004', 'Book Club: Laut Bercerita', 'book_discussion', 'We discuss Leila S. Chudori''s Laut Bercerita. Finished the book or not, come and listen.', 5, '15:00', '17:00', 15, 25000, 'Taman Literasi Martha Christina Tiahahu', 'Jl. Sisingamangaraja, Blok M, Jakarta Selatan', -6.2444, 106.8010, 'open', 'all', null, 'a0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000005', 'Silent Reading Hour', 'reading_together', 'Bring any book and read quietly together for an hour, then share what you read.', 3, '10:00', '11:30', 20, 0, 'Perpustakaan Nasional', 'Jl. Medan Merdeka Selatan No.11, Jakarta Pusat', -6.1817, 106.8270, 'open', 'beginner', null, null),
  ('c0000000-0000-4000-8000-000000000006', 'Badminton Doubles Night', 'badminton', 'Friendly doubles, rotating partners. Shuttlecocks provided, bring your own racket.', 4, '19:00', '21:00', 12, 35000, 'GOR Bulungan', 'Jl. Bulungan No.1, Kebayoran Baru, Jakarta Selatan', -6.2442, 106.7983, 'approval_required', 'all', null, null),
  ('c0000000-0000-4000-8000-000000000007', '3x3 Basketball Pickup', 'basketball', 'Pickup games, winners stay on. Some experience helps, the pace is fast.', 6, '16:00', '18:00', 18, 0, 'Lapangan Banteng', 'Jl. Lapangan Banteng, Pasar Baru, Jakarta Pusat', -6.1704, 106.8352, 'open', 'experienced', null, null),
  ('c0000000-0000-4000-8000-000000000008', 'Car Free Day Ride', 'cycling', 'Ride Sudirman-Thamrin during Car Free Day at an easy pace, then breakfast together.', 8, '06:30', '08:30', 25, 0, 'Bundaran HI', 'Jl. M.H. Thamrin, Jakarta Pusat', -6.1951, 106.8231, 'open', 'beginner', null, null),
  ('c0000000-0000-4000-8000-000000000009', 'Futsal Fun Match', 'futsal', 'Casual 5-a-side. We split teams on the spot. Court fee shared.', 10, '20:00', '22:00', 14, 40000, 'Futsal Kemang', 'Jl. Kemang Raya, Jakarta Selatan', -6.2607, 106.8135, 'open', 'all', null, null),
  ('c0000000-0000-4000-8000-000000000010', 'Heritage Walk Kota Tua', 'walking', 'A slow walk through Kota Tua with stories about the old buildings. Comfortable shoes!', 7, '08:00', '10:30', 20, 0, 'Museum Fatahillah', 'Jl. Taman Fatahillah No.1, Jakarta Barat', -6.1352, 106.8133, 'open', 'beginner', null, null),
  ('c0000000-0000-4000-8000-000000000011', 'Board Game Evening', 'gaming', 'Light party games to start, heavier games later. Teaching included.', 4, '18:30', '22:00', 16, 20000, 'Kopi Cikini', 'Jl. Cikini Raya, Menteng, Jakarta Pusat', -6.1890, 106.8392, 'open', 'beginner', null, null),
  ('c0000000-0000-4000-8000-000000000012', 'Community Clean-up Taman Suropati', 'social_activity', 'Pick up litter around the park for an hour. Gloves and bags provided.', 12, '07:00', '09:00', 40, 0, 'Taman Suropati', 'Jl. Taman Suropati, Menteng, Jakarta Pusat', -6.1993, 106.8327, 'open', 'beginner', null, null),
  ('c0000000-0000-4000-8000-000000000013', 'Newcomers Meetup Menteng', 'community_gathering', 'New in Jakarta or just want new friends? Snacks, name tags and simple games.', 11, '16:00', '18:00', 30, 0, 'Taman Menteng', 'Jl. HOS Cokroaminoto, Menteng, Jakarta Pusat', -6.1964, 106.8297, 'open', 'all', null, null),
  ('c0000000-0000-4000-8000-000000000014', 'Sunday Morning Walk', 'walking', 'An easy 4 km walk with chats along the way. Every week.', 1, '06:30', '08:00', 25, 0, 'Hutan Kota GBK', 'Jl. Jenderal Sudirman, Senayan, Jakarta Pusat', -6.2133, 106.8040, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000002', null),
  ('c0000000-0000-4000-8000-000000000015', 'Sunday Morning Walk', 'walking', 'An easy 4 km walk with chats along the way. Every week.', 8, '06:30', '08:00', 25, 0, 'Hutan Kota GBK', 'Jl. Jenderal Sudirman, Senayan, Jakarta Pusat', -6.2133, 106.8040, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000002', null),
  ('c0000000-0000-4000-8000-000000000016', 'Sunday Morning Walk', 'walking', 'An easy 4 km walk with chats along the way. Every week.', 15, '06:30', '08:00', 25, 0, 'Hutan Kota GBK', 'Jl. Jenderal Sudirman, Senayan, Jakarta Pusat', -6.2133, 106.8040, 'open', 'beginner', 'b0000000-0000-4000-8000-000000000002', null)
) as v(id, title, cat, description, days, start_t, end_t, max_p, fee, place, address, lat, lng, perm, level, series, grp)
join public.categories c on c.key = v.cat
cross join me
on conflict (id) do nothing;

-- 3. "Find players" requests.
with me as (
  select id from public.profiles where role in ('super_admin', 'admin') order by created_at limit 1
)
insert into public.play_requests (id, creator_id, category_id, title, note, area, players_needed)
select v.id::uuid, me.id, c.id, v.title, v.note, v.area, v.players
from (values
  ('d0000000-0000-4000-8000-000000000001', 'badminton', 'Badminton doubles, weekday evening', 'Need 3 more for doubles after office. Court near Senayan.', 'Senayan, Jakarta Pusat', 4),
  ('d0000000-0000-4000-8000-000000000002', 'futsal', 'Futsal 5-a-side this weekend', 'Looking for players of any level, we just want to play.', 'Kemang, Jakarta Selatan', 10)
) as v(id, cat, title, note, area, players)
join public.categories c on c.key = v.cat
cross join me
on conflict (id) do nothing;

commit;

-- ---------------------------------------------------------------------------
-- FIX weekdays of the two series if they were seeded with an older version of
-- this file ("Saturday Easy Run" must be on Saturdays, "Sunday Morning Walk" on Sundays):
--
-- update public.events e set event_date = current_date
--     + ((6 - extract(dow from current_date)::int + 7) % 7)
--     + 7 * (right(e.id::text, 2)::int - 1)
--   where e.id::text like 'c0000000-0000-4000-8000-00000000000_' and right(e.id::text, 2)::int between 1 and 3;
-- update public.events e set event_date = current_date
--     + ((7 - extract(dow from current_date)::int) % 7)
--     + 7 * (right(e.id::text, 2)::int - 14)
--   where e.id::text like 'c0000000-0000-4000-8000-0000000000__' and right(e.id::text, 2)::int between 14 and 16;

-- ---------------------------------------------------------------------------
-- REMOVE all demo data (copy these lines without the leading "-- " and run).
-- Safe at any time: participants, comments and contacts of demo activities are
-- deleted with them; nothing created by real users outside the demo rows is touched.
--
-- delete from public.events where id::text like 'c0000000-0000-4000-8000-%';
-- delete from public.play_requests where id::text like 'd0000000-0000-4000-8000-%';
-- delete from public.groups where id::text like 'a0000000-0000-4000-8000-%';
