import JSZip from "jszip";
import { expect, it } from "vitest";
import { toDocx, type ReportData } from "./exporters";

// 1×1 PNG
const png = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));

it("puts the chart images into the Word report", async () => {
  const d: ReportData = {
    kpis: { total_users: 1 },
    users: { by_city: [{ label: "Depok", v: 1 }], by_gender: [], by_primary: [] },
    events: { by_category: [], by_city: [], free: 0, paid: 0, avg_fee: 0, avg_participants: 0, capacity: 0, participants: 0 },
    hobbies: { popular: [] },
    complaints: [],
    audit: [],
  };
  const blob = await toDocx(d, (k) => k, { period: "p", generated: "g" }, { users: [{ data: png, w: 400, h: 300 }], events: [{ data: png, w: 400, h: 300 }] });
  const zip = await JSZip.loadAsync(await blob.arrayBuffer());
  expect(Object.keys(zip.files).filter((f) => f.startsWith("word/media/"))).toHaveLength(2);
});
