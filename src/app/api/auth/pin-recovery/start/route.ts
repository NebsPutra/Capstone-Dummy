import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { maskEmail } from "@/lib/admin";

// Forgot PIN, step 1: email a 6-digit code to the account's verified address.
// Accepts an email or a username; only a masked address is returned.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: unknown };
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().slice(0, 254) : "";
  if (!identifier) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ reason: "unavailable" }, { status: 503 });

  const { data: email, error } = await admin.rpc("email_for_identifier", { p_identifier: identifier });
  if (error) {
    console.error("[komunitas] pin-recovery lookup:", error.message);
    return NextResponse.json({ reason: "error" }, { status: 500 });
  }
  if (!email) return NextResponse.json({ reason: "not_found" }, { status: 404 });

  const { error: otpError } = await createAnonClient().auth.signInWithOtp({
    email: email as string,
    options: { shouldCreateUser: false },
  });
  if (otpError) {
    console.error("[komunitas] pin-recovery send:", otpError.message);
    const limited = otpError.status === 429 || /rate limit|too many/i.test(otpError.message);
    return NextResponse.json({ reason: limited ? "rate_limited" : "send_failed" }, { status: limited ? 429 : 502 });
  }
  return NextResponse.json({ ok: true, masked: maskEmail(email as string) });
}
