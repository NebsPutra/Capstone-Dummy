"use client";

import { useEffect, useRef, useState } from "react";
import { FileSpreadsheet, FileText, ImageDown, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import type { TranslationKey } from "@/lib/i18n/translations";
import { rangeFor, type DateRange } from "@/lib/admin";
import { DATASETS, collect, downloadBlob, rowCount, toDocx, toXlsx, type Dataset, type ReportData } from "@/lib/exporters";
import { cn } from "@/lib/utils";
import { Alert, PrimaryButton } from "@/components/ui";
import { PageHeader, RangePicker, fmtDateTime } from "@/components/admin/ui";
import { exportNodePng, useChartColors } from "@/components/admin/charts";
import { EventCharts, HobbyCharts, UserCharts, type EventAnalytics, type HobbyAnalytics, type UserAnalytics } from "@/components/admin/Analytics";

type Format = "xlsx" | "docx" | "png";
interface Job { id: string; dataset: string; format: string; status: string; row_count: number | null; created_at: string }

export default function ExportCenterPage() {
  const { t, lang } = useLanguage();
  const colors = useChartColors();
  const sb = createClient();
  const pngRef = useRef<HTMLDivElement>(null);
  const [dataset, setDataset] = useState<Dataset>("everything");
  const [format, setFormat] = useState<Format>("xlsx");
  const [scope, setScope] = useState<"full" | "filtered">("filtered");
  const [range, setRange] = useState<DateRange>(rangeFor("30d"));
  const [mask, setMask] = useState(true);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [pct, setPct] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; file?: string } | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [charts, setCharts] = useState<{ u: UserAnalytics; e: EventAnalytics; h: HobbyAnalytics } | null>(null);

  const period = scope === "full" ? t("exp.scope.full") : `${range.from.slice(0, 10)} – ${range.to.slice(0, 10)}`;
  const opt = { from: scope === "full" ? null : range.from, to: scope === "full" ? null : range.to, mask };

  useEffect(() => {
    sb.from("export_jobs").select("*").order("created_at", { ascending: false }).limit(10).then(({ data }) => setJobs(data ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Estimated scope: cheap head counts per dataset.
  useEffect(() => {
    setEstimate(null);
    const count = async (table: string, col: string) => {
      let q = sb.from(table).select("*", { count: "exact", head: true });
      if (opt.from) q = q.gte(col, opt.from).lte(col, opt.to!);
      return (await q).count ?? 0;
    };
    const map: Record<string, () => Promise<number>> = {
      users: () => count("profiles", "created_at"), events: () => count("events", "created_at"), participants: () => count("event_participants", "joined_at"),
      complaints: () => count("complaints", "created_at"), audit: () => count("audit_logs", "created_at"), hobbies: async () => 13, analytics: async () => 30,
    };
    const keys = dataset === "everything" ? Object.keys(map) : [dataset];
    Promise.all(keys.map((k) => map[k]())).then((ns) => setEstimate(ns.reduce((a, b) => a + b, 0)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset, scope, range.from, range.to]);

  async function run() {
    setResult(null);
    setPct(0);
    const { data: jobId, error } = await sb.rpc("start_export", { p_dataset: dataset, p_format: format, p_scope: scope, p_filters: { from: opt.from, to: opt.to, mask } });
    if (error) {
      setPct(null);
      return setResult({ ok: false });
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const tr = (k: string, v?: Record<string, string | number>) => t(k as TranslationKey, v);
    try {
      let file = "";
      let rows = 0;
      const args = { p_from: opt.from ?? "2000-01-01T00:00:00Z", p_to: opt.to ?? new Date().toISOString() };
      if (format === "xlsx") {
        const sheets = await collect(sb, dataset, opt, setPct);
        rows = rowCount(sheets);
        file = `komunitas-${dataset}-${stamp}.xlsx`;
        downloadBlob(await toXlsx(sheets, { title: t("report.title"), period, generated: fmtDateTime(new Date().toISOString(), lang) }), file);
      } else if (format === "docx") {
        const [k, u, e, h, c, a] = await Promise.all([
          sb.rpc("admin_dashboard_kpis", args), sb.rpc("admin_user_analytics", args), sb.rpc("admin_event_analytics", args), sb.rpc("admin_hobby_analytics", args),
          sb.from("complaints").select("status").gte("created_at", args.p_from), sb.from("audit_logs").select("action").gte("created_at", args.p_from).limit(5000),
        ]);
        setPct(70);
        const tally = <T extends Record<string, string>>(xs: T[] | null, key: keyof T) =>
          Object.entries((xs ?? []).reduce<Record<string, number>>((m, x) => ({ ...m, [x[key]]: (m[x[key]] ?? 0) + 1 }), {})).map(([k2, n]) => ({ k: k2, n }));
        const report: ReportData = {
          kpis: k.data as Record<string, number>, users: u.data as ReportData["users"], events: e.data as ReportData["events"], hobbies: h.data as ReportData["hobbies"],
          complaints: tally(c.data as { status: string }[], "status").map((x) => ({ status: t(`complaint.status.${x.k}` as TranslationKey), n: x.n })),
          audit: tally(a.data as { action: string }[], "action").map((x) => ({ action: x.k, n: x.n })),
        };
        rows = report.users.by_city.length + report.events.by_category.length;
        file = `komunitas-report-${stamp}.docx`;
        downloadBlob(await toDocx(report, tr, { period, generated: fmtDateTime(new Date().toISOString(), lang) }), file);
      } else {
        const [u, e, h] = await Promise.all([sb.rpc("admin_user_analytics", args), sb.rpc("admin_event_analytics", args), sb.rpc("admin_hobby_analytics", args)]);
        setCharts({ u: u.data as UserAnalytics, e: e.data as EventAnalytics, h: h.data as HobbyAnalytics });
        setPct(60);
        await new Promise((r) => setTimeout(r, 1200)); // let charts render
        file = `komunitas-analytics-${stamp}.png`;
        if (pngRef.current) await exportNodePng(pngRef.current, file, colors.bg);
      }
      setPct(100);
      await sb.rpc("finish_export", { p_id: jobId, p_ok: true, p_rows: rows, p_error: null });
      setResult({ ok: true, file });
    } catch (err) {
      console.error("[komunitas] export:", err);
      await sb.rpc("finish_export", { p_id: jobId, p_ok: false, p_rows: 0, p_error: String(err) });
      setResult({ ok: false });
    } finally {
      setTimeout(() => setPct(null), 800);
    }
  }

  const choice = (active: boolean) => cn("rounded-xl border px-3 py-2 text-left text-sm transition", active ? "border-orange bg-orange/10 font-semibold" : "border-ink/10 hover:bg-cream-warm");
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={t("exp.title")} subtitle={t("exp.subtitle")} />
      <Alert tone="info"><span className="flex items-start gap-2"><ShieldCheck size={16} className="mt-0.5 shrink-0" />{t("exp.privacy")}</span></Alert>
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold">{t("exp.dataset")}</h2>
          <div className="grid grid-cols-2 gap-2">
            {DATASETS.map((d) => <button key={d} onClick={() => setDataset(d)} className={choice(dataset === d)}>{t(`exp.ds.${d}`)}</button>)}
          </div>
        </section>
        <section className="card space-y-2 p-5">
          <h2 className="text-sm font-semibold">{t("exp.format")}</h2>
          {([["xlsx", FileSpreadsheet], ["docx", FileText], ["png", ImageDown]] as const).map(([f, Icon]) => (
            <button key={f} onClick={() => setFormat(f)} className={cn(choice(format === f), "flex w-full items-center gap-2")}><Icon size={16} />{t(`exp.fmt.${f}`)}</button>
          ))}
          {format === "png" && <p className="text-xs text-ink/50">{t("exp.pngHint")}</p>}
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">{t("exp.scope")}</h2>
          {(["filtered", "full"] as const).map((s) => <button key={s} onClick={() => setScope(s)} className={cn(choice(scope === s), "w-full")}>{t(`exp.scope.${s}`)}</button>)}
          {scope === "filtered" && <RangePicker value={range} onChange={setRange} />}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-orange" checked={mask} onChange={(e) => setMask(e.target.checked)} />{t("exp.mask")}</label>
        </section>
      </div>
      <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
        <p className="text-sm text-ink/60">{estimate === null ? t("exp.estimating") : t("exp.estimate", { n: estimate })}</p>
        <PrimaryButton onClick={run} loading={pct !== null} loadingText={t("exp.running", { pct: pct ?? 0 })}>{t("exp.run")}</PrimaryButton>
        {pct !== null && <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-warm"><div className="h-full bg-orange transition-all" style={{ width: `${pct}%` }} /></div>}
        {result && <Alert tone={result.ok ? "success" : "error"}>{result.ok ? t("exp.done", { file: result.file ?? "" }) : t("exp.failed")}</Alert>}
      </div>
      <section className="card space-y-2 p-5">
        <h2 className="text-sm font-semibold">{t("exp.history")}</h2>
        {jobs.map((j) => (
          <p key={j.id} className="text-xs text-ink/60">{fmtDateTime(j.created_at, lang)} · {j.dataset} · {j.format} · {j.status}{j.row_count != null ? ` · ${j.row_count}` : ""}</p>
        ))}
      </section>
      {format === "png" && charts && (
        <div ref={pngRef} className="space-y-4 rounded-2xl bg-cream p-6">
          <h2 className="text-lg font-bold">{t("report.title")} · {period}</h2>
          <UserCharts d={charts.u} loading={false} />
          <EventCharts d={charts.e} loading={false} />
          <HobbyCharts d={charts.h} loading={false} />
        </div>
      )}
    </div>
  );
}
