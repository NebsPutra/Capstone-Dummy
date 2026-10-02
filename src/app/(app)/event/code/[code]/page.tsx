import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { guestInviteRedirect, resolveInvite } from "@/lib/eventAccess";

/** Open an activity by event code (RUN-KEM-8F72) or share token (JOIN-7X82KD). */
export default async function EventByCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(await guestInviteRedirect(supabase, decodeURIComponent(code), `/event/code/${code}`));
  const event = await resolveInvite(supabase, decodeURIComponent(code));
  if (!event) notFound();
  // Carry the share token as the invite so private events stay joinable.
  redirect(`/activities/${event.id}?t=${encodeURIComponent(event.share_token)}`);
}
