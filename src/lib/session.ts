// Session timeout rules, shared by the proxy (server check) and IdleTimeout
// (client timer and warning). Supabase's own session time-boxing is a paid
// feature, so the app enforces these itself.

export const IDLE_LIMIT_MS = 30 * 60_000; // signed out after 30 minutes without activity
export const MAX_SESSION_MS = 7 * 24 * 60 * 60_000; // and always 7 days after signing in
export const WARN_BEFORE_MS = 60_000; // warning shown 1 minute before the idle sign-out

/** httpOnly cookie "<session id>.<last request ms>", written by the proxy. */
export const LAST_SEEN_COOKIE = "kom_seen";

export type SessionVerdict = "ok" | "idle" | "expired";

export function parseLastSeen(value: string | undefined): { sid: string; at: number } | null {
  const i = value?.lastIndexOf(".") ?? -1;
  if (!value || i < 1) return null;
  const at = Number(value.slice(i + 1));
  return Number.isFinite(at) ? { sid: value.slice(0, i), at } : null;
}

/**
 * startedAt: when this session signed in (ms), from the JWT "amr" claim.
 * A last-seen cookie from a different session (e.g. a new sign-in) is ignored.
 */
export function checkSession(o: { now: number; sessionId?: string; startedAt?: number; lastSeen: { sid: string; at: number } | null }): SessionVerdict {
  if (o.startedAt && o.now - o.startedAt > MAX_SESSION_MS) return "expired";
  if (o.sessionId && o.lastSeen?.sid === o.sessionId && o.now - o.lastSeen.at > IDLE_LIMIT_MS) return "idle";
  return "ok";
}

/** Session id and sign-in time from an access token the caller has already verified. */
export function sessionClaims(accessToken: string): { sessionId?: string; startedAt?: number } {
  try {
    const b64 = accessToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(b64)) as { session_id?: string; amr?: { timestamp?: number }[] };
    const stamps = (claims.amr ?? []).map((a) => a.timestamp).filter((t): t is number => typeof t === "number");
    return { sessionId: claims.session_id, startedAt: stamps.length ? Math.min(...stamps) * 1000 : undefined };
  } catch {
    return {};
  }
}
