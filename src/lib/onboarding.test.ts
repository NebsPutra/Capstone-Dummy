import { describe, expect, it } from "vitest";
import { safeNext } from "./onboarding";

describe("safeNext", () => {
  it("keeps same-site paths, with query and hash", () => {
    expect(safeNext("/activities/abc?t=JOIN-1#x")).toBe("/activities/abc?t=JOIN-1#x");
  });

  it("rejects anything that leaves the site", () => {
    for (const next of ["//evil.com", "/\\evil.com", "/\\/evil.com", "/\t/evil.com", "https://evil.com", "evil.com", "", null]) {
      expect(safeNext(next)).toBe("/dashboard");
    }
  });
});
