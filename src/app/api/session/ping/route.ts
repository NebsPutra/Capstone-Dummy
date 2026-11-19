import { NextResponse } from "next/server";

// Keep-alive for IdleTimeout: the proxy records the activity (or answers 401
// once the session has timed out); this route only has to exist.
export function POST() {
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
