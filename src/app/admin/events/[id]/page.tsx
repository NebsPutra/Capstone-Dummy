"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyErrorKey } from "@/lib/errors";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { effectiveStatus } from "@/lib/events";
import { formatDate, formatFee, formatTimeRange } from "@/lib/utils";
import type { EventRecord } from "@/types";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { EventCover } from "@/components/EventCover";
import { PageHeader, fmtDateTime } from "@/components/admin/ui";

interface Part { id: string; status: string; joined_at: string; user_id: string; participant: { username: string; full_name: string | null } | null }
interface Audit { id: number; action: string; created_at: string; old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; actor_id: string | null }

export default function AdminEventDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t, td, lang } = useLanguage();
  const toast = useToast();
  const sb = createClient();
  const [ev, setEv] = useState<(EventRecord & { ref: string }) | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ id: string; username: string; display_name: string; email: string }[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: e }, { data: p }, { data: a }] = await Promise.all([
        sb.from("events").select("*, category:categories(*), organizer:profiles!events_creator_id_fkey(id, username, full_name, nickname)").eq("id", id).maybeSingle(),
        sb.from("event_participants").select("id, status, joined_at, user_id, participant:profiles!event_participants_user_id_fkey(username, full_name)").eq("event_id", id).order("joined_at"),
        sb.from("audit_logs").select("*").eq("entity", "event").eq("entity_id", id).order("created_at", { ascending: false }).limit(50),
      ]);
      setEv(e as never);
      setParts((p ?? []) as unknown as Part[]);
      setAudit((a ?? []) as Audit[]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tick]);

  useEffect(() => {
    if (q.trim().length < 2) return setHits([]);
    const h = setTimeout(async () => {
      const { data } = await sb.rpc("admin_list_users", { p_search: q, p_limit: 6 });
      setHits((data as { rows: typeof hits })?.rows ?? []);
    }, 300);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function act(fn: () => PromiseLike<{ error: unknown }>, ok: TranslationKey) {
    const { error } = await fn();
    if (error) return toast(t(friendlyErrorKey(error as { message?: string }, ok)), "error");
    toast(t(ok));
    setTick((n) => n + 1);
  }

  if (!ev) return <div className="skeleton h-96" />;
  const status = effectiveStatus(ev);
  return (
    <div className="space-y-6">
      <PageHeader
        title={ev.title}
        subtitle={`${ev.ref} · ${ev.event_code}`}
        actions={
          <>
            <StatusBadge status={status} />
            <Link href={`/activities/${ev.id}`} className="rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-semibold">{t("common.view")}</Link>
            <Link href={`/activities/${ev.id}/edit`} className="rounded-full bg-orange px-3 py-1.5 text-xs font-semibold text-white">{t("common.edit")}</Link>
            {ev.status === "cancelled" ? (
              <button onClick={() => window.confirm(t("aevents.restoreConfirm")) && act(() => sb.rpc("admin_restore_event", { p_event: ev.id }), "aevents.restored")}
                className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white">{t("aevents.restore")}</button>
            ) : (
              <button onClick={() => window.confirm(t("event.cancelConfirm")) && act(() => sb.rpc("cancel_event", { p_event_id: ev.id }), "event.cancelled")}
                className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600">{t("event.cancelEvent")}</button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card overflow-hidden lg:col-span-2">
          <EventCover bannerUrl={ev.banner_url} categoryKey={ev.category?.key} emoji={ev.category?.emoji} title={ev.title} className="aspect-[16/6]" />
          <div className="grid grid-cols-2 gap-3 p-5 text-sm sm:grid-cols-3">
            <p><span className="block text-xs text-ink/40">{t("event.date")}</span>{formatDate(ev.event_date, lang)}</p>
            <p><span className="block text-xs text-ink/40">{t("event.time")}</span>{formatTimeRange(ev.start_time, ev.end_time)}</p>
            <p><span className="block text-xs text-ink/40">{t("event.fee")}</span>{formatFee(ev.fee, lang)}</p>
            <p><span className="block text-xs text-ink/40">{t("event.participants")}</span>{ev.participant_count}/{ev.max_participants}</p>
            <p><span className="block text-xs text-ink/40">{t("col.category")}</span>{ev.category ? td(`category.${ev.category.key}`, ev.category.label) : "—"}</p>
            <p><span className="block text-xs text-ink/40">{t("col.organizer")}</span>
              {ev.organizer ? <Link className="text-orange-dark" href={`/admin/users/${ev.organizer.id}`}>@{ev.organizer.username}</Link> : "—"}</p>
            <p className="col-span-full"><span className="block text-xs text-ink/40">{t("event.location")}</span>{ev.location_name} ({ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)})</p>
          </div>
        </section>

        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">{t("event.participants")}</h2>
          <div className="relative">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("aevents.addPlaceholder")}
              className="w-full rounded-full border border-ink/10 bg-surface px-3 py-2 text-sm outline-none focus:border-orange" />
            {hits.length > 0 && (
              <ul className="absolute inset-x-0 top-full z-10 mt-1 rounded-xl border border-ink/10 bg-surface py-1 shadow-lg">
                {hits.map((h) => (
                  <li key={h.id}>
                    <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-cream-warm"
                      onClick={() => { setQ(""); act(() => sb.rpc("admin_add_participant", { p_event: ev.id, p_user: h.id }), "aevents.added"); }}>
                      {h.display_name} <span className="text-xs text-ink/40">{h.email}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <ul className="max-h-80 space-y-1 overflow-auto text-sm">
            {parts.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-cream-warm/60 px-3 py-1.5">
                <Link href={`/admin/users/${p.user_id}`} className="truncate hover:text-orange-dark">{p.participant?.full_name ?? p.participant?.username}</Link>
                <span className="flex shrink-0 items-center gap-2 text-xs">
                  {td(`participation.${p.status}`, p.status)}
                  {p.status === "pending" && (
                    <button className="font-semibold text-green-700" onClick={() => act(() => sb.rpc("set_participant_status", { p_participant_id: p.id, p_status: "approved" }), "event.approved")}>✓</button>
                  )}
                  <button className="font-semibold text-red-600" title={t("event.remove")}
                    onClick={() => window.confirm(t("event.removeConfirm", { name: p.participant?.username ?? "" })) && act(() => sb.rpc("remove_participant", { p_participant_id: p.id }), "event.removed")}>✕</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">{t("aevents.history")}</h2>
        {audit.length === 0 ? <p className="text-sm text-ink/50">—</p> : (
          <ul className="space-y-1.5 text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-2">
                <time className="text-xs text-ink/40">{fmtDateTime(a.created_at, lang)}</time>
                <span className="font-medium">{a.action}</span>
                {a.new_value && <code className="break-all text-xs text-ink/50">{JSON.stringify(a.old_value)} → {JSON.stringify(a.new_value)}</code>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
