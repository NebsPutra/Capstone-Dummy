import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { LEGAL_DOCS, LEGAL_UPDATED } from "@/lib/legal/documents";
import { SITE_URL } from "@/lib/site";
import { jakartaToday } from "@/lib/utils";

// Rebuilt at most once an hour.
export const revalidate = 3600;

// Public pages: the site, legal pages, Explore and upcoming public activities
// (readable without an account, see migration 015). Profiles and the rest of
// the app need a sign-in.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Anonymous client, no cookies: exactly what a logged-out visitor can read.
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data } = await supabase
    .from("events")
    .select("id, created_at")
    .eq("privacy", "public")
    .neq("status", "cancelled")
    .gte("event_date", jakartaToday())
    .limit(1000);
  const activities = (data ?? []).map((e) => ({
    url: `${SITE_URL}/activities/${e.id}`,
    lastModified: e.created_at,
    changeFrequency: "daily" as const,
    priority: 0.5,
  }));

  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/explore`, changeFrequency: "daily", priority: 0.8 },
    ...activities,
    { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/register`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    ...LEGAL_DOCS.map((doc) => ({
      url: `${SITE_URL}/legal/${doc}`,
      lastModified: LEGAL_UPDATED,
      changeFrequency: "yearly" as const,
      priority: 0.2,
    })),
  ];
}
