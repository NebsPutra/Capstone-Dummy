import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Forgot PIN, step 2: verify the emailed code. This signs the user in with a
// fresh email-code session, which set_login_pin(..., p_recovery => true)
// requires (within 15 minutes) before it accepts a new PIN without the old one.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: unknown; code?: unknown };
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().slice(0, 254) : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!identifier || !/^\d{6}$/.test(code)) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ reason: "unavailable" }, { status: 503 });
  const { data: email } = await admin.rpc("email_for_identifier", { p_identifier: identifier });
  if (!email) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email: email as string, token: code, type: "email" });
  if (error || !data.user) {
    const limited = error?.status === 429 || /rate limit|too many/i.test(error?.message ?? "");
    const expired = error?.code === "otp_expired" && !/invalid/i.test(error.message);
    return NextResponse.json({ reason: limited ? "rate_limited" : expired ? "expired" : "incorrect" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
