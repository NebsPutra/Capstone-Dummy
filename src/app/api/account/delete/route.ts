import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Self-service account deletion (data deletion request, UU PDP). Runs with the
// service role because the profile guard trigger stops members from changing
// their own username/status, and removing the login needs the admin API.
// Mirrors admin_anonymize_user() (migration 004) plus the user's own
// participations, notifications, PIN, banners and upcoming events.
// Every step is idempotent, so a retry after a partial failure is safe.
export const runtime = "nodejs";

const CONFIRM_WORDS = ["DELETE", "HAPUS"];

export async function POST(req: NextRequest) {
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (!CONFIRM_WORDS.includes((confirm ?? "").trim().toUpperCase())) {
    return NextResponse.json({ error: "bad_confirm" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "unavailable" }, { status: 503 });
  const uid = user.id;

  const { data: me } = await admin.from("profiles").select("role").eq("id", uid).maybeSingle();
  const role = (me as { role?: string } | null)?.role ?? "participant";

  // Never leave the platform without a super admin.
  if (role === "super_admin") {
    const { count } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "super_admin")
      .eq("account_status", "active")
      .neq("id", uid);
    if (!count) return NextResponse.json({ error: "last_super_admin" }, { status: 409 });
  }

  const fail = (step: string, err: unknown) => {
    console.error(`[komunitas] account delete (${step}):`, err);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  };

  // 1. Cancel upcoming activities they organize (kept for participants' history).
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const cancel = await admin
    .from("events")
    .update({ status: "cancelled" })
    .eq("creator_id", uid)
    .gte("event_date", today)
    .not("status", "in", "(completed,cancelled)");
  if (cancel.error) return fail("cancel events", cancel.error);

  // 2. Personal rows owned by the user.
  for (const table of ["event_participants", "user_interests", "notifications", "notification_prefs", "user_pins"]) {
    const { error } = await admin.from(table).delete().eq("user_id", uid);
    if (error) return fail(table, error);
  }

  // 3. Uploaded banners (stored under the user's id).
  const { data: files } = await admin.storage.from("event-banners").list(uid, { limit: 1000 });
  if (files?.length) {
    const { error } = await admin.storage.from("event-banners").remove(files.map((f) => `${uid}/${f.name}`));
    if (error) return fail("banners", error);
  }

  // 4. Strip the profile. The username change triggers the social cleanup
  //    (links, friends, blocks, privacy) from migration 006.
  const anon = await admin
    .from("profiles")
    .update({
      full_name: null, nickname: null, bio: null, whatsapp_number: null, gender: null, age: null,
      avatar_url: null, province_id: null, province: null, city_id: null, city: null,
      kecamatan_id: null, kecamatan: null, kelurahan_id: null, kelurahan: null,
      area_lat: null, area_lng: null, pin_set_at: null,
      username: `deleted_${uid.replace(/-/g, "").slice(0, 10)}`,
      account_status: "deactivated",
      status_reason: "self_deleted",
      status_changed_at: new Date().toISOString(),
    })
    .eq("id", uid);
  if (anon.error) return fail("profile", anon.error);

  await admin.from("audit_logs").insert({
    actor_id: uid,
    actor_role: role,
    action: "user_self_deleted",
    entity: "user",
    entity_id: uid,
  });

  // 5. Remove the login. A soft delete keeps the user id (so comments and
  //    messages keep a valid author) but obfuscates the email and identities.
  const del = await admin.auth.admin.deleteUser(uid, true);
  if (del.error) return fail("auth user", del.error);

  // The login no longer exists, so just clear this browser's session cookies.
  await supabase.auth.signOut({ scope: "local" });
  return NextResponse.json({ ok: true });
}
