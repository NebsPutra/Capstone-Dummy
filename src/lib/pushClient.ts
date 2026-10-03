// Browser side of web push (see src/lib/push.ts for sending).
import { createClient } from "@/lib/supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export type PushSupport = "ok" | "needs-install" | "unsupported" | "off";

/** Whether this browser can do push. iPhone/iPad only in an installed (Home Screen) app. */
export function pushSupport(): PushSupport {
  if (!KEY) return "off";
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return "unsupported";
  if (!("PushManager" in window)) return /iPhone|iPad|iPod/.test(navigator.userAgent) ? "needs-install" : "unsupported";
  return "ok";
}

function keyBytes(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const raw = atob((base64url + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Ask permission, subscribe this browser and save it for the signed-in user. */
export async function enablePush(lang: "en" | "id"): Promise<"ok" | "denied" | "error"> {
  if ((await Notification.requestPermission()) !== "granted") return "denied";
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) as BufferSource }));
  const json = sub.toJSON();
  const { error } = await createClient()
    .from("push_subscriptions")
    .upsert({ endpoint: sub.endpoint, p256dh: json.keys?.p256dh, auth: json.keys?.auth, lang }, { onConflict: "endpoint" });
  if (error) {
    console.error("[komunitas] save push subscription:", error);
    return "error";
  }
  return "ok";
}

/**
 * Unsubscribe this browser and forget it. Also called on sign-out, so the next
 * person who signs in on this device doesn't get the previous person's pushes.
 */
export async function disablePush(): Promise<void> {
  try {
    if (pushSupport() !== "ok") return;
    const sub = await currentSubscription();
    if (!sub) return;
    await createClient().from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
    await sub.unsubscribe();
  } catch (err) {
    console.error("[komunitas] disable push:", err);
  }
}
