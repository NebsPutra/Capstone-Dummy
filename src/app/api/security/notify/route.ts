import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendMail, simpleEmailHtml } from "@/lib/mailer";
import { getServerT } from "@/lib/i18n/server";
import type { TranslationKey } from "@/lib/i18n/translations";

// Emails the signed-in user about a security change on their account. Only
// sends when that change was actually recorded in the last few minutes, so
// the endpoint can't be used to spam anyone (it only mails the caller).
export const runtime = "nodejs";

const EVENTS = ["pin_changed", "pin_reset", "password_changed", "email_changed", "logout_all"] as const;
type SecurityEvent = (typeof EVENTS)[number];

export async function POST(req: NextRequest) {
  const { event } = (await req.json().catch(() => ({}))) as { event?: string };
  if (!EVENTS.includes(event as SecurityEvent)) return NextResponse.json({ error: "bad event" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "not signed in" }, { status: 401 });

  const since = new Date(Date.now() - 5 * 60_000).toISOString();
  const { count } = await supabase
    .from("security_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("type", event!)
    .gte("created_at", since);
  if (!count) return NextResponse.json({ error: "no such event" }, { status: 409 });

  const { t } = await getServerT();
  const when = new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
  const heading = t(`email.security.${event}` as TranslationKey);
  const paras = [t("email.security.body", { what: heading, when: `${when} WIB` }), t("email.security.notYou")];
  const sent = await sendMail({
    to: user.email,
    subject: heading,
    text: paras.join("\n\n"),
    html: simpleEmailHtml(heading, paras, { label: t("email.security.action"), href: `${req.nextUrl.origin}/profile/security` }),
  });
  return NextResponse.json({ sent });
}
