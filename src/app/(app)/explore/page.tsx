import { createClient } from "@/lib/supabase/server";
import { ExplorePage } from "@/components/ExplorePage";
import { EXPLORE_PAGE_SIZE } from "@/lib/events";
import { jakartaToday } from "@/lib/utils";
import { PUBLIC_EVENT_SELECT, type Category, type EventRecord } from "@/types";

/**
 * Explore: the first page of public activities (no filters, same query as the
 * client's default) and the categories are loaded here, so they're in the
 * first HTML instead of appearing after a second request.
 */
export default async function Explore() {
  const supabase = await createClient();
  const [{ data: events }, { data: categories }] = await Promise.all([
    supabase
      .from("events")
      .select(PUBLIC_EVENT_SELECT)
      .eq("privacy", "public")
      .neq("status", "cancelled")
      .gte("event_date", jakartaToday())
      .order("event_date", { ascending: true })
      .order("start_time", { ascending: true })
      .range(0, EXPLORE_PAGE_SIZE - 1),
    supabase.from("categories").select("*").neq("is_active", false).order("sort_order"),
  ]);
  return (
    <ExplorePage
      initial={(events ?? []) as unknown as EventRecord[]}
      initialCategories={(categories ?? []) as Category[]}
    />
  );
}
