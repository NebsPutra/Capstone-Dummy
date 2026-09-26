"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { Badge, Empty, PageHeader, fmtDateTime } from "@/components/admin/ui";
import { feedHref, useFeedText, type FeedItem } from "@/components/admin/AdminDashboard";

export default function AdminNotificationsPage() {
  const { t, lang } = useLanguage();
  const feedText = useFeedText();
  const [unseen, setUnseen] = useState(true);
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let q = createClient().from("admin_events").select("*").order("created_at", { ascending: false }).limit(200);
    if (unseen) q = q.is("acknowledged_at", null);
    q.then(({ data }) => setItems((data ?? []) as FeedItem[]));
  }, [unseen, tick]);

  async function ack(ids: number[]) {
    await createClient().from("admin_events").update({ acknowledged_at: new Date().toISOString() }).in("id", ids);
    setTick((n) => n + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("anotif.title")}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange" checked={unseen} onChange={(e) => setUnseen(e.target.checked)} />{t("anotif.unseen")}</label>
            {!!items?.length && <button onClick={() => ack(items.map((i) => i.id))} className="rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-semibold">{t("anotif.ackAll")}</button>}
          </>
        }
      />
      {!items ? <div className="skeleton h-64" /> : !items.length ? <Empty text={t("notif.caughtUp")} /> : (
        <ul className="space-y-2">
          {items.map((f) => (
            <li key={f.id} className="card flex items-center gap-3 p-3 text-sm">
              <Badge kind="severity" value={f.severity} label={t(`sev.${f.severity}` as "sev.info")} />
              <Link href={feedHref(f)} className="min-w-0 flex-1 truncate hover:text-orange-dark">{feedText(f)}</Link>
              <time className="shrink-0 text-xs text-ink/40">{fmtDateTime(f.created_at, lang)}</time>
              {!f.acknowledged_at && <button onClick={() => ack([f.id])} className="shrink-0 text-xs font-semibold text-orange-dark">{t("feed.acknowledge")}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
