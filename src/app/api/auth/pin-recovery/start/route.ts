import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient, createAnonClient } from "@/lib/supabase/admin";
import { clientHash } from "@/lib/request-meta";

// Forgot PIN, step 1: email a 6-digit code to the account's verified address.
// Accepts an email or a username. Always answers { ok: true } for any
// well-formed identifier so it can't be used to discover which accounts
// exist; the code is only actually sent when the account is real. A shared
// per-network throttle limits abuse.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { identifier?: unknown };
  const identifier = typeof body.identifier === "string" ? body.identifier.trim().slice(0, 254) : "";
  if (!identifier) return NextResponse.json({ reason: "invalid" }, { status: 400 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ reason: "unavailable" }, { status: 503 });

  // Per-network throttle (shared security_events counter).
  const { data: allowed } = await admin.rpc("rate_limit_recovery", { p_client: clientHash(req) });
  if (allowed === false) return NextResponse.json({ reason: "rate_limited" }, { status: 429 });

  const { data: email } = await admin.rpc("email_for_identifier", { p_identifier: identifier });
  // Only real accounts get a code; the response is the same either way so the
  // endpoint never reveals whether an account exists.
  if (email) {
    const { error: otpError } = await createAnonClient().auth.signInWithOtp({
      email: email as string,
      options: { shouldCreateUser: false },
    });
    if (otpError && (otpError.status === 429 || /rate limit|too many/i.test(otpError.message))) {
      return NextResponse.json({ reason: "rate_limited" }, { status: 429 });
    }
    if (otpError) console.error("[komunitas] pin-recovery send:", otpError.message);
  }
  return NextResponse.json({ ok: true });
}
