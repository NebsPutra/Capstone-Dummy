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

  const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  const event = data as EventRecord | null;
  // Only the creator may edit (also enforced by RLS on UPDATE).
  if (!event || event.creator_id !== user?.id) notFound();

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
