"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type FriendsGoing = { count: number; names: string[] };

/**
 * Friends going to each of these activities, in one request (friends_going(),
 * migration 027). Empty for logged-out visitors (the call is refused).
 */
export function useFriendsGoing(eventIds: string[]): Record<string, FriendsGoing> {
  const supabase = useMemo(() => createClient(), []);
  const key = eventIds.join(",");
  const [map, setMap] = useState<Record<string, FriendsGoing>>({});
  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    supabase.rpc("friends_going", { p_events: key.split(",") }).then(({ data }) => {
      if (!cancelled && data) setMap(data as Record<string, FriendsGoing>);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, key]);
  return map;
}
