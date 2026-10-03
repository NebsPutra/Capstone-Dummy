import { describe, expect, it } from "vitest";
import { googleCalendarUrl, icsCalendar, icsDataUrl, jakartaToUtcStamp } from "./calendar";

const ev = {
  id: "abc",
  title: "Run, then coffee; together",
  description: "Line one\nLine two",
  location: "GBK, Jakarta",
  date: "2026-10-06",
  start: "19:00",
  end: "21:00:00",
  url: "https://komunitasa.vercel.app/activities/abc",
};

describe("calendar links", () => {
  it("converts Jakarta time to UTC, across midnight", () => {
    expect(jakartaToUtcStamp("2026-10-06", "19:00")).toBe("20261006T120000Z");
    expect(jakartaToUtcStamp("2026-10-06", "06:00:00")).toBe("20261005T230000Z");
  });

  it("builds a Google Calendar link with the UTC range", () => {
    const url = new URL(googleCalendarUrl(ev));
    expect(url.searchParams.get("dates")).toBe("20261006T120000Z/20261006T140000Z");
    expect(url.searchParams.get("text")).toBe(ev.title);
  });

  it("escapes commas, semicolons and newlines in the .ics file", () => {
    const body = decodeURIComponent(icsDataUrl(ev).split(",").slice(1).join(","));
    expect(body).toContain("SUMMARY:Run\\, then coffee\\; together");
    expect(body).toContain("DESCRIPTION:Line one\\nLine two");
    expect(body).toContain("DTSTART:20261006T120000Z");
  });
});

describe("icsCalendar", () => {
  it("puts several activities in one calendar and marks cancelled ones", () => {
    const body = icsCalendar([ev, { ...ev, id: "def", cancelled: true }], "My Komunitas");
    expect(body.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(body).toContain("X-WR-CALNAME:My Komunitas");
    expect(body).toContain("UID:def@komunitas\r\n");
    expect(body.split("STATUS:CANCELLED")).toHaveLength(2);
  });
});
