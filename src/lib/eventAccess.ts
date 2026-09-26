import type { createClient } from "@/lib/supabase/server";
import type { EventRecord } from "@/types";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const EVENT_DETAIL_SELECT =
  "*, category:categories(*), organizer:profiles!events_creator_id_fkey(id, nickname, full_name, username)";

/**
 * Resolve an event for the current viewer.
 *  1. Normal access (RLS): public events, own events, events you joined.
 *  2. Invite access: a share token / event code opens any event — including
 *     private and far-away ones — via the get_event_by_token() function.
 * An invite only bypasses *discovery*; joining still goes through
 * join_event(), which enforces privacy, capacity and approval.
 */
export async function getEventForViewer(
  supabase: ServerClient,
  id: string,
  token?: string | null
): Promise<{ event: EventRecord; viaInvite: boolean } | null> {
  const { data } = await supabase.from("events").select(EVENT_DETAIL_SELECT).eq("id", id).maybeSingle();
  if (data) return { event: data as EventRecord, viaInvite: false };

  if (token) {
    const invited = await resolveInvite(supabase, token);
    if (invited && invited.id === id) return { event: invited, viaInvite: true };
  }
  return null;
}

export async function resolveInvite(supabase: ServerClient, token: string): Promise<EventRecord | null> {
  const { data, error } = await supabase
    .rpc("get_event_by_token", { token: token.trim().toUpperCase() })
    .select(EVENT_DETAIL_SELECT)
    .maybeSingle();
  if (error) {
    console.error("[komunitas] get_event_by_token:", error);
    return null;
  }
  return (data as EventRecord | null) ?? null;
}
