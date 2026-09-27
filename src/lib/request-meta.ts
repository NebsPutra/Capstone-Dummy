import "server-only";
import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { deviceLabel } from "./device";

/**
 * A salted hash of the caller's network address, used to throttle PIN
 * attempts per network. The raw IP is never stored.
 */
export function clientHash(req: NextRequest): string {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
  const salt = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

export function requestDevice(req: NextRequest): string {
  return deviceLabel(req.headers.get("user-agent"));
}
