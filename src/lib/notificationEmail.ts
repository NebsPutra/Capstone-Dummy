import { translate, type TranslationKey } from "@/lib/i18n/translations";

/** Notification types that also go out by email (the rest stay in-app only). */
export const EMAIL_TYPES = [
  "new_message",
  "event_comment",
  "comment_reply",
  "friend_request",
  "join_request",
  "play_request_ready",
] as const;

/** At most one email per type per person in this window, so a live chat doesn't flood the inbox. */
export const EMAIL_THROTTLE_MINUTES = 15;

type NotificationRow = { type: string; params?: Record<string, unknown> | null; link?: string | null };

/**
 * Email content for one notification, in English and Indonesian (we don't
 * store a language per user). Returns null for types that aren't emailed.
 * Never includes the message text itself, same as the in-app notification.
 */
export function notificationEmail(n: NotificationRow, origin: string) {
  if (!(EMAIL_TYPES as readonly string[]).includes(n.type)) return null;
  const vars = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  const key = `notifType.${n.type}` as TranslationKey;
  const link = n.link?.startsWith("/") ? `${origin}${n.link}` : `${origin}/notifications`;
  return {
    subject: `${translate("en", key, vars)} · ${translate("id", key, vars)}`,
    paragraphs: [translate("en", key, vars), translate("id", key, vars)],
    action: { label: `${translate("en", "email.notif.open")} / ${translate("id", "email.notif.open")}`, href: link },
    footer: `${translate("en", "email.notif.footer")}\n${translate("id", "email.notif.footer")}`,
  };
}
