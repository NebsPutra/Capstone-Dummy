import type { Sheets } from "./exporters";

/**
 * Excel export: one raw-data sheet per dataset (styled Excel table), a
 * "Pivot" sheet with preset groupings (live COUNTIF/SUMIF formulas with
 * cached results), and a "Dashboard" sheet with KPI tiles and native Excel
 * charts that read from the pivot tables.
 *
 * ExcelJS can't write charts, so they are added to the finished file as
 * DrawingML parts (addCharts). Every formula also carries its computed
 * result, so viewers that don't recalculate (Quick Look, some previews)
 * still show the right numbers.
 */

type Cell = string | number | boolean | null;
type Row = Record<string, Cell>;
type DsKey = keyof Sheets;
export type Label = (key: string, vars?: Record<string, string | number>) => string;

const ORANGE = "F97316";
const DEEP = "C2410C";
const CREAM = "FFF8ED";
const INK = "292524";
const MUTED = "78716C";
const PALETTE = ["F97316", "C2410C", "FDBA74", "0F766E", "65A30D", "A16207", "57534E", "FB923C", "14B8A6", "A8A29E", "7C2D12"];
const HEAD = 4; // table header row on raw sheets; data starts on row 5
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const colLetter = (i: number) => {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};
const humanize = (k: string) => (k.charAt(0).toUpperCase() + k.slice(1)).replace(/_/g, " ");
const q = (sheet: string) => `'${sheet.replace(/'/g, "''")}'`;
const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const safeSheetName = (s: string) => s.replace(/[[\]:*?/\\]/g, " ").slice(0, 31);

// ---- Pivot presets -------------------------------------------------------

interface Measure { label: string; kind: "count" | "sum"; col?: string; pct?: boolean }
interface PivotSpec {
  ds: DsKey;
  title: string;
  key: string;
  /** Optional readable text shown next to the key (e.g. activity title for a ref). */
  labelCol?: string;
  measures: Measure[];
  /** [numerator index, denominator index] -> extra % column. */
  ratio?: { label: string; num: number; den: number };
  top?: number;
  order?: "value" | "key";
  /** Only rows where this column equals this value (e.g. analytics section). */
  where?: { col: string; value: string };
  chart: "bar" | "doughnut" | "line";
}

function presets(L: Label): PivotSpec[] {
  return [
    { ds: "events", title: L("xr.p.eventsByCategory"), key: "category", chart: "bar",
      measures: [{ label: L("xr.m.activities"), kind: "count" }, { label: L("xr.m.participants"), kind: "sum", col: "participants" }, { label: L("xr.m.capacity"), kind: "sum", col: "capacity" }],
      ratio: { label: L("xr.m.fillRate"), num: 1, den: 2 } },
    { ds: "events", title: L("xr.p.eventsByStatus"), key: "status", chart: "doughnut", measures: [{ label: L("xr.m.activities"), kind: "count" }] },
    { ds: "users", title: L("xr.p.usersByCity"), key: "city", top: 10, chart: "bar", measures: [{ label: L("xr.m.users"), kind: "count" }] },
    { ds: "users", title: L("xr.p.usersByGender"), key: "gender", chart: "doughnut", measures: [{ label: L("xr.m.users"), kind: "count" }] },
    { ds: "participants", title: L("xr.p.joinsByStatus"), key: "status", chart: "doughnut", measures: [{ label: L("xr.m.joins"), kind: "count" }] },
    { ds: "participants", title: L("xr.p.topActivities"), key: "event_ref", labelCol: "event", top: 10, chart: "bar", measures: [{ label: L("xr.m.joins"), kind: "count" }] },
    { ds: "complaints", title: L("xr.p.complaintsByStatus"), key: "status", chart: "doughnut", measures: [{ label: L("xr.m.complaints"), kind: "count" }] },
    { ds: "complaints", title: L("xr.p.complaintsByCategory"), key: "category", chart: "bar", measures: [{ label: L("xr.m.complaints"), kind: "count" }] },
    { ds: "hobbies", title: L("xr.p.hobbies"), key: "hobby", chart: "bar",
      measures: [{ label: L("xr.m.selected"), kind: "sum", col: "selected_by" }, { label: L("xr.m.primary"), kind: "sum", col: "primary_for" }] },
    { ds: "analytics", title: L("xr.p.userGrowth"), key: "period", order: "key", where: { col: "section", value: "user_growth" }, chart: "line",
      measures: [{ label: L("xr.m.newUsers"), kind: "sum", col: "value" }] },
    { ds: "audit", title: L("xr.p.auditByAction"), key: "action", top: 10, chart: "bar", measures: [{ label: L("xr.m.actions"), kind: "count" }] },
  ];
}

// ---- Chart parts -----------------------------------------------------------

interface ChartDef {
  type: "bar" | "doughnut" | "line";
  title: string;
  series: string;
  catRef: string;
  valRef: string;
  cats: string[];
  vals: number[];
  /** Top-left cell (0-based col, row) and size in cells on the dashboard. */
  at: { col: number; row: number; w: number; h: number };
}

function chartXml(c: ChartDef): string {
  const strCache = `<c:strCache><c:ptCount val="${c.cats.length}"/>${c.cats.map((v, i) => `<c:pt idx="${i}"><c:v>${xml(v)}</c:v></c:pt>`).join("")}</c:strCache>`;
  const numCache = `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${c.vals.length}"/>${c.vals.map((v, i) => `<c:pt idx="${i}"><c:v>${Number.isFinite(v) ? v : 0}</c:v></c:pt>`).join("")}</c:numCache>`;
  const cat = `<c:cat><c:strRef><c:f>${xml(c.catRef)}</c:f>${strCache}</c:strRef></c:cat>`;
  const val = `<c:val><c:numRef><c:f>${xml(c.valRef)}</c:f>${numCache}</c:numRef></c:val>`;
  const fill = (hex: string) => `<c:spPr><a:solidFill><a:srgbClr val="${hex}"/></a:solidFill></c:spPr>`;
  const txt = (sz: number, color = INK, b = 0) => `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${sz}" b="${b}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>`;
  const labels = (pos: string, extra = "") =>
    `<c:dLbls><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>${txt(900)}${pos}<c:showLegendKey val="0"/><c:showVal val="${extra ? 0 : 1}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${extra ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>`;
  const noLine = `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr>`;
  const grid = `<c:majorGridlines><c:spPr><a:ln w="6350"><a:solidFill><a:srgbClr val="E7E5E4"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>`;
  const tx = `<c:tx><c:v>${xml(c.series)}</c:v></c:tx>`;
  const head = `<c:idx val="0"/><c:order val="0"/>${tx}`;
  const axes = (horizontal: boolean) =>
    `<c:catAx><c:axId val="1001"/><c:scaling><c:orientation val="${horizontal ? "maxMin" : "minMax"}"/></c:scaling><c:delete val="0"/><c:axPos val="${horizontal ? "l" : "b"}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${txt(900, MUTED)}<c:crossAx val="1002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>` +
    `<c:valAx><c:axId val="1002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${horizontal ? 1 : 0}"/><c:axPos val="${horizontal ? "t" : "l"}"/>${horizontal ? "" : grid}<c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>${noLine}${txt(900, MUTED)}<c:crossAx val="1001"/><c:crosses val="${horizontal ? "max" : "autoZero"}"/><c:crossBetween val="between"/></c:valAx>`;

  let plot: string;
  let legend = "";
  if (c.type === "bar") {
    plot = `<c:barChart><c:barDir val="bar"/><c:grouping val="clustered"/><c:varyColors val="0"/><c:ser>${head}${fill(ORANGE)}<c:invertIfNegative val="0"/>${labels('<c:dLblPos val="outEnd"/>')}${cat}${val}</c:ser><c:gapWidth val="55"/><c:axId val="1001"/><c:axId val="1002"/></c:barChart>${axes(true)}`;
  } else if (c.type === "line") {
    plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/><c:ser>${head}<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill><a:srgbClr val="${ORANGE}"/></a:solidFill><a:round/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="5"/>${fill(ORANGE)}</c:marker>${cat}${val}<c:smooth val="0"/></c:ser><c:marker val="1"/><c:axId val="1001"/><c:axId val="1002"/></c:lineChart>${axes(false)}`;
  } else {
    const pts = c.vals.map((_, i) => `<c:dPt><c:idx val="${i}"/><c:bubble3D val="0"/><c:spPr><a:solidFill><a:srgbClr val="${PALETTE[i % PALETTE.length]}"/></a:solidFill><a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln></c:spPr></c:dPt>`).join("");
    plot = `<c:doughnutChart><c:varyColors val="1"/><c:ser>${head}${pts}${labels("", "pct")}${cat}${val}</c:ser><c:firstSliceAng val="0"/><c:holeSize val="58"/></c:doughnutChart>`;
    legend = `<c:legend><c:legendPos val="r"/><c:overlay val="0"/>${txt(900)}</c:legend>`;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><c:roundedCorners val="0"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="1200" b="1"/></a:pPr><a:r><a:rPr lang="en-US" sz="1200" b="1"><a:solidFill><a:srgbClr val="${INK}"/></a:solidFill></a:rPr><a:t>${xml(c.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/>${plot}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln w="9525"><a:solidFill><a:srgbClr val="EADFD2"/></a:solidFill></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr><a:latin typeface="Calibri"/></a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr></c:chartSpace>`;
}

/** Add native charts to one worksheet of a finished .xlsx (ExcelJS output). */
export async function addCharts(buf: ArrayBuffer | Uint8Array, sheetIndex: number, charts: ChartDef[]): Promise<Uint8Array> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  if (!charts.length) return zip.generateAsync({ type: "uint8array" });

  const has = (p: string) => Boolean(zip.file(p));
  let d = 1;
  while (has(`xl/drawings/drawing${d}.xml`)) d++;
  let firstChart = 1;
  while (has(`xl/charts/chart${firstChart}.xml`)) firstChart++;

  const anchors = charts.map((c, i) => {
    const { col, row, w, h } = c.at;
    return `<xdr:twoCellAnchor editAs="oneCell"><xdr:from><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>${col + w}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row + h}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 2}" name="Chart ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  });
  zip.file(`xl/drawings/drawing${d}.xml`, `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join("")}</xdr:wsDr>`);
  zip.file(
    `xl/drawings/_rels/drawing${d}.xml.rels`,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${charts.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${firstChart + i}.xml"/>`).join("")}</Relationships>`,
  );
  charts.forEach((c, i) => zip.file(`xl/charts/chart${firstChart + i}.xml`, chartXml(c)));

  // Link the drawing from the sheet.
  const sheetPath = `xl/worksheets/sheet${sheetIndex}.xml`;
  const relsPath = `xl/worksheets/_rels/sheet${sheetIndex}.xml.rels`;
  const relId = "rIdKomunitasCharts";
  const rel = `<Relationship Id="${relId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${d}.xml"/>`;
  const rels = has(relsPath) ? await zip.file(relsPath)!.async("string") : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  zip.file(relsPath, rels.replace("</Relationships>", `${rel}</Relationships>`));

  let sheet = await zip.file(sheetPath)!.async("string");
  if (!sheet.includes('xmlns:r="')) sheet = sheet.replace("<worksheet ", '<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
  const tag = `<drawing r:id="${relId}"/>`;
  // <drawing> goes after page setup elements and before legacyDrawing/tableParts/extLst.
  const before = ["<legacyDrawing", "<legacyDrawingHF", "<picture", "<oleObjects", "<controls", "<webPublishItems", "<tableParts", "<extLst", "</worksheet>"]
    .map((t) => sheet.indexOf(t))
    .filter((i) => i >= 0);
  const at = Math.min(...before);
  sheet = sheet.slice(0, at) + tag + sheet.slice(at);
  zip.file(sheetPath, sheet);

  let types = await zip.file("[Content_Types].xml")!.async("string");
  const overrides =
    `<Override PartName="/xl/drawings/drawing${d}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` +
    charts.map((_, i) => `<Override PartName="/xl/charts/chart${firstChart + i}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join("");
  types = types.replace("</Types>", `${overrides}</Types>`);
  zip.file("[Content_Types].xml", types);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

// ---- Workbook ------------------------------------------------------------------

export interface XlsxMeta { title: string; period: string; generated: string }

/** Build the workbook bytes (works in the browser and in Node for tests). */
export async function buildXlsx(s: Sheets, meta: XlsxMeta, L: Label): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Komunitas";
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  const font = (o: Partial<{ size: number; bold: boolean; color: string; italic: boolean }> = {}) => ({
    name: "Calibri", size: o.size ?? 11, bold: o.bold, italic: o.italic, color: { argb: `FF${o.color ?? INK}` },
  });
  const solid = (hex: string) => ({ type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: `FF${hex}` } });
  const banner = (ws: import("exceljs").Worksheet, title: string, sub: string, span: number) => {
    const last = colLetter(Math.max(span, 4) - 1);
    ws.mergeCells(`A1:${last}1`);
    ws.mergeCells(`A2:${last}2`);
    Object.assign(ws.getCell("A1"), { value: title, font: font({ size: 16, bold: true, color: "FFFFFF" }), fill: solid(DEEP), alignment: { vertical: "middle", indent: 1 } });
    Object.assign(ws.getCell("A2"), { value: sub, font: font({ size: 10, color: MUTED }), fill: solid(CREAM), alignment: { vertical: "middle", indent: 1 } });
    ws.getRow(1).height = 30;
    ws.getRow(2).height = 20;
  };
  const sub = (n?: number) => [`${L("report.period")}: ${meta.period}`, `${L("report.generated")}: ${meta.generated}`, n === undefined ? null : L("xr.rows", { n })].filter(Boolean).join("   |   ");

  // 1. Raw data -------------------------------------------------------------
  const raw: Partial<Record<DsKey, { name: string; cols: string[]; rows: Row[] }>> = {};
  for (const [ds, rows] of Object.entries(s) as [DsKey, Row[] | undefined][]) {
    if (!rows) continue;
    const name = safeSheetName(L(`exp.ds.${ds}`));
    const cols = rows.length ? Object.keys(rows[0]) : [];
    const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: HEAD, showGridLines: false }], properties: { tabColor: { argb: `FF${ORANGE}` } } });
    banner(ws, `${meta.title}: ${name}`, sub(rows.length), cols.length);
    raw[ds] = { name, cols, rows };
    if (!rows.length) {
      ws.getCell(`A${HEAD}`).value = L("xr.noRows");
      ws.getCell(`A${HEAD}`).font = font({ italic: true, color: MUTED });
      continue;
    }
    ws.addTable({
      name: `T_${ds}`,
      ref: `A${HEAD}`,
      headerRow: true,
      style: { theme: "TableStyleMedium3", showRowStripes: true },
      columns: cols.map((c) => ({ name: humanize(c), filterButton: true })),
      rows: rows.map((r) => cols.map((c) => (typeof r[c] === "string" && ISO.test(r[c] as string) ? new Date(r[c] as string) : r[c]))),
    });
    cols.forEach((c, i) => {
      const col = ws.getColumn(i + 1);
      const sample = rows.find((r) => r[c] !== null)?.[c];
      const longest = Math.max(humanize(c).length + 3, ...rows.slice(0, 200).map((r) => String(r[c] ?? "").length));
      col.width = Math.min(45, Math.max(10, longest + 2));
      if (typeof sample === "string" && ISO.test(sample)) { col.numFmt = "yyyy-mm-dd hh:mm"; col.width = 18; }
      if (c === "fee") col.numFmt = '"Rp"#,##0';
      if (typeof sample === "number" && c !== "fee" && !/latitude|longitude/.test(c)) col.numFmt = "#,##0";
    });
  }

  // 2. Pivot ------------------------------------------------------------------
  const pivot = wb.addWorksheet(safeSheetName(L("xr.pivot")), { views: [{ showGridLines: false }], properties: { tabColor: { argb: `FF${DEEP}` } } });
  banner(pivot, `${meta.title}: ${L("xr.pivot")}`, `${sub()}   |   ${L("xr.pivotNote")}`, 6);
  [34, 16, 16, 16, 16, 16].forEach((w, i) => (pivot.getColumn(i + 1).width = w));
  const pName = pivot.name;
  const charts: Omit<ChartDef, "at">[] = [];
  let r = HEAD;

  for (const spec of presets(L)) {
    const src = raw[spec.ds];
    if (!src || !src.rows.length || !src.cols.includes(spec.key)) continue;
    const range = (c: string) => `${q(src.name)}!$${colLetter(src.cols.indexOf(c))}$${HEAD + 1}:$${colLetter(src.cols.indexOf(c))}$${HEAD + src.rows.length}`;
    const rows = spec.where ? src.rows.filter((x) => String(x[spec.where!.col]) === spec.where!.value) : src.rows;
    if (!rows.length) continue;

    // Group in JS (for order, top-N and the cached formula results).
    const groups = new Map<string, { n: number; sums: number[]; label?: string }>();
    for (const row of rows) {
      const k = row[spec.key] === null || row[spec.key] === "" ? "" : String(row[spec.key]);
      const g = groups.get(k) ?? { n: 0, sums: spec.measures.map(() => 0), label: spec.labelCol ? String(row[spec.labelCol] ?? "") : undefined };
      g.n++;
      spec.measures.forEach((m, i) => { if (m.kind === "sum") g.sums[i] += Number(row[m.col!]) || 0; });
      groups.set(k, g);
    }
    const value = (g: { n: number; sums: number[] }, i: number) => (spec.measures[i].kind === "count" ? g.n : g.sums[i]);
    let keys = [...groups.keys()];
    keys.sort(spec.order === "key" ? (a, b) => a.localeCompare(b) : (a, b) => value(groups.get(b)!, 0) - value(groups.get(a)!, 0));
    const rest = spec.top && keys.length > spec.top ? keys.slice(spec.top) : [];
    keys = keys.slice(0, spec.top ?? keys.length);

    // Title + header
    const headers = [spec.labelCol ? L("xr.m.code") : humanize(spec.key), ...(spec.labelCol ? [humanize(spec.labelCol)] : []), ...spec.measures.map((m) => m.label), ...(spec.ratio ? [spec.ratio.label] : [])];
    pivot.getCell(r, 1).value = spec.title;
    pivot.getCell(r, 1).font = font({ size: 13, bold: true, color: DEEP });
    r++;
    const hr = pivot.getRow(r);
    headers.forEach((h, i) => Object.assign(hr.getCell(i + 1), { value: h, font: font({ bold: true, color: "FFFFFF" }), fill: solid(ORANGE), alignment: { horizontal: i ? "right" : "left" } }));
    r++;
    const first = r;
    const off = spec.labelCol ? 1 : 0; // extra text column
    const mCol = (i: number) => 2 + off + i; // 1-based column of measure i

    const writeRow = (label: string, crit: string | null, g: { n: number; sums: number[] }, text?: string) => {
      const row = pivot.getRow(r);
      row.getCell(1).value = label;
      if (spec.labelCol) row.getCell(2).value = text ?? "";
      spec.measures.forEach((m, i) => {
        // SUMPRODUCT compares exactly: COUNTIF would treat * and ? in titles
        // as wildcards and read date-like text as dates.
        const cond = spec.where ? `*(${range(spec.where.col)}="${spec.where.value}")` : "";
        const match = `(${range(spec.key)}=${crit})${cond}`;
        const formula = crit === null ? null
          : m.kind === "count" ? `SUMPRODUCT(--(${match}))`
          : `SUMPRODUCT(--(${match}),${range(m.col!)})`;
        row.getCell(mCol(i)).value = formula ? { formula, result: value(g, i) } : value(g, i);
        row.getCell(mCol(i)).numFmt = "#,##0";
      });
      if (spec.ratio) {
        const a = `${colLetter(mCol(spec.ratio.num) - 1)}${r}`;
        const b = `${colLetter(mCol(spec.ratio.den) - 1)}${r}`;
        const den = value(g, spec.ratio.den);
        row.getCell(mCol(spec.measures.length)).value = { formula: `IFERROR(${a}/${b},0)`, result: den ? value(g, spec.ratio.num) / den : 0 };
        row.getCell(mCol(spec.measures.length)).numFmt = "0%";
      }
      if ((r - first) % 2) row.eachCell((c) => (c.fill = solid(CREAM)));
      r++;
    };

    for (const k of keys) {
      const g = groups.get(k)!;
      writeRow(k || L("xr.blank"), k ? `$A${r}` : '""', g, g.label);
    }
    if (rest.length) {
      // "Other" = everything outside the top N (formula: total minus the rows above).
      const g = rest.reduce((acc, k) => {
        const x = groups.get(k)!;
        return { n: acc.n + x.n, sums: acc.sums.map((v, i) => v + x.sums[i]) };
      }, { n: 0, sums: spec.measures.map(() => 0) });
      writeRow(L("xr.other"), null, g);
      spec.measures.forEach((m, i) => {
        const L1 = colLetter(mCol(i) - 1);
        const total = m.kind === "count" ? `ROWS(${range(spec.key)})` : `SUM(${range(m.col!)})`;
        pivot.getCell(r - 1, mCol(i)).value = { formula: `${total}-SUM(${L1}${first}:${L1}${r - 2})`, result: value(g, i) };
      });
    }
    const last = r - 1;

    // Total row
    const tr = pivot.getRow(r);
    tr.getCell(1).value = L("xr.total");
    spec.measures.forEach((_, i) => {
      const L1 = colLetter(mCol(i) - 1);
      const sum = [...keys, ...rest].reduce((n, k) => n + value(groups.get(k)!, i), 0);
      tr.getCell(mCol(i)).value = { formula: `SUM(${L1}${first}:${L1}${last})`, result: sum };
      tr.getCell(mCol(i)).numFmt = "#,##0";
    });
    if (spec.ratio) {
      const a = colLetter(mCol(spec.ratio.num) - 1);
      const b = colLetter(mCol(spec.ratio.den) - 1);
      const all = [...keys, ...rest].map((k) => groups.get(k)!);
      const den = all.reduce((n, g) => n + value(g, spec.ratio!.den), 0);
      tr.getCell(mCol(spec.measures.length)).value = { formula: `IFERROR(${a}${r}/${b}${r},0)`, result: den ? all.reduce((n, g) => n + value(g, spec.ratio!.num), 0) / den : 0 };
      tr.getCell(mCol(spec.measures.length)).numFmt = "0%";
    }
    tr.eachCell((c) => { c.font = font({ bold: true }); c.border = { top: { style: "thin", color: { argb: `FF${ORANGE}` } } }; });

    charts.push({
      type: spec.chart,
      title: spec.title,
      series: spec.measures[0].label,
      catRef: `${q(pName)}!$A$${first}:$A$${last}`,
      valRef: `${q(pName)}!$${colLetter(mCol(0) - 1)}$${first}:$${colLetter(mCol(0) - 1)}$${last}`,
      cats: Array.from({ length: last - first + 1 }, (_, i) => String(pivot.getCell(first + i, 1).value)),
      vals: Array.from({ length: last - first + 1 }, (_, i) => {
        // ExcelJS drops a cached result of 0, so fall back to 0 (Excel rejects
        // a chart whose cache holds "undefined").
        const v = pivot.getCell(first + i, mCol(0)).value as number | { result?: number };
        return typeof v === "number" ? v : (v.result ?? 0);
      }),
    });
    r += 3;
  }

  // 3. Dashboard -----------------------------------------------------------------
  const dash = wb.addWorksheet(safeSheetName(L("xr.dashboard")), { views: [{ showGridLines: false }], properties: { tabColor: { argb: "FF0F766E" } } });
  for (let i = 1; i <= 17; i++) dash.getColumn(i).width = i === 1 ? 2 : 11;
  dash.mergeCells("B1:Q1");
  dash.mergeCells("B2:Q2");
  Object.assign(dash.getCell("B1"), { value: `${meta.title}: ${L("xr.dashboard")}`, font: font({ size: 18, bold: true, color: "FFFFFF" }), fill: solid(DEEP), alignment: { vertical: "middle", indent: 1 } });
  Object.assign(dash.getCell("B2"), { value: sub(), font: font({ size: 10, color: MUTED }), fill: solid(CREAM), alignment: { vertical: "middle", indent: 1 } });
  dash.getRow(1).height = 34;

  // KPI tiles: formulas over the raw sheets (with cached results).
  const tiles: { label: string; formula: string; result: number; fmt?: string }[] = [];
  const rng = (ds: DsKey, c: string) => {
    const t = raw[ds];
    if (!t || !t.rows.length || !t.cols.includes(c)) return null;
    const L1 = colLetter(t.cols.indexOf(c));
    return `${q(t.name)}!$${L1}$${HEAD + 1}:$${L1}$${HEAD + t.rows.length}`;
  };
  const sumOf = (ds: DsKey, c: string) => (raw[ds]?.rows ?? []).reduce((n, x) => n + (Number(x[c]) || 0), 0);
  const count = (ds: DsKey, c: string, label: string) => {
    const g = rng(ds, c);
    if (g) tiles.push({ label, formula: `ROWS(${g})`, result: raw[ds]!.rows.length });
  };
  count("users", "username", L("xr.k.users"));
  count("events", "ref", L("xr.k.activities"));
  if (rng("events", "participants") && rng("events", "capacity")) {
    tiles.push({ label: L("xr.k.participants"), formula: `SUM(${rng("events", "participants")})`, result: sumOf("events", "participants") });
    const cap = sumOf("events", "capacity");
    tiles.push({ label: L("xr.k.capacityUsed"), formula: `IFERROR(SUM(${rng("events", "participants")})/SUM(${rng("events", "capacity")}),0)`, result: cap ? sumOf("events", "participants") / cap : 0, fmt: "0%" });
    const paid = (raw.events?.rows ?? []).map((x) => Number(x.fee) || 0).filter((x) => x > 0);
    tiles.push({ label: L("xr.k.avgFee"), formula: `IFERROR(AVERAGEIF(${rng("events", "fee")},">0"),0)`, result: paid.length ? paid.reduce((a, b) => a + b, 0) / paid.length : 0, fmt: '"Rp"#,##0' });
  }
  count("participants", "status", L("xr.k.joins"));
  count("complaints", "ref", L("xr.k.complaints"));
  count("audit", "action", L("xr.k.audit"));

  const TILE_W = 4; // columns per tile, 4 tiles per row starting at B
  tiles.forEach((tile, i) => {
    const c0 = 2 + (i % 4) * TILE_W;
    const r0 = 4 + Math.floor(i / 4) * 4;
    const span = (row: number) => `${colLetter(c0 - 1)}${row}:${colLetter(c0 + TILE_W - 3)}${row}`; // leave one gap column
    dash.mergeCells(span(r0));
    dash.mergeCells(span(r0 + 1));
    const v = dash.getCell(r0, c0);
    v.value = { formula: tile.formula, result: tile.result };
    v.numFmt = tile.fmt ?? "#,##0";
    v.font = font({ size: 22, bold: true, color: DEEP });
    v.fill = solid(CREAM);
    v.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    const l = dash.getCell(r0 + 1, c0);
    l.value = tile.label;
    l.font = font({ size: 10, color: MUTED });
    l.fill = solid(CREAM);
    l.alignment = { horizontal: "left", vertical: "top", indent: 1 };
    dash.getRow(r0).height = 32;
  });
  const chartTop = 4 + Math.ceil(tiles.length / 4) * 4;
  if (!charts.length) {
    dash.getCell(chartTop + 1, 2).value = L("xr.noRows");
    dash.getCell(chartTop + 1, 2).font = font({ italic: true, color: MUTED });
  }

  const dashIndex = wb.worksheets.indexOf(dash) + 1;
  const placed: ChartDef[] = charts.map((c, i) => ({
    ...c,
    at: { col: 1 + (i % 2) * 8, row: chartTop + Math.floor(i / 2) * 18, w: 8, h: 17 },
  }));
  const buf = await wb.xlsx.writeBuffer();
  return addCharts(buf as ArrayBuffer, dashIndex, placed);
}
