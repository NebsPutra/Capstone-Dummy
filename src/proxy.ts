import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isGuestPath } from "@/lib/guest";
import { LAST_SEEN_COOKIE, MAX_SESSION_MS, checkSession, parseLastSeen, sessionClaims } from "@/lib/session";

// Pages that require a signed-in user. Unauthenticated visitors are sent to
// /login?next=<original path> so invite links (/join/…, /event/code/…)
// still land on the right activity after signing in.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/create",
  "/explore",
  "/activities",
  "/my-activities",
  "/community",
  "/notifications",
  "/profile",
  "/settings",
  "/admin",
  "/join",
  "/event",
  "/help",
  "/u",
  "/messages",
  "/groups",
  "/present",
  "/players",
  "/account-suspended",
];

export async function proxy(request: NextRequest) {
  // Server layouts read x-pathname (e.g. suspended users may still open /help).
  const headers = new Headers(request.headers);
  headers.set("x-pathname", request.nextUrl.pathname);
  let response = NextResponse.next({ request: { headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // getAll/setAll keeps every cookie of a refresh or sign-out (the auth
      // token can be split over several cookies).
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  // Session timeout: 30 minutes idle or 7 days after signing in (src/lib/session.ts).
  if (user) {
    const { data: { session } } = await supabase.auth.getSession(); // token just verified by getUser()
    const { sessionId, startedAt } = session ? sessionClaims(session.access_token) : {};
    const lastSeen = parseLastSeen(request.cookies.get(LAST_SEEN_COOKIE)?.value);
    const now = Date.now();
    const verdict = checkSession({ now, sessionId, startedAt, lastSeen });
    if (verdict !== "ok") {
      await supabase.auth.signOut({ scope: "local" }); // ends this session only
      const out = pathname.startsWith("/api/")
        ? NextResponse.json({ error: "session_expired" }, { status: 401 })
        : NextResponse.redirect(new URL(`/login?expired=${verdict}&next=${encodeURIComponent(pathname + search)}`, request.url));
      response.cookies.getAll().forEach((c) => out.cookies.set(c));
      out.cookies.delete(LAST_SEEN_COOKIE);
      return out;
    }
    // Activity = any request. Rewritten at most once a minute.
    if (sessionId && (lastSeen?.sid !== sessionId || now - lastSeen.at > 60_000)) {
      response.cookies.set(LAST_SEEN_COOKIE, `${sessionId}.${now}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: MAX_SESSION_MS / 1000,
      });
    }
  }
  // Guest paths (Explore, activity details, invite links) render a read-only
  // view for logged-out visitors; see src/lib/guest.ts.
  const isProtected =
    !isGuestPath(pathname) && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
