"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarCheck, CalendarClock, CalendarX, ImageDown, MessageSquareWarning, Users, UserPlus, UserCheck, CalendarRange, Layers, UsersRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { pctChange, rangeFor, type DateRange } from "@/lib/admin";
import { Badge, KpiCard, PageHeader, RangePicker, fmtDateTime, useRpc } from "./ui";
import { ChartCard, LineTrend, exportNodePng, useChartColors } from "./charts";

export interface Kpis {
  total_users: number; new_users: number; new_users_prev: number; active_users: number; total_events: number;
  events_created: number; events_created_prev: number; upcoming_events: number; completed_events: number;
  cancelled_events: number; total_participants: number; joins: number; joins_prev: number; active_communities: number;
  open_complaints: number; critical_complaints: number; events_this_week: number; events_this_month: number;
}
export interface AlertItem { type: string; severity: string; entity: string; id?: string; params: Record<string, string | number> }
export interface FeedItem { id: number; type: string; severity: string; entity: string | null; entity_id: string | null; params: Record<string, string>; acknowledged_at: string | null; created_at: string }

export function alertHref(a: AlertItem) {
  if (a.entity === "event" && a.id) return `/admin/events/${a.id}`;
  if (a.entity === "complaint" && a.id) return `/admin/complaints/${a.id}`;
  if (a.entity === "complaint") return "/admin/complaints";
  return "/admin/health";
}
export function feedHref(f: FeedItem) {
  if (f.entity === "event" && f.entity_id) return `/admin/events/${f.entity_id}`;
  if (f.entity === "complaint" && f.entity_id) return `/admin/complaints/${f.entity_id}`;
  if (f.entity === "user" && f.entity_id) return `/admin/users/${f.entity_id}`;
  return "/admin/health";
}

export function useFeedText() {
  const { td } = useLanguage();
  return (f: { type: string; params: Record<string, string | number> }) =>
    td(`feed.${f.type}`, td("feed.other", "{type}").replace("{type}", f.type)).replace(/\{(\w+)\}/g, (_, k) => String(f.params[k] ?? ""));
}

export function AlertsList({ alerts }: { alerts: AlertItem[] | null }) {
  const { t, td } = useLanguage();
  if (!alerts) return <div className="skeleton h-24" />;
  if (alerts.length === 0) return <p className="text-sm text-ink/50">✅ {t("admin.noAlerts")}</p>;
  return (
    <ul className="space-y-2">
      {alerts.map((a, i) => (
        <li key={i}>
          <Link href={alertHref(a)} className="flex items-start gap-2.5 rounded-xl bg-cream-warm/60 px-3 py-2.5 text-sm hover:bg-cream-warm">
            <AlertTriangle size={16} className={a.severity === "critical" ? "mt-0.5 shrink-0 text-red-600" : "mt-0.5 shrink-0 text-amber-700"} />
            <span className="flex-1">{td(`alert.${a.type}`, a.type).replace(/\{(\w+)\}/g, (_, k) => String(a.params[k] ?? ""))}</span>
            <Badge value={a.severity} label={t(`sev.${a.severity}` as "sev.info")} kind="severity" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function AdminDashboard() {
  const { t, lang } = useLanguage();
  const colors = useChartColors();
  const ref = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState<DateRange>(rangeFor("30d"));
  const args = { p_from: range.from, p_to: range.to };
  const kpis = useRpc<Kpis>("admin_dashboard_kpis", args, [range.from, range.to]);
  const users = useRpc<{ growth: { t: string; new: number; total: number }[] }>("admin_user_analytics", args, [range.from, range.to]);
  const events = useRpc<{ created_series: { t: string; v: number }[]; participation_series: { t: string; v: number }[] }>("admin_event_analytics", args, [range.from, range.to]);
  const alerts = useRpc<AlertItem[]>("admin_alerts", {}, []);
  const feed = useRpc<FeedItem[]>("admin_activity_feed", { p_limit: 12 }, []);
  const feedText = useFeedText();
  const k = kpis.data;

  const trend = (events.data?.created_series ?? []).map((row, i) => ({
    t: row.t,
    created: row.v,
    joins: events.data?.participation_series[i]?.v ?? 0,
  }));

  return (
    <div ref={ref} className="space-y-6">
      <PageHeader
        title={t("admin.nav.dashboard")}
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <button
              onClick={async () => {
                if (!ref.current) return;
                await exportNodePng(ref.current, `dashboard-${range.key}`, colors.bg);
                await createClient().rpc("log_admin_action", { p_action: "dashboard_exported", p_meta: { range: range.key } });
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-cream-warm"
            >
              <ImageDown size={14} /> {t("admin.exportDashboard")}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        <KpiCard label={t("kpi.totalUsers")} value={k?.total_users} icon={<Users size={15} />} />
        <KpiCard label={t("kpi.activeUsers")} value={k?.active_users} icon={<UserCheck size={15} />} />
        <KpiCard label={t("kpi.newUsers")} value={k?.new_users} delta={k ? pctChange(k.new_users, k.new_users_prev) : null} icon={<UserPlus size={15} />} />
        <KpiCard label={t("kpi.totalEvents")} value={k?.total_events} delta={k ? pctChange(k.events_created, k.events_created_prev) : null} icon={<CalendarRange size={15} />} />
        <KpiCard label={t("kpi.upcomingEvents")} value={k?.upcoming_events} icon={<CalendarClock size={15} />} />
        <KpiCard label={t("kpi.completedEvents")} value={k?.completed_events} icon={<CalendarCheck size={15} />} />
        <KpiCard label={t("kpi.cancelledEvents")} value={k?.cancelled_events} icon={<CalendarX size={15} />} />
        <KpiCard label={t("kpi.totalParticipants")} value={k?.total_participants} delta={k ? pctChange(k.joins, k.joins_prev) : null} icon={<UsersRound size={15} />} />
        <KpiCard label={t("kpi.activeCommunities")} value={k?.active_communities} icon={<Layers size={15} />} />
        <KpiCard label={t("kpi.openComplaints")} value={k?.open_complaints} icon={<MessageSquareWarning size={15} />} />
        <KpiCard label={t("kpi.eventsThisWeek")} value={k?.events_this_week} />
        <KpiCard label={t("kpi.eventsThisMonth")} value={k?.events_this_month} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("chart.userGrowth")} loading={users.loading} total={users.data?.growth.at(-1)?.total}>
          <LineTrend data={users.data?.growth ?? []} lines={[{ key: "total", name: t("chart.total") }, { key: "new", name: t("chart.new") }]} />
        </ChartCard>
        <ChartCard title={t("chart.eventsCreated")} loading={events.loading} total={trend.reduce((s, r) => s + r.created + r.joins, 0)}>
          <LineTrend area data={trend} lines={[{ key: "created", name: t("chart.events") }, { key: "joins", name: t("chart.joins") }]} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("admin.alertsTitle")}</h2>
          <AlertsList alerts={alerts.data} />
        </section>
        <section className="card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("admin.activity")}</h2>
            <Link href="/admin/notifications" className="text-xs font-semibold text-orange-dark">
              {t("admin.viewAll")}
            </Link>
          </div>
          {!feed.data ? (
            <div className="skeleton h-24" />
          ) : feed.data.length === 0 ? (
            <p className="text-sm text-ink/50">{t("admin.noActivity")}</p>
          ) : (
            <ul className="divide-y divide-ink/5">
              {feed.data.map((f) => (
                <li key={f.id}>
                  <Link href={feedHref(f)} className="flex items-center gap-2 py-2 text-sm hover:text-orange-dark">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${f.severity === "critical" ? "bg-red-500" : f.severity === "warning" ? "bg-amber-500" : "bg-blue-400"}`}
                    />
                    <span className="min-w-0 flex-1 truncate">{feedText(f)}</span>
                    <time className="shrink-0 text-xs text-ink/40">{fmtDateTime(f.created_at, lang)}</time>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
