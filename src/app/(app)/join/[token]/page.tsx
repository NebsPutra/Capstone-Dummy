import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveInvite } from "@/lib/eventAccess";

/** Invite link / QR target: /join/JOIN-7X82KD. No distance or privacy filter on discovery. */
export default async function JoinByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const event = await resolveInvite(supabase, decodeURIComponent(token));
  if (!event) notFound();
  redirect(`/activities/${event.id}?t=${encodeURIComponent(event.share_token)}`);
}
