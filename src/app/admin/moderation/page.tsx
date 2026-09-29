"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/Toast";
import { Alert } from "@/components/ui";
import { PageHeader, fmtDateTime, useRpc } from "@/components/admin/ui";

interface CommentRow {
  id: string;
  body: string;
  status: "visible" | "hidden" | "deleted";
  created_at: string;
  report_count: number;
  open_reports: number;
  moderation_reason: string | null;
  reasons: { reason: string; details: string | null }[];
  event: { id: string; title: string; ref: string | null } | null;
  author: { id: string; username: string } | null;
}
interface MessageReportRow {
  message_id: string;
  reason: string;
  details: string | null;
  snapshot: string;
  created_at: string;
  resolved_at: string | null;
  resolution: string | null;
  sender: { id: string; username: string; account_status: string } | null;
  reporter: { id: string; username: string } | null;
  sender_open_reports: number;
}

export default function ModerationPage() {
  const { t } = useLanguage();
  const [tab, setTab] = useState<"comments" | "messages">("comments");
  return (
    <div className="space-y-5">
      <PageHeader title={t("amod.title")} subtitle={t("amod.subtitle")} />
      <div className="flex gap-2">
        {(["comments", "messages"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn("rounded-full px-4 py-2 text-sm font-semibold", tab === k ? "bg-orange-deep text-white shadow-soft" : "bg-surface text-ink/70 hover:bg-cream-warm")}
          >
            {t(`amod.tab.${k}`)}
          </button>
        ))}
      </div>
      {tab === "comments" ? <CommentQueue /> : <MessageReports />}
    </div>
  );
}

function CommentQueue() {
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const [filter, setFilter] = useState<"reported" | "hidden" | "all">("reported");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const { data, reload } = useRpc<{ total: number; rows: CommentRow[] }>(
    "admin_comments",
    { p_filter: filter, p_search: q || null, p_limit: 100, p_offset: 0 },
    [filter, q]
  );

  async function act(id: string, action: "dismiss" | "hide" | "unhide") {
    const { error } = await createClient().rpc("admin_resolve_comment", { p_comment: id, p_action: action });
    if (error) return toast(t(friendlyErrorKey(error, "admin_resolve_comment")), "error");
    toast(t("amod.done"));
    reload();
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(["reported", "hidden", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", filter === f ? "border-orange bg-orange/10 text-orange-dark" : "border-ink/10 text-ink/70")}
          >
            {t(`amod.filter.${f}`)}
          </button>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setQ(search.trim());
          }}
          className="ml-auto"
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("amod.search")}
            aria-label={t("amod.search")}
            className="rounded-lg border border-ink/10 bg-surface px-3 py-1.5 text-sm"
          />
        </form>
      </div>
      {!data ? (
        <div className="skeleton h-40" />
      ) : data.rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink/65">{t("amod.emptyComments")}</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map((c) => (
            <li key={c.id} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/65">
                {c.author && (
                  <Link href={`/admin/users/${c.author.id}`} className="font-semibold text-orange-dark">
                    @{c.author.username}
                  </Link>
                )}
                {c.event && (
                  <Link href={`/activities/${c.event.id}#comment-${c.id}`} className="hover:text-orange-dark">
                    {c.event.ref ? `${c.event.ref} · ` : ""}
                    {c.event.title}
                  </Link>
                )}
                <span>{fmtDateTime(c.created_at, lang)}</span>
                <span className={cn("rounded-full px-2 py-0.5 font-semibold", c.status === "visible" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600")}>
                  {t(`amod.status.${c.status}`)}
                </span>
                {c.open_reports > 0 && <span className="font-semibold text-red-600">{t("comments.reports", { n: c.open_reports })}</span>}
              </div>
              <p className="whitespace-pre-line break-words rounded-xl bg-cream-warm px-3 py-2">{c.body}</p>
              {c.reasons.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 text-xs">
                  {c.reasons.map((r, i) => (
                    <li key={i} className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">
                      {td(`comments.reason.${r.reason}`, r.reason)}
                      {r.details ? `: ${r.details}` : ""}
                    </li>
                  ))}
                </ul>
              )}
              {c.status !== "deleted" && (
                <div className="flex flex-wrap gap-2">
                  {c.open_reports > 0 && (
                    <button onClick={() => act(c.id, "dismiss")} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">
                      {t("amod.dismiss")}
                    </button>
                  )}
                  {c.status === "visible" ? (
                    <button onClick={() => act(c.id, "hide")} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                      {t("comments.hide")}
                    </button>
                  ) : (
                    <button onClick={() => act(c.id, "unhide")} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">
                      {t("comments.unhide")}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MessageReports() {
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const [filter, setFilter] = useState<"open" | "all">("open");
  const { data, reload } = useRpc<{ total: number; rows: MessageReportRow[] }>(
    "admin_message_reports",
    { p_filter: filter, p_limit: 100, p_offset: 0 },
    [filter]
  );

  async function act(id: string, action: "dismiss" | "remove") {
    if (action === "remove" && !window.confirm(t("amod.removeConfirm"))) return;
    const { error } = await createClient().rpc("admin_resolve_message_report", { p_message: id, p_action: action });
    if (error) return toast(t(friendlyErrorKey(error, "admin_resolve_message_report")), "error");
    toast(t("amod.done"));
    reload();
  }

  return (
    <div className="space-y-3">
      <Alert tone="info">{t("amod.privacyNote")}</Alert>
      <div className="flex gap-2">
        {(["open", "all"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn("rounded-full border px-3 py-1.5 text-xs font-semibold", filter === f ? "border-orange bg-orange/10 text-orange-dark" : "border-ink/10 text-ink/70")}
          >
            {t(`amod.filter.${f}`)}
          </button>
        ))}
      </div>
      {!data ? (
        <div className="skeleton h-40" />
      ) : data.rows.length === 0 ? (
        <p className="card p-6 text-center text-sm text-ink/65">{t("amod.emptyMessages")}</p>
      ) : (
        <ul className="space-y-3">
          {data.rows.map((r) => (
            <li key={`${r.message_id}-${r.reporter?.id}`} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/65">
                <span>
                  {t("amod.sender")}:{" "}
                  {r.sender && (
                    <Link href={`/admin/users/${r.sender.id}`} className="font-semibold text-orange-dark">
                      @{r.sender.username}
                    </Link>
                  )}
                  {r.sender && r.sender.account_status !== "active" && ` (${td(`account.status.${r.sender.account_status}`, r.sender.account_status)})`}
                </span>
                <span>
                  {t("amod.reporter")}: @{r.reporter?.username}
                </span>
                <span>{fmtDateTime(r.created_at, lang)}</span>
                <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">{td(`messages.reason.${r.reason}`, r.reason)}</span>
                {r.sender_open_reports > 1 && <span className="font-semibold text-red-600">{t("amod.senderReports", { n: r.sender_open_reports })}</span>}
                {r.resolved_at && <span className="font-semibold">{t(r.resolution === "remove" ? "amod.resolution.remove" : "amod.resolution.dismiss")}</span>}
              </div>
              <p className="whitespace-pre-line break-words rounded-xl bg-cream-warm px-3 py-2">{r.snapshot}</p>
              {r.details && <p className="text-xs text-ink/70">“{r.details}”</p>}
              {!r.resolved_at && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => act(r.message_id, "dismiss")} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">
                    {t("amod.dismiss")}
                  </button>
                  <button onClick={() => act(r.message_id, "remove")} className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">
                    {t("amod.removeMessage")}
                  </button>
                  {r.sender && (
                    <Link href={`/admin/users/${r.sender.id}`} className="rounded-full border border-ink/10 px-3 py-1.5 text-xs font-semibold">
                      {t("amod.reviewUser")}
                    </Link>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
