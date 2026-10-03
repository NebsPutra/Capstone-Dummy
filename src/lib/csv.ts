/** CSV for Excel/Sheets: quoted cells, "" for quotes, CRLF lines, BOM so Excel reads UTF-8. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    // Leading = + - @ would run as a formula in Excel: prefix with ' to keep it text.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
}
