import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { effectiveStatus } from "@/lib/events";
import { ActivityForm } from "@/components/ActivityForm";
import type { EventRecord } from "@/types";

export default async function EditActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t } = await getServerT();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data }, { data: me }] = await Promise.all([
    supabase.from("events").select("*").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("role").eq("id", user!.id).single(),
  ]);
  const event = data as EventRecord | null;
  const isAdmin = me?.role === "admin" || me?.role === "super_admin";
  // Creator or admin (enforced again by RLS on UPDATE; admin edits are audited).
  if (!event || (event.creator_id !== user?.id && !isAdmin)) notFound();

  const status = effectiveStatus(event);
  const locked = status === "cancelled" || status === "completed" || status === "ongoing";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("edit.title")}</h1>
        <p className="mt-1 text-ink/60">{event.title}</p>
      </div>
      {locked ? (
        <div className="card space-y-3 p-6 text-sm">
          <p>{t("edit.locked")}</p>
          <Link href={`/activities/${event.id}`} className="font-semibold text-orange-dark">
            ← {t("common.back")}
          </Link>
        </div>
      ) : (
        <ActivityForm event={event} />
      )}
    </div>
  );
}
