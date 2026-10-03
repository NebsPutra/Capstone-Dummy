import { createClient } from "@supabase/supabase-js";
import { icsCalendar } from "@/lib/calendar";
import { SITE_URL } from "@/lib/site";

/**
 * Personal calendar feed: /api/calendar/<token>.ics (subscribe in Google or
 * Apple Calendar). Calendar apps can't sign in, so the secret token is the key;
 * calendar_feed() (migration 027) only returns that person's activities.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const token = (await params).token.replace(/\.ics$/i, "");
  if (!/^[0-9a-f]{32,}$/.test(token)) return new Response("Not found", { status: 404 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await supabase.rpc("calendar_feed", { p_token: token });
  if (error) return new Response("Calendar unavailable", { status: 500 });
  const rows = (data ?? []) as {
    id: string;
    title: string;
    description: string | null;
    location_name: string;
    address: string | null;
    event_date: string;
    start_time: string;
    end_time: string;
    cancelled: boolean;
  }[];
  // An unknown or reset token simply gives an empty calendar.
  const body = icsCalendar(
    rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      location: [r.location_name, r.address].filter(Boolean).join(", "),
      date: r.event_date,
      start: r.start_time,
      end: r.end_time,
      url: `${SITE_URL}/activities/${r.id}`,
      cancelled: r.cancelled,
    })),
    "Komunitas"
  );
  return new Response(body, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="komunitas.ics"',
      "Cache-Control": "private, max-age=900",
    },
  });
}

