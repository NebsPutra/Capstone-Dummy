import { describe, expect, it } from "vitest";
import { IDLE_LIMIT_MS, MAX_SESSION_MS, checkSession, parseLastSeen, sessionClaims } from "./session";

const now = Date.UTC(2026, 10, 19, 12);
const sid = "8f0c1e2a-0000-4000-8000-000000000001";

describe("checkSession", () => {
  it("keeps an active session", () => {
    expect(checkSession({ now, sessionId: sid, startedAt: now - 3600_000, lastSeen: { sid, at: now - 60_000 } })).toBe("ok");
  });
  it("signs out after 30 idle minutes", () => {
    expect(checkSession({ now, sessionId: sid, startedAt: now - 3600_000, lastSeen: { sid, at: now - IDLE_LIMIT_MS - 1 } })).toBe("idle");
  });
  it("ignores a stale cookie from another session (fresh sign-in)", () => {
    expect(checkSession({ now, sessionId: sid, startedAt: now, lastSeen: { sid: "other", at: now - 86400_000 } })).toBe("ok");
  });
  it("signs out 7 days after signing in, even when active", () => {
    expect(checkSession({ now, sessionId: sid, startedAt: now - MAX_SESSION_MS - 1, lastSeen: { sid, at: now } })).toBe("expired");
  });
});

it("parses the last-seen cookie", () => {
  expect(parseLastSeen(`${sid}.1700000000000`)).toEqual({ sid, at: 1700000000000 });
  expect(parseLastSeen("garbage")).toBeNull();
  expect(parseLastSeen(undefined)).toBeNull();
});

it("reads session id and sign-in time from the token", () => {
  const payload = btoa(JSON.stringify({ session_id: sid, amr: [{ method: "otp", timestamp: 1700000100 }, { method: "password", timestamp: 1700000000 }] }));
  expect(sessionClaims(`x.${payload.replace(/=+$/, "")}.y`)).toEqual({ sessionId: sid, startedAt: 1700000000000 });
  expect(sessionClaims("not-a-token")).toEqual({});
});
