import { describe, expect, it } from "vitest";
import { relativeDay, spotsLeftToShow } from "./events";

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
