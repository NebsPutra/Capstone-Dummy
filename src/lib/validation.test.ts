import { describe, it, expect } from "vitest";
import { isValidAge, isValidEmail, isStrongPassword, normalizeEmail, normalizeWhatsapp, whatsappDigits, AGE_MIN, AGE_MAX } from "./validation";

describe("isValidAge", () => {
  it("accepts the inclusive 13–100 range", () => {
    expect(isValidAge(AGE_MIN)).toBe(true);
    expect(isValidAge(AGE_MAX)).toBe(true);
    expect(isValidAge(30)).toBe(true);
  });
  it("rejects out-of-range, non-integer and non-finite values", () => {
    expect(isValidAge(12)).toBe(false);
    expect(isValidAge(101)).toBe(false);
    expect(isValidAge(30.5)).toBe(false);
    expect(isValidAge(NaN)).toBe(false);
  });
});

describe("normalizeEmail / isValidEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ben@Example.COM ")).toBe("ben@example.com");
  });
  it("validates shape", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("no-at")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});

describe("isStrongPassword", () => {
  it("needs 8+ chars with a letter and a digit", () => {
    expect(isStrongPassword("abcd1234")).toBe(true);
    expect(isStrongPassword("short1")).toBe(false);   // too short
    expect(isStrongPassword("allletters")).toBe(false); // no digit
    expect(isStrongPassword("12345678")).toBe(false);  // no letter
  });
});

describe("normalizeWhatsapp", () => {
  it("normalizes Indonesian mobile forms to +62…", () => {
    expect(normalizeWhatsapp("081234567890")).toBe("+6281234567890");
    expect(normalizeWhatsapp("6281234567890")).toBe("+6281234567890");
    expect(normalizeWhatsapp("+62 812-3456-7890")).toBe("+6281234567890");
  });
  it("rejects non-mobile / malformed numbers", () => {
    expect(normalizeWhatsapp("021555111")).toBeNull(); // landline, not 08x
    expect(normalizeWhatsapp("12345")).toBeNull();
    expect(normalizeWhatsapp("")).toBeNull();
  });
  it("whatsappDigits keeps only digits", () => {
    expect(whatsappDigits("+6281234567890")).toBe("6281234567890");
  });
});
