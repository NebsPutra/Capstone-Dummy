import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: userCount }, { count: eventCount }, { count: reportedCount }] =
    await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("events").select("*", { count: "exact", head: true }),
      Promise.resolve({ count: 0 } as any), // reports table not yet modeled — see README
    ]);

  const { data: recentEvents } = await supabase
    .from("events")
    .select("*, category:categories(*), organizer:profiles!events_creator_id_fkey(*)")
    .order("created_at", { ascending: false })
    .limit(10);

  return (
    <div className="ambient-gradient min-h-screen p-6 md:p-10">
      <h1 className="text-2xl font-bold">📊 Admin Dashboard</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="👥 Users" value={userCount ?? 0} />
        <StatCard label="📅 Events" value={eventCount ?? 0} />
        <StatCard label="🚨 Reports" value={reportedCount ?? 0} />
      </div>

      <div className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-4 font-semibold">Recent events</h2>
        <table className="w-full min-w-[500px] text-left text-sm">
          <thead>
            <tr className="text-ink/40">
              <th className="pb-2 font-medium">Title</th>
              <th className="pb-2 font-medium">Category</th>
              <th className="pb-2 font-medium">Organizer</th>
              <th className="pb-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {(recentEvents ?? []).map((e: any) => (
              <tr key={e.id} className="border-t border-ink/5">
                <td className="py-2.5">{e.title}</td>
                <td className="py-2.5">{e.category?.label}</td>
                <td className="py-2.5">{e.organizer?.full_name ?? e.organizer?.username}</td>
                <td className="py-2.5 capitalize">{e.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
    </div>
  );
}
