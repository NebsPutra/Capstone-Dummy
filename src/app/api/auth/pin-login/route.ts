import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientHash, requestDevice } from "@/lib/request-meta";
import { postLoginPath } from "@/lib/onboarding";
import { sendMail, simpleEmailHtml } from "@/lib/mailer";
import { getServerT } from "@/lib/i18n/server";

// Sign in with email/username + 6-digit PIN.
//
// The PIN is checked in the database by verify_login_pin() (bcrypt compare,
// lockout, per-network throttle), which only the service role may call.
// On success the server mints the Supabase session itself: it generates a
// one-time magic-link token for the account (no email is sent) and redeems
// it on the cookie-bound client, so the browser receives a normal session.
// The PIN is never logged, stored or returned.
export const runtime = "nodejs";

interface VerifyResult {
  ok: boolean;
  reason?: "invalid" | "no_pin" | "locked" | "rate_limited" | "suspended";
  remaining?: number;
  until?: string;
  email?: string;
  just_locked?: boolean;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: unknown; pin?: unknown; next?: unknown };
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().slice(0, 254) : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (!identifier || !/^\d{6}$/.test(pin)) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) {
    console.error("[komunitas] pin-login: SUPABASE_SERVICE_ROLE_KEY is not configured");
    return NextResponse.json({ reason: "unavailable" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("verify_login_pin", {
    p_identifier: identifier,
    p_pin: pin,
    p_client: clientHash(req),
    p_device: requestDevice(req),
  });
  if (error || !data) {
    console.error("[komunitas] pin-login verify:", error?.message);
    return NextResponse.json({ reason: "error" }, { status: 500 });
  }
  const r = data as VerifyResult;

  if (!r.ok) {
    if (r.reason === "locked" && r.just_locked && r.email) {
      const { t } = await getServerT();
      const until = new Date(r.until!).toLocaleString("id-ID", { timeZone: "Asia/Jakarta", dateStyle: "medium", timeStyle: "short" });
      const heading = t("email.pinLocked.title");
      const paras = [t("email.pinLocked.body", { until: `${until} WIB` }), t("email.pinLocked.notYou")];
      const footer = t("email.footer", { url: `${req.nextUrl.origin}/legal/privacy` });
      await sendMail({
        to: r.email,
        subject: heading,
        text: [...paras, footer].join("\n\n"),
        html: simpleEmailHtml(heading, paras, { label: t("email.pinLocked.action"), href: `${req.nextUrl.origin}/forgot-pin` }, footer),
      });
    }
    const status = r.reason === "rate_limited" ? 429 : r.reason === "locked" ? 423 : 401;
    return NextResponse.json({ reason: r.reason, remaining: r.remaining, until: r.until }, { status });
  }

  const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: r.email! });
  if (linkError || !link?.properties?.hashed_token) {
    console.error("[komunitas] pin-login generateLink:", linkError?.message);
    return NextResponse.json({ reason: "error" }, { status: 500 });
  }

  const supabase = await createClient();
  const { data: session, error: sessionError } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: "magiclink",
  });
  if (sessionError || !session.user) {
    console.error("[komunitas] pin-login session:", sessionError?.message);
    return NextResponse.json({ reason: "error" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("my_profile")
    .select("role, onboarding_completed_at, full_name, nickname, whatsapp_number, gender, city_id, kecamatan_id, kelurahan_id, bio")
    .eq("id", session.user.id)
    .maybeSingle();

  return NextResponse.json({ ok: true, next: postLoginPath(profile, typeof body.next === "string" ? body.next : null) });
}
