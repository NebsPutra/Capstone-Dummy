"use client";

import { useState } from "react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { rangeFor, type DateRange } from "@/lib/admin";
import { PageHeader, RangePicker, Table, useRpc } from "@/components/admin/ui";
import { Bars, ChartCard } from "@/components/admin/charts";
import type { EventAnalytics, UserAnalytics } from "@/components/admin/Analytics";

export default function AdminLocationsPage() {
  const { t } = useLanguage();
  const [range, setRange] = useState<DateRange>(rangeFor("year"));
  const args = { p_from: range.from, p_to: range.to };
  const users = useRpc<UserAnalytics>("admin_user_analytics", args, [range.from, range.to]);
  const events = useRpc<EventAnalytics>("admin_event_analytics", args, [range.from, range.to]);
  const lists: { title: string; rows: { label?: string; v: number }[] }[] = [
    { title: t("chart.byCity"), rows: users.data?.by_city ?? [] },
    { title: t("chart.byKecamatan"), rows: users.data?.by_kecamatan ?? [] },
    { title: t("chart.byKelurahan"), rows: users.data?.by_kelurahan ?? [] },
  ];
  return (
    <div className="space-y-6">
      <PageHeader title={t("aloc.title")} actions={<RangePicker value={range} onChange={setRange} />} />
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title={t("aloc.users")} loading={users.loading} total={(users.data?.by_city ?? []).reduce((s, x) => s + x.v, 0)} height={320}>
          <Bars horizontal data={(users.data?.by_city ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.users") }]} />
        </ChartCard>
        <ChartCard title={t("aloc.events")} loading={events.loading} total={(events.data?.by_city ?? []).reduce((s, x) => s + x.v, 0)} height={320}>
          <Bars horizontal data={(events.data?.by_city ?? []).map((x) => ({ label: x.label ?? "", v: x.v }))} bars={[{ key: "v", name: t("chart.events") }]} />
        </ChartCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {lists.map((l) => (
          <div key={l.title} className="space-y-2">
            <h2 className="text-sm font-semibold">{l.title}</h2>
            <Table>
              <thead><tr><th>{t("col.area")}</th><th>{t("col.count")}</th></tr></thead>
              <tbody>{l.rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="tabular-nums">{r.v}</td></tr>)}</tbody>
            </Table>
          </div>
        ))}
      </div>
    </div>
  );
}
