import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import { STATUS_TONE, type Complaint, type ComplaintHistory, type ComplaintMessage } from "@/lib/admin";
import { ComplaintThread } from "@/components/help/ComplaintThread";

export default async function ComplaintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t } = await getServerT();

  const { data } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
  const complaint = data as Complaint | null;
  if (!complaint) notFound();

  const [{ data: messages }, { data: history }, { data: files }, { data: ev }] = await Promise.all([
    supabase.from("complaint_messages").select("*").eq("complaint_id", id).order("created_at"),
    supabase.from("complaint_status_history").select("*").eq("complaint_id", id).order("created_at"),
    supabase.from("complaint_attachments").select("id, file_name, storage_path").eq("complaint_id", id),
    complaint.related_event_id
      ? supabase.from("events").select("id, title").eq("id", complaint.related_event_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  // Private bucket: short-lived signed links, checked by storage RLS.
  const attachments = await Promise.all(
    (files ?? []).map(async (f: { id: string; file_name: string; storage_path: string }) => {
      const { data: signed } = await supabase.storage.from("complaint-attachments").createSignedUrl(f.storage_path, 600);
      return { id: f.id, file_name: f.file_name, url: signed?.signedUrl ?? null };
    })
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/help" className="text-sm font-medium text-orange-dark">
        {t("help.back")}
      </Link>
      <div className="card space-y-3 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-ink/50">
              {complaint.ref} · {t(`complaint.category.${complaint.category}`)} · {t(`complaint.severity.${complaint.severity}`)}
            </p>
            <h1 className="mt-1 text-xl font-bold">{complaint.subject}</h1>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[complaint.status]}`}>
            {t(`complaint.status.${complaint.status}`)}
          </span>
        </div>
        <p className="whitespace-pre-line text-sm text-ink/70">{complaint.description}</p>
        {ev && (
          <p className="text-sm">
            {t("help.relatedEvent")}:{" "}
            <Link href={`/activities/${ev.id}`} className="font-semibold text-orange-dark">
              {ev.title}
            </Link>
          </p>
        )}
      </div>
      <ComplaintThread
        complaintId={complaint.id}
        messages={(messages ?? []) as ComplaintMessage[]}
        history={(history ?? []) as ComplaintHistory[]}
        attachments={attachments}
        closed={complaint.status === "CLOSED" || complaint.status === "REJECTED"}
      />
    </div>
  );
}
