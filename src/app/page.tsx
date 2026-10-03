import { createClient } from "@supabase/supabase-js";
import { LandingPage } from "@/components/landing/LandingPage";
import { effectiveStatus } from "@/lib/events";
import { jakartaToday } from "@/lib/utils";
import { PUBLIC_EVENT_SELECT, type EventRecord } from "@/types";

// Fresh on every visit: the list depends on the clock (finished activities drop out).
export const dynamic = "force-dynamic";

/**
 * Landing page: upcoming public activities are loaded here on the server, so
 * they're in the first HTML (no pop-in, readable by search engines), with an
 * anonymous client: exactly what a logged-out visitor may see.
 */
export default async function Home() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("events")
    .select(PUBLIC_EVENT_SELECT)
    .eq("privacy", "public")
    .neq("status", "cancelled")
    .gte("event_date", jakartaToday())
    .order("event_date")
    .order("start_time")
    .limit(500);
  const upcoming = ((data ?? []) as unknown as EventRecord[]).filter((e) => effectiveStatus(e) !== "completed");
  return <LandingPage upcoming={upcoming} />;
}
