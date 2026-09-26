"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { PageHeader, fmtDateTime, useRpc } from "@/components/admin/ui";

interface Health {
  db_time: string; db_bytes: number | null; storage: Record<string, { files: number; bytes: number }> | null; buckets: string[] | null;
  emails_failed: number; emails_pending: number; errors_24h: number; recent_errors: { created_at: string; context: string; message: string }[]; auth_users: number;
}
type Level = "healthy" | "warning" | "error";
const mb = (b: number | null | undefined) => (b == null ? "—" : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function AdminHealthPage() {
  const { t, lang } = useLanguage();
  const { data: h, error, loading, reload } = useRpc<Health>("admin_system_health", {}, []);
  const [auth, setAuth] = useState<Level>("warning");
  const [storage, setStorage] = useState<Level>("warning");

  useEffect(() => {
    const sb = createClient();
    sb.auth.getSession().then(({ error: e }) => setAuth(e ? "error" : "healthy"));
    sb.storage.from("event-banners").list("", { limit: 1 }).then(({ error: e }) => setStorage(e ? "error" : "healthy"));
  }, [h]);

  const tiles: { label: string; level: Level; detail: string }[] = [
    { label: t("health.database"), level: error ? "error" : h ? "healthy" : "warning", detail: h ? `${t("health.dbSize")}: ${mb(h.db_bytes)}` : "" },
    { label: t("health.auth"), level: auth, detail: h ? `${h.auth_users} accounts` : "" },
    { label: t("health.storage"), level: h && (!h.buckets || h.buckets.length < 2) ? "error" : storage,
      detail: h?.buckets && h.buckets.length < 2 ? t("health.bucketsMissing") : Object.entries(h?.storage ?? {}).map(([b, s]) => `${b}: ${t("health.files", { n: s.files })}, ${mb(s.bytes)}`).join(" · ") },
    { label: t("health.email"), level: h ? (h.emails_failed ? "warning" : "healthy") : "warning", detail: h ? t("health.emails", { failed: h.emails_failed, pending: h.emails_pending }) : "" },
    { label: t("health.errors"), level: h ? (h.errors_24h > 10 ? "error" : h.errors_24h ? "warning" : "healthy") : "warning", detail: h ? String(h.errors_24h) : "" },
  ];
  const tone: Record<Level, string> = { healthy: "bg-green-500", warning: "bg-amber-500", error: "bg-red-500" };

  return (
    <div className="space-y-4">
      <PageHeader title={t("health.title")} subtitle={h ? t("health.checkedAt", { time: fmtDateTime(h.db_time, lang) }) : undefined}
        actions={<button onClick={reload} disabled={loading} className="rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-semibold">{t("health.recheck")}</button>} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {tiles.map((x) => (
          <div key={x.label} className="card space-y-1 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold"><span className={`h-2.5 w-2.5 rounded-full ${tone[x.level]}`} />{x.label}</p>
            <p className="text-xs font-medium">{t(`health.${x.level}`)}</p>
            <p className="text-xs text-ink/50">{x.detail}</p>
          </div>
        ))}
      </div>
      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">{t("health.recentErrors")}</h2>
        {!h?.recent_errors.length ? <p className="text-sm text-ink/50">{t("health.noErrors")}</p> : (
          <ul className="space-y-1 text-sm">
            {h.recent_errors.map((e, i) => (
              <li key={i}><time className="text-xs text-ink/40">{fmtDateTime(e.created_at, lang)}</time> <b>{e.context}</b>: {e.message}</li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
