"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { COMPLAINT_STATUSES, type ComplaintHistory, type ComplaintMessage } from "@/lib/admin";
import { cn } from "@/lib/utils";
import { useToast } from "../Toast";
import { Alert, PrimaryButton, inputClass } from "../ui";
import { FilePicker, uploadComplaintFiles } from "./ComplaintForm";

export interface AttachmentLink {
  id: string;
  file_name: string;
  url: string | null;
}

function fmt(ts: string, lang: string) {
  return new Date(ts).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Timeline + conversation. Users see public messages only (internal notes
 * are filtered by RLS). Staff additionally get the internal-note toggle and
 * can change the status while replying.
 */
export function ComplaintThread({
  complaintId,
  messages,
  history,
  attachments,
  closed,
  staff = false,
  authorNames = {},
}: {
  complaintId: string;
  messages: ComplaintMessage[];
  history: ComplaintHistory[];
  attachments: AttachmentLink[];
  closed: boolean;
  staff?: boolean;
  authorNames?: Record<string, string>;
}) {
  const router = useRouter();
  const toast = useToast();
  const { t, lang } = useLanguage();
  const busy = useRef(false);
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [sending, setSending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (busy.current || !body.trim()) return;
    busy.current = true;
    setSending(true);
    setError(null);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("add_complaint_message", {
      p_complaint: complaintId,
      p_body: body.trim(),
      p_internal: staff && internal,
      p_new_status: staff && !internal && newStatus ? newStatus : null,
    });
    if (!rpcError && files.length) await uploadComplaintFiles(complaintId, files, data as string);
    busy.current = false;
    setSending(false);
    if (rpcError) return setError(friendlyErrorKey(rpcError, "add_complaint_message"));
    setBody("");
    setFiles([]);
    setNewStatus("");
    toast(staff ? (internal ? t("acomp.noteSaved") : t("acomp.replied")) : t("help.sent"));
    router.refresh();
  }

  const timelineText = (h: ComplaintHistory) =>
    h.kind === "submitted"
      ? t("timeline.submitted")
      : h.kind === "assigned"
      ? t("timeline.assigned")
      : h.kind === "severity"
      ? t("timeline.severity", { to: t(`complaint.severity.${h.to_value as "LOW"}`) })
      : t("timeline.status", { to: t(`complaint.status.${h.to_value as "OPEN"}`) });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
      <section className="card space-y-4 p-5">
        <h2 className="font-semibold">{t("help.thread")}</h2>
        {messages.length === 0 ? (
          <p className="text-sm text-ink/50">{t("help.noMessages")}</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li
                key={m.id}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm",
                  m.is_internal
                    ? "border border-dashed border-amber-400/60 bg-amber-50"
                    : m.from_staff
                    ? "bg-orange/10"
                    : "bg-cream-warm"
                )}
              >
                <div className="mb-1 flex items-center justify-between gap-2 text-xs text-ink/50">
                  <span className="flex items-center gap-1 font-semibold">
                    {m.is_internal && <Lock size={12} />}
                    {m.from_staff
                      ? staff
                        ? authorNames[m.author_id ?? ""] ?? t("help.team")
                        : t("help.team")
                      : staff
                      ? authorNames[m.author_id ?? ""] ?? t("acomp.reporter")
                      : t("help.you")}
                    {m.is_internal && ` · ${t("acomp.internal")}`}
                  </span>
                  <time>{fmt(m.created_at, lang)}</time>
                </div>
                <p className="whitespace-pre-line">{m.body}</p>
              </li>
            ))}
          </ul>
        )}

        {closed && !staff ? (
          <Alert tone="info">{t("help.closedNote")}</Alert>
        ) : (
          <form onSubmit={send} className="space-y-3 border-t border-ink/5 pt-4">
            {staff && (
              <div className="flex flex-wrap gap-2 text-sm">
                {[false, true].map((isNote) => (
                  <button
                    key={String(isNote)}
                    type="button"
                    onClick={() => setInternal(isNote)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 font-medium",
                      internal === isNote ? "border-orange bg-orange text-white" : "border-ink/10"
                    )}
                  >
                    {isNote ? t("acomp.internalNote") : t("acomp.reply")}
                  </button>
                ))}
              </div>
            )}
            <textarea
              rows={3}
              value={body}
              maxLength={5000}
              onChange={(e) => setBody(e.target.value)}
              placeholder={staff ? (internal ? t("acomp.notePlaceholder") : t("acomp.replyPlaceholder")) : t("help.replyPlaceholder")}
              className={inputClass()}
            />
            {staff && !internal && (
              <label className="flex flex-wrap items-center gap-2 text-sm">
                <span>{t("acomp.alsoSetStatus")}</span>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="rounded-lg border border-ink/10 bg-surface px-2 py-1.5">
                  <option value="">{t("acomp.keepStatus")}</option>
                  {COMPLAINT_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {t(`complaint.status.${s}`)}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!internal && <FilePicker files={files} onChange={(f) => setFiles(f)} />}
            {error && <Alert>{t(error)}</Alert>}
            <PrimaryButton type="submit" disabled={!body.trim()} loading={sending} loadingText={t("help.sending")}>
              {t("help.send")}
            </PrimaryButton>
          </form>
        )}
      </section>

      <aside className="space-y-4">
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">{t("help.timeline")}</h2>
          <ol className="space-y-3 border-l-2 border-orange/30 pl-4">
            {history.map((h) => (
              <li key={h.id} className="relative text-sm">
                <span className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full bg-orange" />
                <p>{timelineText(h)}</p>
                <time className="text-xs text-ink/50">{fmt(h.created_at, lang)}</time>
              </li>
            ))}
          </ol>
        </section>
        {attachments.length > 0 && (
          <section className="card space-y-2 p-5">
            <h2 className="text-sm font-semibold">{t("help.attachmentsTitle")}</h2>
            <ul className="space-y-1 text-sm">
              {attachments.map((a) => (
                <li key={a.id}>
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="break-all font-medium text-orange-dark">
                      {a.file_name}
                    </a>
                  ) : (
                    <span className="text-ink/50">{a.file_name}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
