import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { effectiveStatus } from "@/lib/events";
import { formatFee } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { AdminCancelButton } from "@/components/AdminCancelButton";
import type { EventRecord } from "@/types";

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { t, td, lang } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/dashboard");

  const [{ count: userCount }, { count: eventCount }, { data: recentEvents }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("events").select("id", { count: "exact", head: true }),
    supabase
      .from("events")
      .select("*, category:categories(*), organizer:profiles!events_creator_id_fkey(full_name, nickname, username)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Admins see public events plus their own; other users' private events
  // stay hidden by RLS (reports / private-event moderation aren't modeled yet).
  const events = (recentEvents ?? []) as EventRecord[];

  return (
    <div className="ambient-gradient min-h-screen p-6 md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">📊 {t("admin.title")}</h1>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
          <Link href="/dashboard" className="text-sm font-medium text-orange-dark">
            {t("admin.backToApp")}
          </Link>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={`👥 ${t("admin.users")}`} value={userCount ?? 0} />
        <StatCard label={`📅 ${t("admin.events")}`} value={eventCount ?? 0} />
        <StatCard label={`🚨 ${t("admin.reports")}`} value="—" note={t("admin.reportsNote")} />
      </div>

      <div className="card mt-8 overflow-x-auto p-5">
        <h2 className="mb-4 font-semibold">{t("admin.recent")}</h2>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-ink/40">
              <th className="pb-2 font-medium">{t("admin.colTitle")}</th>
              <th className="pb-2 font-medium">{t("admin.colCategory")}</th>
              <th className="pb-2 font-medium">{t("admin.colOrganizer")}</th>
              <th className="pb-2 font-medium">{t("admin.colFee")}</th>
              <th className="pb-2 font-medium">{t("admin.colStatus")}</th>
              <th className="pb-2 font-medium">{t("admin.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => {
              const status = effectiveStatus(e);
              return (
                <tr key={e.id} className="border-t border-ink/5">
                  <td className="py-2.5">
                    <Link href={`/activities/${e.id}`} className="font-medium hover:text-orange-dark">
                      {e.title}
                    </Link>
                  </td>
                  <td className="py-2.5">{e.category ? td(`category.${e.category.key}`, e.category.label) : "—"}</td>
                  <td className="py-2.5">
                    {e.organizer?.full_name ?? e.organizer?.nickname ?? e.organizer?.username ?? "—"}
                  </td>
                  <td className="py-2.5">{formatFee(e.fee, lang)}</td>
                  <td className="py-2.5">
                    <StatusBadge status={status} />
                  </td>
                  <td className="py-2.5">
                    {status !== "cancelled" && status !== "completed" && <AdminCancelButton eventId={e.id} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, note }: { label: string; value: number | string; note?: string }) {
  return (
    <div className="card p-5">
      <p className="text-sm text-ink/50">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note && <p className="mt-1 text-xs text-ink/40">{note}</p>}
    </div>
  );
}
