import { describe, expect, it } from "vitest";
import { isGuestPath } from "./guest";

describe("isGuestPath", () => {
  it("opens browsing pages to guests but keeps editing and the rest private", () => {
    for (const p of ["/explore", "/activities/abc", "/join/JOIN-7X82KD", "/event/abc", "/event/code/RUN-KEM-8F72"]) {
      expect(isGuestPath(p)).toBe(true);
    }
    for (const p of ["/activities/abc/edit", "/dashboard", "/create", "/explore/x/y", "/messages"]) {
      expect(isGuestPath(p)).toBe(false);
    }
  });
});
