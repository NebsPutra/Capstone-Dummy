"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { cn } from "@/lib/utils";

export interface NotificationRow {
  id: string;
  type: string;
  params: Record<string, string>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

/** In-app notifications (complaint updates, join decisions, cancellations). */
export function NotificationFeed({ items }: { items: NotificationRow[] }) {
  const router = useRouter();
  const { t, td, lang } = useLanguage();
  const [busy, setBusy] = useState(false);
  const unread = items.filter((n) => !n.read_at).length;

  function text(n: NotificationRow) {
    const p = { ...n.params };
    if (n.type === "complaint_status" && p.status) p.status = td(`complaint.status.${p.status}`, p.status);
    if (n.type === "account_status" && p.status) p.status = td(`account.status.${p.status}`, p.status);
    return td(`notifType.${n.type}`, n.type).replace(/\{(\w+)\}/g, (_, k) => p[k] ?? "");
  }

  async function markAll() {
    if (busy) return;
    setBusy(true);
    await createClient().rpc("mark_notifications_read", { p_ids: null });
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {t("notif.feed")}
          {unread > 0 && <span className="ml-2 rounded-full bg-orange px-2 py-0.5 text-xs text-white">{t("notif.unread", { n: unread })}</span>}
        </h2>
        {unread > 0 && (
          <button onClick={markAll} disabled={busy} className="text-sm font-medium text-orange-dark disabled:opacity-50">
            {t("notif.markAllRead")}
          </button>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink/50">{t("notif.noUpdates")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const content = (
              <div className={cn("card flex items-start gap-3 p-4 text-sm transition", n.link && "hover:-translate-y-0.5 hover:shadow-lift")}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read_at ? "bg-ink/15" : "bg-orange")} />
                <div className="min-w-0 flex-1">
                  <p className={n.read_at ? "text-ink/70" : "font-medium"}>{text(n)}</p>
                  <time className="text-xs text-ink/40">
                    {new Date(n.created_at).toLocaleString(lang === "id" ? "id-ID" : "en-US", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link}>{content}</Link> : content}</li>;
          })}
        </ul>
      )}
    </section>
  );
}
