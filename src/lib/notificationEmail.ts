import { translate, type TranslationKey } from "@/lib/i18n/translations";

/** Notification types that also go out by email (the rest stay in-app only). */
export const EMAIL_TYPES = [
  "new_message",
  "event_comment",
  "comment_reply",
  "friend_request",
  "join_request",
  "play_request_ready",
  "event_changed",
  "organizer_message",
  "waitlist_promoted",
  "event_reminder",
  "announcement",
] as const;

/** At most one email per type per person in this window, so a live chat doesn't flood the inbox. */
export const EMAIL_THROTTLE_MINUTES = 15;

type NotificationRow = { type: string; params?: Record<string, unknown> | null; link?: string | null };

/**
 * Email content for one notification, in English and Indonesian (we don't
 * store a language per user). Returns null for types that aren't emailed.
 * Never includes a member's message text, same as the in-app notification;
 * announcements carry the admin's own text.
 */
export function notificationEmail(n: NotificationRow, origin: string) {
  if (!(EMAIL_TYPES as readonly string[]).includes(n.type)) return null;
  const vars = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  const key = `notifType.${n.type}` as TranslationKey;
  const link = n.link?.startsWith("/") ? `${origin}${n.link}` : `${origin}/notifications`;
  const action = { label: `${translate("en", "email.notif.open")} / ${translate("id", "email.notif.open")}`, href: link };
  if (n.type === "announcement") {
    // Written by an admin (already in the language(s) they chose); escaped by simpleEmailHtml.
    return {
      subject: vars.title,
      paragraphs: vars.body.split(/\n+/).filter(Boolean),
      action,
      footer: `${translate("en", "email.announce.footer")}\n${translate("id", "email.announce.footer")}`,
    };
  }
  return {
    subject: `${translate("en", key, vars)} · ${translate("id", key, vars)}`,
    paragraphs: [translate("en", key, vars), translate("id", key, vars)],
    action,
    footer: `${translate("en", "email.notif.footer")}\n${translate("id", "email.notif.footer")}`,
  };
}
