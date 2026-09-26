"use client";

import { useEffect, useRef, useState } from "react";
import { ImageDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { rangeFor, type DateRange } from "@/lib/admin";
import { formatRupiah } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { KpiCard, PageHeader, RangePicker, Select, useRpc } from "./ui";
import { Bars, ChartCard, Donut, Heatmap, LineTrend, exportNodePng, useChartColors } from "./charts";

type Labeled = { key?: string; label?: string; emoji?: string; v: number };
export interface UserAnalytics {
  unit: string; growth: { t: string; new: number; total: number }[]; total: number; onboarded: number; active: number; inactive: number;
  retained: number; retention_base: number; by_city: Labeled[]; by_kecamatan: Labeled[]; by_kelurahan: Labeled[];
  by_gender: Labeled[]; by_age: Labeled[]; by_primary: Labeled[]; by_hobby: Labeled[];
}
export interface EventAnalytics {
  unit: string; total: number; created_series: { t: string; v: number }[]; participation_series: { t: string; v: number }[];
  by_phase: Labeled[]; by_category: (Labeled & { participants: number })[]; by_city: Labeled[]; top_places: Labeled[];
  free: number; paid: number; avg_fee: number; avg_participants: number; capacity: number; participants: number; joins: number;
  cancelled: number; completed: number; heatmap: { d: number; h: number; v: number }[]; upcoming_weeks: { t: string; v: number }[];
}
export interface HobbyAnalytics {
  unit: string; popular: (Labeled & { primary: number })[]; growth: { t: string; key: string; label: string; v: number }[];
  participation: { key: string; label: string; users: number; joins: number; per_user: number }[];
  by_city: { city: string; key: string; label: string; v: number }[]; by_gender: { key: string; label: string; gender: string; v: number }[];
}

const sum = (xs: { v: number }[] | undefined) => (xs ?? []).reduce((s, x) => s + x.v, 0);

function useLabels() {
  const { t, td } = useLanguage();
  return {
    interest: (x: Labeled) => `${x.emoji ?? ""} ${td(`interest.${x.key}`, x.label ?? x.key ?? "")}`.trim(),
    category: (x: Labeled) => `${x.emoji ?? ""} ${td(`category.${x.key}`, x.label ?? x.key ?? "")}`.trim(),
    gender: (k: string) => (k === "male" || k === "female" ? t(`gender.${k}`) : t("common.unknown")),
    phase: (k: string) => td(`status.${k}`, k),
  };
}

export function UserCharts({ d, loading }: { d: UserAnalytics | null; loading: boolean }) {
  const { t } = useLanguage();
  const L = useLabels();
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={t("kpi.totalUsers")} value={d?.total} />
        <KpiCard label={t("metric.active")} value={d?.active} />
        <KpiCard label={t("metric.onboarded")} value={d?.onboarded} />
        <KpiCard label={t("metric.retention")} value={d ? (d.retention_base ? `${Math.round((100 * d.retained) / d.retention_base)}%` : "—") : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("chart.userGrowth")} loading={loading} total={d?.total}>
          <LineTrend data={d?.growth ?? []} lines={[{ key: "total", name: t("chart.total") }, { key: "new", name: t("chart.new") }]} />
        </ChartCard>
        <ChartCard title={t("chart.activeInactive")} loading={loading} total={d ? d.active + d.inactive : 0}>
          <Donut data={[{ name: t("metric.active"), value: d?.active ?? 0 }, { name: t("metric.inactive"), value: d?.inactive ?? 0 }]} />
        </ChartCard>
        <ChartCard title={t("chart.byCity")} loading={loading} total={sum(d?.by_city)} height={320}>
          <Bars horizontal data={(d?.by_city ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
        <ChartCard title={t("chart.byKecamatan")} loading={loading} total={sum(d?.by_kecamatan)} height={320}>
          <Bars horizontal data={(d?.by_kecamatan ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
        <ChartCard title={t("chart.byKelurahan")} loading={loading} total={sum(d?.by_kelurahan)} height={320}>
          <Bars horizontal data={(d?.by_kelurahan ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
        <ChartCard title={t("chart.byGender")} loading={loading} total={sum(d?.by_gender)}>
          <Donut data={(d?.by_gender ?? []).map((x) => ({ name: L.gender(x.key ?? ""), value: x.v }))} />
        </ChartCard>
        <ChartCard title={t("chart.byAge")} loading={loading} total={sum((d?.by_age ?? []).filter((x) => x.key !== "unknown"))}>
          <Bars data={(d?.by_age ?? []).filter((x) => x.key !== "unknown").map((x) => ({ label: x.key ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
        <ChartCard title={t("chart.byPrimary")} loading={loading} total={sum(d?.by_primary)} height={300}>
          <Bars horizontal data={(d?.by_primary ?? []).map((x) => ({ label: L.interest(x), v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
      </div>
    </>
  );
}

export function EventCharts({ d, loading }: { d: EventAnalytics | null; loading: boolean }) {
  const { t, lang } = useLanguage();
  const L = useLabels();
  const days = [1, 2, 3, 4, 5, 6, 7].map((n) => t(`day.${n}` as TranslationKey));
  const hours = Array.from({ length: 18 }, (_, i) => String(i + 5));
  const heat = (r: number, c: number) => d?.heatmap.find((x) => x.d === r + 1 && x.h === c + 5)?.v ?? 0;
  const trend = (d?.created_series ?? []).map((row, i) => ({ t: row.t, created: row.v, joins: d?.participation_series[i]?.v ?? 0 }));
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label={t("kpi.totalEvents")} value={d?.total} />
        <KpiCard label={t("metric.joins")} value={d?.joins} />
        <KpiCard label={t("metric.avgParticipants")} value={d?.avg_participants} />
        <KpiCard label={t("metric.participationRate")} value={d ? (d.capacity ? `${Math.round((100 * d.participants) / d.capacity)}%` : "—") : undefined} />
        <KpiCard label={t("metric.completed")} value={d?.completed} />
        <KpiCard label={t("metric.cancelled")} value={d?.cancelled} />
        <KpiCard label={t("metric.avgFee")} value={d ? (d.avg_fee ? formatRupiah(d.avg_fee, lang) : "—") : undefined} />
        <KpiCard label={`${t("metric.free")} / ${t("metric.paid")}`} value={d ? `${d.free} / ${d.paid}` : undefined} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("chart.participation")} loading={loading} total={trend.reduce((s, r) => s + r.created + r.joins, 0)}>
          <LineTrend data={trend} lines={[{ key: "created", name: t("chart.eventsCreated") }, { key: "joins", name: t("chart.joins") }]} />
        </ChartCard>
        <ChartCard title={t("chart.byStatus")} loading={loading} total={sum(d?.by_phase)}>
          <Donut data={(d?.by_phase ?? []).map((x) => ({ name: L.phase(x.key ?? ""), value: x.v }))} />
        </ChartCard>
        <ChartCard title={t("chart.byCategory")} loading={loading} total={sum(d?.by_category)} height={320}>
          <Bars horizontal data={(d?.by_category ?? []).map((x) => ({ label: L.category(x), v: x.v, p: x.participants }))} bars={[{ key: "v", name: t("chart.events") }, { key: "p", name: t("col.participants") }]} />
        </ChartCard>
        <ChartCard title={t("chart.freePaid")} loading={loading} total={(d?.free ?? 0) + (d?.paid ?? 0)}>
          <Donut data={[{ name: t("metric.free"), value: d?.free ?? 0 }, { name: t("metric.paid"), value: d?.paid ?? 0 }]} />
        </ChartCard>
        <ChartCard title={t("chart.byLocation")} loading={loading} total={sum(d?.by_city)} height={300}>
          <Bars horizontal data={(d?.by_city ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.events") }]} />
        </ChartCard>
        <ChartCard title={t("chart.topPlaces")} loading={loading} total={sum(d?.top_places)} height={300}>
          <Bars horizontal data={(d?.top_places ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.events") }]} />
        </ChartCard>
        <ChartCard title={t("chart.heatmap")} loading={loading} total={d?.heatmap.reduce((s, x) => s + x.v, 0)} height={240}>
          <Heatmap rows={days} cols={hours} value={heat} />
        </ChartCard>
        <ChartCard title={t("chart.upcoming")} loading={loading} total={sum(d?.upcoming_weeks)}>
          <Bars data={(d?.upcoming_weeks ?? []).map((x) => ({ label: x.t.slice(5), v: x.v }))} bars={[{ key: "v", name: t("chart.events") }]} />
        </ChartCard>
      </div>
    </>
  );
}

export function HobbyCharts({ d, loading }: { d: HobbyAnalytics | null; loading: boolean }) {
  const { t } = useLanguage();
  const L = useLabels();
  const topKeys = Array.from(new Set((d?.growth ?? []).map((g) => g.key)));
  const growth = Array.from(new Set((d?.growth ?? []).map((g) => g.t))).map((tt) => {
    const row: Record<string, string | number> = { t: tt };
    for (const g of d?.growth ?? []) if (g.t === tt) row[g.key] = g.v;
    return row;
  });
  const cities = Array.from(new Set((d?.by_city ?? []).map((x) => x.city)));
  const hobbyKeys = (d?.popular ?? []).filter((p) => p.v > 0).slice(0, 10);
  const genders = ["male", "female", "unknown"];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={t("chart.popularHobbies")} loading={loading} total={sum(d?.popular)} height={340}>
        <Bars horizontal data={(d?.popular ?? []).map((x) => ({ label: L.interest(x), v: x.v, p: x.primary }))} bars={[{ key: "v", name: t("chart.selected") }, { key: "p", name: t("chart.primary") }]} />
      </ChartCard>
      <ChartCard title={t("chart.byPrimary")} loading={loading} total={(d?.popular ?? []).reduce((s, x) => s + x.primary, 0)} height={340}>
        <Donut data={(d?.popular ?? []).filter((x) => x.primary > 0).sort((a, b) => b.primary - a.primary).map((x) => ({ name: L.interest(x), value: x.primary }))} />
      </ChartCard>
      <ChartCard title={t("chart.hobbyGrowth")} loading={loading} total={(d?.growth ?? []).reduce((s, x) => s + x.v, 0)}>
        <LineTrend data={growth} lines={topKeys.map((k) => ({ key: k, name: L.interest({ key: k, v: 0, label: d?.growth.find((g) => g.key === k)?.label }) }))} />
      </ChartCard>
      <ChartCard title={t("chart.hobbyParticipation")} loading={loading} total={(d?.participation ?? []).reduce((s, x) => s + x.joins, 0)}>
        <Bars data={(d?.participation ?? []).map((x) => ({ label: L.interest({ key: x.key, label: x.label, v: 0 }), v: x.joins, u: x.per_user ?? 0 }))} bars={[{ key: "v", name: t("chart.joins") }, { key: "u", name: t("chart.perUser") }]} />
      </ChartCard>
      <ChartCard title={t("chart.hobbyCity")} loading={loading} total={(d?.by_city ?? []).reduce((s, x) => s + x.v, 0)} height={300}>
        <Heatmap
          rows={hobbyKeys.map((h) => L.interest(h))}
          cols={cities.map((c) => c.replace(/^(Kota|Kabupaten)\s+/, ""))}
          value={(r, c) => d?.by_city.find((x) => x.key === hobbyKeys[r].key && x.city === cities[c])?.v ?? 0}
        />
      </ChartCard>
      <ChartCard title={t("chart.hobbyGender")} loading={loading} total={(d?.by_gender ?? []).reduce((s, x) => s + x.v, 0)} height={300}>
        <Heatmap
          rows={hobbyKeys.map((h) => L.interest(h))}
          cols={genders.map((g) => L.gender(g))}
          value={(r, c) => d?.by_gender.find((x) => x.key === hobbyKeys[r].key && x.gender === genders[c])?.v ?? 0}
        />
      </ChartCard>
    </div>
  );
}

export function AnalyticsPage() {
  const { t, td } = useLanguage();
  const colors = useChartColors();
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<"users" | "events" | "hobbies">("users");
  const [range, setRange] = useState<DateRange>(rangeFor("90d"));
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const [cats, setCats] = useState<{ id: string; key: string; label: string }[]>([]);
  const base = { p_from: range.from, p_to: range.to };

  useEffect(() => {
    createClient().from("categories").select("id, key, label").then(({ data }) => setCats(data ?? []));
  }, []);

  const users = useRpc<UserAnalytics>("admin_user_analytics", tab === "users" ? base : null, [tab, range.from, range.to]);
  const events = useRpc<EventAnalytics>(
    "admin_event_analytics",
    tab === "events" ? { ...base, p_category: category || null, p_status: status || null } : null,
    [tab, range.from, range.to, category, status]
  );
  const hobbies = useRpc<HobbyAnalytics>("admin_hobby_analytics", tab === "hobbies" ? base : null, [tab, range.from, range.to]);

  return (
    <div ref={ref} className="space-y-6">
      <PageHeader
        title={t("analytics.title")}
        actions={
          <>
            <RangePicker value={range} onChange={setRange} />
            <button
              onClick={() => ref.current && exportNodePng(ref.current, `analytics-${tab}-${range.key}`, colors.bg)}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-cream-warm"
            >
              <ImageDown size={14} /> {t("admin.exportDashboard")}
            </button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        {(["users", "events", "hobbies"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn("rounded-full px-4 py-2 text-sm font-semibold transition", tab === k ? "bg-orange text-white shadow-soft" : "bg-surface text-ink/60 hover:bg-cream-warm")}
          >
            {t(`analytics.${k}`)}
          </button>
        ))}
        {tab === "events" && (
          <>
            <Select
              label={t("filter.category")}
              value={category}
              onChange={setCategory}
              options={[{ value: "", label: t("filter.allCategories") }, ...cats.map((c) => ({ value: c.id, label: td(`category.${c.key}`, c.label) }))]}
            />
            <Select
              label={t("filter.status")}
              value={status}
              onChange={setStatus}
              options={[{ value: "", label: t("filter.allStatuses") }, ...["open", "almost_full", "full", "ongoing", "completed", "cancelled"].map((s) => ({ value: s, label: td(`status.${s}`, s) }))]}
            />
          </>
        )}
      </div>
      {tab === "users" && <UserCharts d={users.data} loading={users.loading} />}
      {tab === "events" && <EventCharts d={events.data} loading={events.loading} />}
      {tab === "hobbies" && <HobbyCharts d={hobbies.data} loading={hobbies.loading} />}
    </div>
  );
}
