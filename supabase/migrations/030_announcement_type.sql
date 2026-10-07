-- 030: Allow the "announcement" notification type (fixes sending from
-- Admin > Notifications after 029). Idempotent; same list as 022 plus
-- 'announcement'.

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'complaint_submitted', 'complaint_status', 'complaint_reply',
  'join_request', 'join_approved', 'join_rejected', 'event_cancelled', 'account_status',
  'security_alert', 'friend_request', 'friend_accepted', 'new_message', 'event_comment', 'comment_reply',
  'comment_moderated', 'play_request_ready',
  'event_changed', 'group_new_event', 'interest_match', 'organizer_message',
  'waitlist_promoted', 'event_reminder', 'rate_activity', 'announcement'));
