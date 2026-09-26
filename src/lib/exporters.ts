"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { maskEmail, maskPhone } from "@/lib/admin";

export type Dataset = "everything" | "users" | "events" | "participants" | "hobbies" | "complaints" | "analytics" | "audit";
export const DATASETS: Dataset[] = ["everything", "users", "events", "participants", "hobbies", "complaints", "analytics", "audit"];

export interface ExportOptions {
  from: string | null; // ISO; null = full dataset
  to: string | null;
  mask: boolean;
}

type Row = Record<string, string | number | boolean | null>;
export type Sheets = Partial<Record<Exclude<Dataset, "everything">, Row[]>>;
type Progress = (pct: number) => void;

async function pages<T>(fetchPage: (offset: number) => Promise<{ rows: T[]; total: number }>, onRow: Progress) {
  const out: T[] = [];
  for (let offset = 0; ; offset += 200) {
    const { rows, total } = await fetchPage(offset);
    out.push(...rows);
    onRow(total ? Math.min(1, out.length / total) : 1);
    if (!rows.length || out.length >= total) break;
  }
  return out;
}

/** Collect raw rows for each requested dataset (server-side aggregation, paginated). */
export async function collect(sb: SupabaseClient, which: Dataset, opt: ExportOptions, progress: Progress): Promise<Sheets> {
  const want = which === "everything" ? (["users", "events", "participants", "hobbies", "complaints", "analytics", "audit"] as const) : [which];
  const sheets: Sheets = {};
  const inRange = <T extends { created_at?: string }>(r: T) => !opt.from || !r.created_at || (r.created_at >= opt.from && r.created_at <= opt.to!);
  const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : null);
  let step = 0;
  const tick = (p: number) => progress(Math.round(((step + p) / want.length) * 90));

  for (const ds of want) {
    if (ds === "users") {
      const rows = await pages<Row & { created_at: string }>(async (offset) => {
        const { data, error } = await sb.rpc("admin_list_users", { p_limit: 200, p_offset: offset, p_sort: "oldest" });
        if (error) throw error;
        return data as { rows: (Row & { created_at: string })[]; total: number };
      }, tick);
      sheets.users = rows.filter(inRange).map((u) => ({
        username: u.username, name: u.display_name, email: opt.mask ? maskEmail(u.email as string) : u.email, role: u.role,
        status: u.account_status, city: u.city, gender: u.gender, registered: u.created_at, last_sign_in: u.last_sign_in_at,
        onboarded: u.onboarded, events_created: Number(u.events_created), events_joined: Number(u.events_joined), complaints: Number(u.complaints),
      }));
    } else if (ds === "events") {
      const rows = await pages<Row & { category: { label: string } | null; organizer: { username: string; city: string | null } | null }>(async (offset) => {
        const { data, error } = await sb.rpc("admin_list_events", { p_limit: 200, p_offset: offset, p_from: dateOnly(opt.from), p_to: dateOnly(opt.to) });
        if (error) throw error;
        return data as never;
      }, tick);
      sheets.events = rows.map((e) => ({
        ref: e.ref, title: e.title, date: e.event_date, start: e.start_time, end: e.end_time, category: e.category?.label ?? null,
        status: e.phase, privacy: e.privacy, fee: Number(e.fee), capacity: Number(e.max_participants), participants: Number(e.participant_count),
        location: e.location_name, latitude: Number(e.latitude), longitude: Number(e.longitude), organizer: e.organizer?.username ?? null,
        organizer_city: e.organizer?.city ?? null, open_complaints: Number(e.open_complaints),
      }));
    } else if (ds === "participants") {
      let q = sb.from("event_participants").select("status, joined_at, event:events(ref, title), participant:profiles!event_participants_user_id_fkey(username)").order("joined_at").limit(10000);
      if (opt.from) q = q.gte("joined_at", opt.from).lte("joined_at", opt.to!);
      const { data, error } = await q;
      if (error) throw error;
      sheets.participants = ((data ?? []) as unknown as { status: string; joined_at: string; event: { ref: string; title: string } | null; participant: { username: string } | null }[]).map((p) => ({
        event_ref: p.event?.ref ?? null, event: p.event?.title ?? null, participant: p.participant?.username ?? null, status: p.status, joined_at: p.joined_at,
      }));
    } else if (ds === "hobbies") {
      const { data, error } = await sb.rpc("admin_hobby_analytics", { p_from: opt.from ?? "2000-01-01T00:00:00Z", p_to: opt.to ?? new Date().toISOString() });
      if (error) throw error;
      const d = data as { popular: { key: string; label: string; v: number; primary: number }[]; participation: { key: string; users: number; joins: number }[] };
      sheets.hobbies = d.popular.map((h) => ({
        key: h.key, hobby: h.label, selected_by: h.v, primary_for: h.primary,
        joins_by_these_users: d.participation.find((p) => p.key === h.key)?.joins ?? 0,
      }));
    } else if (ds === "complaints") {
      let q = sb.from("complaints").select("ref, created_at, category, severity, status, subject, is_anonymous, contact, email_status, last_activity_at, event:events(ref)").order("created_at").limit(10000);
      if (opt.from) q = q.gte("created_at", opt.from).lte("created_at", opt.to!);
      const { data, error } = await q;
      if (error) throw error;
      sheets.complaints = ((data ?? []) as unknown as (Row & { event: { ref: string } | null })[]).map((c) => ({
        ref: c.ref, created_at: c.created_at, category: c.category, severity: c.severity, status: c.status, subject: c.subject,
        anonymous: c.is_anonymous, contact: opt.mask ? maskPhone(c.contact as string) : c.contact, email: c.email_status,
        event_ref: c.event?.ref ?? null, last_update: c.last_activity_at,
      }));
    } else if (ds === "analytics") {
      const args = { p_from: opt.from ?? "2000-01-01T00:00:00Z", p_to: opt.to ?? new Date().toISOString() };
      const [k, u] = await Promise.all([sb.rpc("admin_dashboard_kpis", args), sb.rpc("admin_user_analytics", args)]);
      if (k.error) throw k.error;
      const kp = k.data as Record<string, number>;
      const growth = (u.data as { growth: { t: string; new: number; total: number }[] } | null)?.growth ?? [];
      sheets.analytics = [
        ...Object.entries(kp).map(([metric, value]) => ({ section: "kpi", metric, period: null, value: Number(value) })),
        ...growth.map((g) => ({ section: "user_growth", metric: "new_users", period: g.t, value: g.new })),
      ];
    } else if (ds === "audit") {
      let q = sb.from("audit_logs").select("created_at, actor_role, action, entity, entity_id, old_value, new_value, actor:profiles!audit_logs_actor_id_fkey(username)").order("created_at").limit(10000);
      if (opt.from) q = q.gte("created_at", opt.from).lte("created_at", opt.to!);
      const { data, error } = await q;
      if (error) throw error;
      sheets.audit = ((data ?? []) as unknown as (Row & { actor: { username: string } | null; old_value: unknown; new_value: unknown })[]).map((a) => ({
        time: a.created_at, actor: a.actor?.username ?? "system", role: a.actor_role, action: a.action, entity: a.entity, entity_id: a.entity_id,
        old_value: a.old_value ? JSON.stringify(a.old_value) : null, new_value: a.new_value ? JSON.stringify(a.new_value) : null,
      }));
    }
    step++;
    tick(0);
  }
  return sheets;
}

export function rowCount(s: Sheets) {
  return Object.values(s).reduce((n, rows) => n + (rows?.length ?? 0), 0);
}

/** Excel: a Summary sheet with live formulas + one raw-data sheet per dataset. */
export async function toXlsx(s: Sheets, meta: { title: string; period: string; generated: string }): Promise<Blob> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Komunitas";
  wb.created = new Date();
  const summary = wb.addWorksheet("Summary");
  summary.addRows([[meta.title], ["Period", meta.period], ["Generated", meta.generated], [], ["Sheet", "Rows"]]);
  summary.getRow(1).font = { bold: true, size: 14 };
  summary.getRow(5).font = { bold: true };

  for (const [name, rows] of Object.entries(s)) {
    if (!rows) continue;
    const sheetName = name.charAt(0).toUpperCase() + name.slice(1);
    const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", ySplit: 1 }] });
    const cols = rows.length ? Object.keys(rows[0]) : ["(empty)"];
    ws.columns = cols.map((c) => ({ header: c, key: c, width: Math.min(40, Math.max(12, c.length + 4)) }));
    rows.forEach((r) => ws.addRow(r));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF97316" } };
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
    // Live row count, so the summary stays right if rows are filtered/edited.
    summary.addRow([sheetName, { formula: `COUNTA('${sheetName}'!A:A)-1` }]);
  }

  const events = s.events;
  if (events?.length) {
    const n = events.length + 1;
    summary.addRows([[], ["Events: formulas"]]);
    summary.addRow(["Total participants", { formula: `SUM(Events!K2:K${n})` }]);
    summary.addRow(["Total capacity", { formula: `SUM(Events!J2:J${n})` }]);
    summary.addRow(["Capacity used", { formula: `IFERROR(B${summary.rowCount - 1}/B${summary.rowCount},0)` }]);
    summary.getCell(`B${summary.rowCount}`).numFmt = "0.0%";
    summary.addRow(["Average fee (paid)", { formula: `IFERROR(AVERAGEIF(Events!I2:I${n},">0"),0)` }]);
    summary.getCell(`B${summary.rowCount}`).numFmt = '"Rp"#,##0';
  }
  summary.getColumn(1).width = 28;
  summary.getColumn(2).width = 18;
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export interface ReportData {
  kpis: Record<string, number>;
  users: { by_city: { label?: string; v: number }[]; by_gender: { key?: string; v: number }[]; by_primary: { label?: string; v: number }[] };
  events: { by_category: { label?: string; v: number; participants: number }[]; by_city: { label?: string; v: number }[]; free: number; paid: number; avg_fee: number; avg_participants: number; capacity: number; participants: number };
  hobbies: { popular: { label: string; v: number; primary: number }[] };
  complaints: { status: string; n: number }[];
  audit: { action: string; n: number }[];
}

/** Editable Word report (real headings, paragraphs and tables — no images of text). */
export async function toDocx(d: ReportData, t: (k: string, v?: Record<string, string | number>) => string, meta: { period: string; generated: string }): Promise<Blob> {
  const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, WidthType, TextRun } = await import("docx");
  const cell = (text: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, bold })] })] });
  const table = (head: string[], rows: (string | number)[][]) =>
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ tableHeader: true, children: head.map((h) => cell(h, true)) }), ...rows.map((r) => new TableRow({ children: r.map((v) => cell(String(v))) }))],
    });
  const h = (text: string) => new Paragraph({ text, heading: HeadingLevel.HEADING_1, spacing: { before: 300, after: 120 } });
  const p = (text: string) => new Paragraph({ text, spacing: { after: 120 } });
  const k = d.kpis;
  const doc = new Document({
    creator: "Komunitas",
    title: t("report.title"),
    sections: [
      {
        children: [
          new Paragraph({ text: t("report.title"), heading: HeadingLevel.TITLE }),
          p(`${t("report.period")}: ${meta.period}`),
          p(`${t("report.generated")}: ${meta.generated}`),
          h(t("report.s1")),
          p(t("report.summary", { users: k.total_users, newUsers: k.new_users, active: k.active_users, created: k.events_created, joins: k.joins, open: k.open_complaints })),
          table([t("report.metric"), t("report.value")], [
            [t("kpi.totalUsers"), k.total_users], [t("kpi.newUsers"), k.new_users], [t("kpi.activeUsers"), k.active_users],
            [t("kpi.totalEvents"), k.total_events], [t("kpi.upcomingEvents"), k.upcoming_events], [t("kpi.completedEvents"), k.completed_events],
            [t("kpi.cancelledEvents"), k.cancelled_events], [t("kpi.totalParticipants"), k.total_participants], [t("kpi.openComplaints"), k.open_complaints],
          ]),
          h(t("report.s2")),
          table([t("chart.byCity"), t("col.count")], d.users.by_city.map((x) => [x.label ?? "—", x.v])),
          p(""),
          table([t("chart.byGender"), t("col.count")], d.users.by_gender.map((x) => [x.key ?? "—", x.v])),
          h(t("report.s3")),
          table([t("col.category"), t("chart.events"), t("col.participants")], d.events.by_category.map((x) => [x.label ?? "—", x.v, x.participants])),
          p(`${t("metric.free")}: ${d.events.free} · ${t("metric.paid")}: ${d.events.paid} · ${t("metric.avgFee")}: Rp${d.events.avg_fee.toLocaleString("id-ID")}`),
          h(t("report.s4")),
          table([t("taxo.hobbies"), t("chart.selected"), t("chart.primary")], d.hobbies.popular.map((x) => [x.label, x.v, x.primary])),
          h(t("report.s5")),
          p(`${t("metric.avgParticipants")}: ${d.events.avg_participants} · ${t("metric.participationRate")}: ${d.events.capacity ? Math.round((100 * d.events.participants) / d.events.capacity) : 0}%`),
          table([t("chart.byPrimary"), t("col.count")], d.users.by_primary.map((x) => [x.label ?? "—", x.v])),
          h(t("report.s6")),
          table([t("col.status"), t("col.count")], d.complaints.map((x) => [x.status, x.n])),
          h(t("report.s7")),
          table([t("chart.byLocation"), t("col.count")], d.events.by_city.map((x) => [x.label ?? "—", x.v])),
          h(t("report.s8")),
          table([t("col.action"), t("col.count")], d.audit.map((x) => [x.action, x.n])),
          h(t("report.s9")),
          ...["report.note1", "report.note2", "report.note3", "report.note4", "report.note5"].map((n) => p(`• ${t(n)}`)),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
