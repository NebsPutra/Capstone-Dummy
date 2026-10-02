import { describe, expect, it } from "vitest";
import { relativeDay, spotsLeftToShow, weekendDates } from "./events";

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
