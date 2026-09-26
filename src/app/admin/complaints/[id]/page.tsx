import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getServerT } from "@/lib/i18n/server";
import type { Complaint, ComplaintHistory, ComplaintMessage } from "@/lib/admin";
import { ComplaintThread } from "@/components/help/ComplaintThread";
import { ComplaintAdminPanel } from "@/components/admin/ComplaintAdminPanel";

export default async function AdminComplaintDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { t } = await getServerT();
  const { data } = await supabase.from("complaints").select("*").eq("id", id).maybeSingle();
  const c = data as Complaint | null;
  if (!c) notFound();

  const [{ data: messages }, { data: history }, { data: files }, { data: payload }, { data: staff }] = await Promise.all([
    supabase.from("complaint_messages").select("*").eq("complaint_id", id).order("created_at"),
    supabase.from("complaint_status_history").select("*").eq("complaint_id", id).order("created_at"),
    supabase.from("complaint_attachments").select("id, file_name, storage_path").eq("complaint_id", id),
    supabase.rpc("complaint_email_payload", { p_complaint: id }),
    supabase.from("profiles").select("id, username, full_name").in("role", ["moderator", "admin", "super_admin"]),
  ]);
  const attachments = await Promise.all(
    (files ?? []).map(async (f: { id: string; file_name: string; storage_path: string }) => {
      const { data: s } = await supabase.storage.from("complaint-attachments").createSignedUrl(f.storage_path, 600);
      return { id: f.id, file_name: f.file_name, url: s?.signedUrl ?? null };
    })
  );
  const p = payload as { reporter: { name: string; username: string; email: string } | null; event: { id: string; ref: string; title: string } | null; related_user: { username: string } | null } | null;
  const names: Record<string, string> = Object.fromEntries((staff ?? []).map((s: { id: string; username: string; full_name: string | null }) => [s.id, s.full_name ?? `@${s.username}`]));
  if (c.reporter_id && p?.reporter) names[c.reporter_id] = p.reporter.name;

  return (
    <div className="space-y-6">
      <Link href="/admin/complaints" className="text-sm font-medium text-orange-dark">← {t("acomp.title")}</Link>
      <div className="card space-y-3 p-6">
        <p className="text-xs font-semibold text-ink/50">{c.ref} · {t(`complaint.category.${c.category}`)}</p>
        <h1 className="text-xl font-bold">{c.subject}</h1>
        <p className="whitespace-pre-line text-sm text-ink/70">{c.description}</p>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p>{t("acomp.reporter")}: {c.is_anonymous && !p?.reporter ? t("acomp.anonymous") : p?.reporter ? `${p.reporter.name} (@${p.reporter.username}, ${p.reporter.email})` : "—"}{c.is_anonymous && ` · ${t("acomp.anonymous")}`}</p>
          <p>{t("acomp.contact")}: {c.contact ?? "—"}</p>
          <p>{t("help.relatedEvent")}: {p?.event ? <Link className="text-orange-dark" href={`/admin/events/${p.event.id}`}>{p.event.ref} · {p.event.title}</Link> : "—"}</p>
          <p>{t("help.relatedUser")}: {p?.related_user ? `@${p.related_user.username}` : "—"}</p>
        </div>
      </div>
      <ComplaintAdminPanel complaint={c} staff={(staff ?? []) as { id: string; username: string; full_name: string | null }[]} />
      <ComplaintThread
        complaintId={c.id}
        messages={(messages ?? []) as ComplaintMessage[]}
        history={(history ?? []) as ComplaintHistory[]}
        attachments={attachments}
        closed={false}
        staff
        authorNames={names}
      />
    </div>
  );
}
