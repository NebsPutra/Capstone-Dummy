import { createClient } from "@/lib/supabase/server";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pending join requests on events I organize
  const { data: pending } = await supabase
    .from("event_participants")
    .select("*, event:events!inner(title, id, creator_id), participant:profiles(nickname, full_name)")
    .eq("status", "pending")
    .eq("event.creator_id", user!.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-ink/60">Join requests for activities you organize.</p>
      </div>

      {(pending ?? []).length === 0 ? (
        <p className="text-sm text-ink/50">You&apos;re all caught up.</p>
      ) : (
        <div className="space-y-3">
          {pending!.map((p: any) => (
            <div key={p.id} className="card flex items-center justify-between p-4">
              <p className="text-sm">
                <span className="font-semibold">
                  {p.participant?.nickname || p.participant?.full_name}
                </span>{" "}
                requested to join <span className="font-semibold">{p.event.title}</span>
              </p>
              <a
                href={`/activities/${p.event.id}`}
                className="text-sm font-medium text-orange-dark"
              >
                Review →
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
