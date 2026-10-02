import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMail, simpleEmailHtml } from "@/lib/mailer";
import { EMAIL_THROTTLE_MINUTES, notificationEmail } from "@/lib/notificationEmail";

// Called by a Supabase Database Webhook on INSERT into public.notifications
// (set up in the dashboard, see README). Muted types never get here, because
// _notify() doesn't insert them. Authenticated with a shared secret header.
export const runtime = "nodejs";

function secretOk(got: string | null) {
  const want = process.env.NOTIFY_WEBHOOK_SECRET;
  if (!want || !got) return false;
  const a = Buffer.from(got);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Row = { id: string; user_id: string; type: string; params: Record<string, unknown>; link: string | null; created_at: string };

export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get("x-webhook-secret"))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { type, record } = (await req.json().catch(() => ({}))) as { type?: string; record?: Row };
  if (type !== "INSERT" || !record?.user_id) return NextResponse.json({ skipped: "not an insert" });

  const email = notificationEmail(record, req.nextUrl.origin);
  if (!email) return NextResponse.json({ skipped: "type not emailed" });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service role not configured" }, { status: 500 });

  // Throttle: skip if this person already got a notification of this type recently.
  const since = new Date(new Date(record.created_at).getTime() - EMAIL_THROTTLE_MINUTES * 60_000).toISOString();
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", record.user_id)
    .eq("type", record.type)
    .neq("id", record.id)
    .gte("created_at", since)
    .lte("created_at", record.created_at);
  if (count) return NextResponse.json({ skipped: "throttled" });

  const { data } = await admin.auth.admin.getUserById(record.user_id);
  const to = data.user?.email;
  if (!to) return NextResponse.json({ skipped: "no email" });

  const sent = await sendMail({
    to,
    subject: email.subject,
    text: [...email.paragraphs, `${email.action.label}: ${email.action.href}`, email.footer].join("\n\n"),
    html: simpleEmailHtml(email.subject, email.paragraphs, email.action, email.footer),
  });
  return NextResponse.json({ sent });
}
