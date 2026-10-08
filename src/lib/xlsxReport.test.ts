import { writeFileSync } from "node:fs";
import JSZip from "jszip";
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildXlsx } from "./xlsxReport";
import type { Sheets } from "./exporters";

const L = (k: string, v?: Record<string, string | number>) => (v ? `${k} ${Object.values(v).join(" ")}` : k.replace(/^exp\.ds\./, ""));

const cats = ["Group Run", "Badminton", "Book Discussion", "Futsal", "Cycling"];
const sheets: Sheets = {
  users: Array.from({ length: 40 }, (_, i) => ({
    username: `user${i}`, name: `User ${i}`, email: `u${i}@x.id`, role: i ? "participant" : "admin", status: "active",
    city: ["Jakarta Selatan", "Jakarta Pusat", "Bandung", "Depok", null][i % 5], gender: ["male", "female", null][i % 3],
    registered: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T10:00:00Z`, last_sign_in: null, onboarded: true,
    events_created: i % 3, events_joined: i % 4, complaints: 0,
  })),
  events: Array.from({ length: 16 }, (_, i) => ({
    ref: `KOM-${i}`, title: i === 3 ? "Main * apa? =1" : `Activity ${i}`, date: "2026-10-10", start: "07:00", end: "09:00",
    category: cats[i % 5], status: ["open", "full", "completed", "cancelled"][i % 4], privacy: "public", fee: i % 2 ? 25000 : 0,
    capacity: 20, participants: (i * 3) % 20, location: "GBK", latitude: -6.2, longitude: 106.8, organizer: "user1", organizer_city: "Jakarta", open_complaints: 0,
  })),
  participants: Array.from({ length: 30 }, (_, i) => ({ event_ref: `KOM-${i % 12}`, event: `Activity ${i % 12}`, participant: `user${i}`, status: i % 5 ? "approved" : "pending", joined_at: "2026-10-01T08:00:00Z" })),
  hobbies: cats.map((c, i) => ({ key: c.toLowerCase(), hobby: c, selected_by: 10 - i, primary_for: 5 - i, joins_by_these_users: i })),
  complaints: Array.from({ length: 6 }, (_, i) => ({ ref: `C-${i}`, created_at: "2026-10-02T09:00:00Z", category: ["bug", "content", "safety"][i % 3], severity: "low", status: ["OPEN", "RESOLVED"][i % 2], subject: "x", anonymous: false, contact: null, email: "sent", event_ref: null, last_update: null })),
  analytics: [
    { section: "kpi", metric: "total_users", period: null, value: 40 },
    ...["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29"].map((p, i) => ({ section: "user_growth", metric: "new_users", period: p, value: 3 + i * 2 })),
  ],
  audit: Array.from({ length: 25 }, (_, i) => ({ time: "2026-10-03T10:00:00Z", actor: "admin", role: "admin", action: ["user_suspended", "event_hidden", "chart_exported"][i % 3], entity: "user", entity_id: String(i), old_value: null, new_value: null })),
};

describe("buildXlsx", () => {
  it("writes raw sheets, a pivot with live formulas and a dashboard with charts", async () => {
    const bytes = await buildXlsx(sheets, { title: "Report", period: "2026-09-01 - 2026-10-08", generated: "8 Oct 2026" }, L);
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, bytes);

    const zip = await JSZip.loadAsync(bytes);
    const charts = Object.keys(zip.files).filter((f) => /^xl\/charts\/chart\d+\.xml$/.test(f));
    expect(charts).toHaveLength(11);
    expect(await zip.file("[Content_Types].xml")!.async("string")).toContain("drawingml.chart+xml");

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(bytes) as unknown as ArrayBuffer);
    const names = wb.worksheets.map((w) => w.name);
    expect(names.slice(-2)).toEqual(["xr.pivot", "xr.dashboard"]);
    expect(names).toContain("events");

    // Pivot: activities by category, cached result matches the data.
    const pivot = wb.getWorksheet("xr.pivot")!;
    let run: ExcelJS.Row | undefined;
    pivot.eachRow((row) => { if (row.getCell(1).value === "Group Run" && !run) run = row; });
    const cell = run!.getCell(2).value as { formula: string; result: number };
    expect(cell.formula).toMatch(/^SUMPRODUCT\(--\(\('events'!\$F\$5:\$F\$20=\$A\d+\)\)\)$/);
    expect(cell.result).toBe(sheets.events!.filter((e) => e.category === "Group Run").length);
  });
});
