import { describe, expect, it } from "vitest";
import { activityWindows, relativeDay, spotsLeftToShow, weekendDates, weeklyDates } from "./events";

describe("relativeDay", () => {
  it("labels today and tomorrow, including across a month end", () => {
    expect(relativeDay("2026-10-31", "2026-10-31")).toBe("today");
    expect(relativeDay("2026-11-01", "2026-10-31")).toBe("tomorrow");
    expect(relativeDay("2026-11-02", "2026-10-31")).toBeNull();
    expect(relativeDay("2026-10-30", "2026-10-31")).toBeNull();
  });
});

describe("spotsLeftToShow", () => {
  it("shows 1-5 remaining spots only while joinable", () => {
    expect(spotsLeftToShow({ max_participants: 10, participant_count: 7 }, "open")).toBe(3);
    expect(spotsLeftToShow({ max_participants: 10, participant_count: 4 }, "open")).toBeNull();
    expect(spotsLeftToShow({ max_participants: 10, participant_count: 10 }, "full")).toBeNull();
    expect(spotsLeftToShow({ max_participants: 10, participant_count: 9 }, "ongoing")).toBeNull();
  });
});

describe("weekendDates", () => {
  it("finds the coming Saturday and Sunday", () => {
    expect(weekendDates("2026-10-01")).toEqual(["2026-10-03", "2026-10-04"]); // Thursday
    expect(weekendDates("2026-10-03")).toEqual(["2026-10-03", "2026-10-04"]); // Saturday
    expect(weekendDates("2026-10-04")).toEqual(["2026-10-04"]); // Sunday
    expect(weekendDates("2026-10-30")).toEqual(["2026-10-31", "2026-11-01"]); // across a month end
  });
});

describe("weeklyDates", () => {
  it("repeats every 7 days, across month ends", () => {
    expect(weeklyDates("2026-10-24", 3)).toEqual(["2026-10-24", "2026-10-31", "2026-11-07"]);
    expect(weeklyDates("2026-10-24", 1)).toEqual(["2026-10-24"]);
  });
});

describe("activityWindows", () => {
  const ev = { event_date: "2026-10-06", start_time: "19:00:00", end_time: "21:00" };
  it("opens QR check-in an hour before and closes an hour after", () => {
    expect(activityWindows(ev, "2026-10-06T17:59").qrOpen).toBe(false);
    expect(activityWindows(ev, "2026-10-06T18:00").qrOpen).toBe(true);
    expect(activityWindows(ev, "2026-10-06T22:00").qrOpen).toBe(true);
    expect(activityWindows(ev, "2026-10-06T22:01").qrOpen).toBe(false);
  });
  it("keeps attendance open 2 days and ratings 14 days after the end", () => {
    expect(activityWindows(ev, "2026-10-08T21:00").attendanceOpen).toBe(true);
    expect(activityWindows(ev, "2026-10-08T21:01").attendanceOpen).toBe(false);
    expect(activityWindows(ev, "2026-10-06T20:59").ratingOpen).toBe(false);
    expect(activityWindows(ev, "2026-10-20T21:00").ratingOpen).toBe(true);
    expect(activityWindows(ev, "2026-10-20T21:01").ratingOpen).toBe(false);
  });
});
