import { describe, it, expect } from "vitest";
import { USERNAME_RE, normalizeSocial, socialUrl } from "./social";

describe("USERNAME_RE", () => {
  it("accepts valid usernames and rejects edge cases", () => {
    expect(USERNAME_RE.test("ben_putra")).toBe(true);
    expect(USERNAME_RE.test("abc")).toBe(true);   // 3 is the minimum length
    expect(USERNAME_RE.test("ab")).toBe(false);   // 2 is too short
    expect(USERNAME_RE.test("_bad")).toBe(false);   // can't start with _
    expect(USERNAME_RE.test("bad_")).toBe(false);   // can't end with _
    expect(USERNAME_RE.test("a")).toBe(false);      // too short
    expect(USERNAME_RE.test("Ben")).toBe(false);    // uppercase
  });
});

describe("normalizeSocial", () => {
  it("extracts a handle from a plain @handle or a full URL", () => {
    expect(normalizeSocial("instagram", "@ben")).toBe("ben");
    expect(normalizeSocial("instagram", "https://instagram.com/ben")).toBe("ben");
  });
  it("builds a profile URL from the stored value", () => {
    expect(socialUrl({ platform: "instagram", value: "ben" })).toBe("https://www.instagram.com/ben");
  });
});
