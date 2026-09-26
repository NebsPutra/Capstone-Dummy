"use client";

import { useRef, useState } from "react";
import { Download } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { createClient } from "@/lib/supabase/client";

export const PALETTE = ["#F97316", "#FB923C", "#C2410C", "#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"];

export function useChartColors() {
  const { resolved } = useTheme();
  const dark = resolved === "dark";
  return {
    grid: dark ? "rgba(244,236,226,0.08)" : "rgba(41,37,36,0.08)",
    axis: dark ? "rgba(244,236,226,0.55)" : "rgba(41,37,36,0.55)",
    bg: dark ? "#211C18" : "#FFFFFF",
    tooltip: { backgroundColor: dark ? "#2D251F" : "#FFFFFF", border: "none", borderRadius: 12, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" },
  };
}

/** Save a DOM node as a high-resolution PNG (3x) for slides and reports. */
export async function exportNodePng(node: HTMLElement, filename: string, background: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(node, { pixelRatio: 3, backgroundColor: background, cacheBust: true });
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : `${filename}.png`;
  a.click();
  createClient()
    .rpc("log_admin_action", { p_action: "chart_exported", p_meta: { file: a.download } })
    .then(() => {});
}

/** Card with title, PNG export and a "not enough data" state for tiny datasets. */
export function ChartCard({
  title,
  total,
  minTotal = 3,
  loading,
  height = 260,
  children,
  className = "",
}: {
  title: string;
  total?: number;
  minTotal?: number;
  loading?: boolean;
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const { t } = useLanguage();
  const colors = useChartColors();
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const notEnough = !loading && typeof total === "number" && total < minTotal;
  return (
    <div ref={ref} className={`card flex flex-col gap-3 p-4 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        {!loading && !notEnough && (
          <button
            type="button"
            title={t("admin.exportPng")}
            aria-label={t("admin.exportPng")}
            disabled={busy}
            onClick={async () => {
              if (!ref.current) return;
              setBusy(true);
              await exportNodePng(ref.current, title.replace(/[^\w-]+/g, "_"), colors.bg).catch(console.error);
              setBusy(false);
            }}
            className="rounded-full p-1.5 text-ink/40 hover:bg-cream-warm hover:text-ink/70"
          >
            <Download size={15} />
          </button>
        )}
      </div>
      <div style={{ height }} className="w-full">
        {loading ? (
          <div className="skeleton h-full w-full" />
        ) : notEnough ? (
          <div className="flex h-full items-center justify-center rounded-xl bg-cream-warm/60 px-6 text-center text-sm text-ink/50">
            {t("chart.notEnough")}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

type Row = Record<string, string | number>;

export function LineTrend({ data, lines, area = false }: { data: Row[]; lines: { key: string; name: string }[]; area?: boolean }) {
  const c = useChartColors();
  const Chart = area ? AreaChart : LineChart;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <Chart data={data} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} vertical={false} />
        <XAxis dataKey="t" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} tickFormatter={(v: string) => v.slice(5)} />
        <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={c.tooltip} />
        {lines.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {lines.map((l, i) =>
          area ? (
            <Area key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={PALETTE[i]} fill={PALETTE[i]} fillOpacity={0.15} strokeWidth={2} />
          ) : (
            <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={PALETTE[i]} strokeWidth={2} dot={false} />
          )
        )}
      </Chart>
    </ResponsiveContainer>
  );
}

export function Bars({
  data,
  bars,
  horizontal = false,
  labelKey = "label",
}: {
  data: Row[];
  bars: { key: string; name: string }[];
  horizontal?: boolean;
  labelKey?: string;
}) {
  const c = useChartColors();
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 5, right: 12, left: horizontal ? 8 : -18, bottom: 0 }}>
        <CartesianGrid stroke={c.grid} horizontal={!horizontal} vertical={horizontal} />
        {horizontal ? (
          <>
            <XAxis type="number" tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
            <YAxis type="category" dataKey={labelKey} width={120} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} />
          </>
        ) : (
          <>
            <XAxis dataKey={labelKey} tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} interval={0} angle={data.length > 6 ? -30 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
            <YAxis tick={{ fill: c.axis, fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
          </>
        )}
        <Tooltip contentStyle={c.tooltip} cursor={{ fill: c.grid }} />
        {bars.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
        {bars.map((b, i) => (
          <Bar key={b.key} dataKey={b.key} name={b.name} fill={PALETTE[i]} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={36} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Donut for a handful of categories only (pies with many slices mislead). */
export function Donut({ data }: { data: { name: string; value: number }[] }) {
  const c = useChartColors();
  const top = data.length > 6 ? [...data.slice(0, 5), { name: "…", value: data.slice(5).reduce((s, d) => s + d.value, 0) }] : data;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie data={top} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2} stroke="none">
          {top.map((_, i) => (
            <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={c.tooltip} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Rows x columns intensity grid (e.g. weekday x hour, hobby x city). */
export function Heatmap({ rows, cols, value }: { rows: string[]; cols: string[]; value: (r: number, c: number) => number }) {
  let max = 0;
  rows.forEach((_, r) => cols.forEach((__, c) => (max = Math.max(max, value(r, c)))));
  return (
    <div className="h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0.5 text-[10px]">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c} className="px-0.5 font-medium text-ink/40">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={r}>
              <th className="whitespace-nowrap pr-2 text-left font-medium text-ink/50">{r}</th>
              {cols.map((c, ci) => {
                const v = value(ri, ci);
                return (
                  <td
                    key={c}
                    title={`${r} · ${c}: ${v}`}
                    className="h-6 min-w-6 rounded text-center text-white"
                    style={{ backgroundColor: v ? `rgba(249,115,22,${0.15 + (0.85 * v) / (max || 1)})` : "rgba(128,128,128,0.08)" }}
                  >
                    {v || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
