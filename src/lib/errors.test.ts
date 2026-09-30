import { describe, it, expect, vi, beforeEach } from "vitest";
import { friendlyErrorKey, otpErrorKey } from "./errors";

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));

describe("friendlyErrorKey", () => {
  it("maps known SQL domain codes, including the ones added in errors fix", () => {
    expect(friendlyErrorKey({ message: "EVENT_FULL" })).toBe("err.EVENT_FULL");
    expect(friendlyErrorKey({ message: "INVALID_STATUS" })).toBe("err.INVALID_STATUS");
    expect(friendlyErrorKey({ message: "INVALID_ROLE" })).toBe("err.INVALID_ROLE");
    expect(friendlyErrorKey({ message: "FIELD_NOT_EDITABLE: full_name" })).toBe("err.FIELD_NOT_EDITABLE");
  });
  it("prefers the longest matching code (MESSAGES_NOT_ALLOWED, not NOT_ALLOWED)", () => {
    expect(friendlyErrorKey({ message: "MESSAGES_NOT_ALLOWED" })).toBe("err.MESSAGES_NOT_ALLOWED");
    expect(friendlyErrorKey({ message: "NOT_ALLOWED" })).toBe("err.NOT_ALLOWED");
  });
  it("detects network and rate-limit errors", () => {
    expect(friendlyErrorKey({ message: "Failed to fetch" })).toBe("err.network");
    expect(friendlyErrorKey({ name: "AuthRetryableFetchError" })).toBe("err.network");
    expect(friendlyErrorKey({ status: 429 })).toBe("auth.tooManyRequests");
    expect(friendlyErrorKey({ code: "over_email_send_rate_limit" })).toBe("auth.tooManyRequests");
  });
  it("falls back to the generic key for unknown / empty errors", () => {
    expect(friendlyErrorKey({ message: "some random postgres text" })).toBe("err.generic");
    expect(friendlyErrorKey(null)).toBe("err.generic");
  });
});

describe("otpErrorKey", () => {
  it("distinguishes expiry, rate limit, network and incorrect", () => {
    expect(otpErrorKey({ status: 429 })).toBe("auth.tooManyRequests");
    expect(otpErrorKey({ message: "network down" })).toBe("err.network");
    expect(otpErrorKey({ code: "otp_expired", message: "Token has expired" })).toBe("auth.codeExpired");
    expect(otpErrorKey({ message: "Token has expired or is invalid" })).toBe("auth.codeIncorrect");
  });
});
