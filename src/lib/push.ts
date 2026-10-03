import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { translate, type TranslationKey } from "@/lib/i18n/translations";
import { SITE_URL } from "@/lib/site";

type NotificationRow = { id: string; user_id: string; type: string; params?: Record<string, unknown> | null; link?: string | null };
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string; lang: "en" | "id" };

/** True when the VAPID keys are set (NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY). */
export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

/** The text a push shows: the in-app notification text, in the device's language. */
export function pushPayload(n: NotificationRow, lang: "en" | "id") {
  const vars = Object.fromEntries(Object.entries(n.params ?? {}).map(([k, v]) => [k, String(v ?? "")]));
  return {
    title: "Komunitas",
    body: translate(lang, `notifType.${n.type}` as TranslationKey, vars),
    url: n.link?.startsWith("/") ? n.link : "/notifications",
    tag: n.id,
  };
}

/**
 * Send one notification to every device the user turned push on for.
 * Devices the push service reports as gone (404/410) are removed.
 * Uses the service-role client: subscriptions are only readable by their owner.
 */
export async function sendPush(admin: SupabaseClient, n: NotificationRow): Promise<number> {
  if (!pushConfigured()) return 0;
  webpush.setVapidDetails(SITE_URL, process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth, lang").eq("user_id", n.user_id);
  let sent = 0;
  for (const s of (data ?? []) as Subscription[]) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify(pushPayload(n, s.lang)),
        { TTL: 60 * 60 * 24 }
      );
      sent++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
      else console.error("[komunitas] web push:", status, (err as Error).message);
    }
  }
  return sent;
}
