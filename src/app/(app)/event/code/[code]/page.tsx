import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveInvite } from "@/lib/eventAccess";

/** Open an activity by event code (RUN-KEM-8F72) or share token (JOIN-7X82KD). */
export default async function EventByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const event = await resolveInvite(supabase, decodeURIComponent(code));
  if (!event) notFound();
  // Carry the share token as the invite so private events stay joinable.
  redirect(`/activities/${event.id}?t=${encodeURIComponent(event.share_token)}`);
}
