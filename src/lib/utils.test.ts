import { describe, it, expect } from "vitest";
import { distanceKm, toFee, formatFee, parseRupiahInput, eventStamp } from "./utils";

describe("distanceKm (haversine)", () => {
  it("is zero for identical points", () => {
    expect(distanceKm(-6.2, 106.8, -6.2, 106.8)).toBe(0);
  });
  it("approximates 1° of longitude at the equator (~111 km)", () => {
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.19, 0);
  });
  it("is symmetric", () => {
    const a = distanceKm(-6.17, 106.82, -6.9, 107.6);
    const b = distanceKm(-6.9, 107.6, -6.17, 106.82);
    expect(a).toBeCloseTo(b, 6);
  });
});

describe("toFee", () => {
  it("coerces strings, floors negatives/invalid to 0, rounds", () => {
    expect(toFee("25000")).toBe(25000);
    expect(toFee(25000.6)).toBe(25001);
    expect(toFee(-5)).toBe(0);
    expect(toFee(null)).toBe(0);
    expect(toFee("abc")).toBe(0);
  });
});

describe("formatFee", () => {
  it("shows Free/Gratis at zero and Rupiah otherwise", () => {
    expect(formatFee(0, "en")).toBe("Free");
    expect(formatFee(0, "id")).toBe("Gratis");
    expect(formatFee(25000, "id")).toBe("Rp25.000");
  });
});

describe("parseRupiahInput", () => {
  it("keeps digits only", () => {
    expect(parseRupiahInput("Rp 25.000")).toBe(25000);
    expect(parseRupiahInput("25,000")).toBe(25000);
    expect(parseRupiahInput("")).toBe(0);
  });
});

describe("eventStamp", () => {
  it("builds a sortable date+time stamp and trims seconds", () => {
    expect(eventStamp("2026-09-30", "18:30:00")).toBe("2026-09-30T18:30");
    expect(eventStamp("2026-01-05", "07:00")).toBe("2026-01-05T07:00");
  });
});
