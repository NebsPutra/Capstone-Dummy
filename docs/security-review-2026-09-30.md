# Security Review — Komunitas

**Date:** 2026-09-30
**Scope:** Static (read-only) review of the Komunitas web application — Supabase RLS policies, `security definer` SQL functions, the Next.js API routes, and client-side trust boundaries. No dynamic scanning or exploitation was run, and no live data was touched.
**Reviewer:** A Team (static review, Claude Code assisted)
**Commit reviewed:** `db0acda` and the working tree on `main`.

---

## 1. Summary

Komunitas enforces authorization **in the database** (Postgres RLS + `security definer` functions), not only in the UI. This is the correct design for a Supabase app: even if the frontend or the anon API key is misused, the database refuses unauthorized reads and writes. The review found **no critical or high-severity issues** — no authentication bypass, no privilege escalation, no injection, and no exposure of the service-role key.

Three **low-severity hardening gaps** were found. One (missing HTTP security headers) has been fixed as part of this review; the other two are documented with recommendations.

| # | Finding | Severity | Status |
|---|---------|----------|--------|
| 1 | No HTTP security headers (CSP, X-Frame-Options, HSTS, …) | Low–Medium | **Fixed** |
| 2 | Account enumeration on PIN-recovery start | Low | **Fixed** |
| 3 | Thin app-level rate limiting on the recovery route | Low | **Fixed** |

---

## 2. What was reviewed

- **31 tables** with Row Level Security enabled.
- **142 `security definer` functions** across migrations `002`–`012`.
- **6 server API routes:** PIN login, PIN-recovery start/verify, account deletion, complaint notification, security notification.
- **Client trust boundaries:** HTML injection sinks, secret exposure, service-role isolation.

---

## 3. Strengths (controls confirmed working)

**Authorization lives in the database.**
Direct `insert`/`update`/`delete` on `messages`, `conversations`, `conversation_members`, and other sensitive tables is **revoked** from the `anon` and `authenticated` roles. All writes go through `security definer` RPCs that re-check membership, blocks, and admin rank. A stolen anon key cannot write directly to these tables.

**`search_path` is pinned on every `security definer` function.**
All 142 functions set `search_path = public`. This closes the classic Postgres privilege-escalation vector where an attacker plants a same-named object in an earlier schema on the search path.

**The service-role key is properly isolated.**
`src/lib/supabase/admin.ts` begins with `import "server-only"`, so any accidental client import is a build-time error. The key has no `NEXT_PUBLIC_` prefix and is referenced only in the 6 server routes. It never reaches the browser bundle.

**Ownership cannot be spoofed.**
- Events: RLS `with check (auth.uid() = creator_id and is_onboarded())`.
- Storage: banner uploads are constrained to `(storage.foldername(name))[1] = auth.uid()` — a user can only write inside their own UID folder; no path traversal into another user's folder.
- Profiles: the `profiles_guard` trigger forces `role`, `account_status`, and `username` back to their old values for non-admins, so users cannot elevate themselves or change protected columns.

**PIN authentication is defensive.**
`verify_login_pin` (service-role only) does a bcrypt compare, enforces per-account lockout and a per-network throttle, and the PIN is never logged, stored in plaintext, or returned. On success the session is minted server-side via a one-time magic-link token (no email sent), so the browser only ever receives a normal Supabase session.

**No injection surface.**
- No dynamic SQL (`execute format(...)`) built from user input in any function.
- The only `dangerouslySetInnerHTML` in the client is a static theme-flash guard script (`THEME_BOOT_SCRIPT`), not user data.
- Complaint-notification emails HTML-escape every interpolated field via an `esc()` helper.

**Least-privilege data reads.**
Migration `007` revokes broad `select` on `profiles` and re-grants only `id, username, nickname, avatar_url` to other users; everything else (full name, WhatsApp, age, exact area) is reachable only through the `my_profile` view (own row) or the privacy-aware social functions.

---

## 4. Findings

### 4.1 — No HTTP security headers *(Low–Medium)* — FIXED

**Before:** `next.config.js` sent no `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, or `Strict-Transport-Security`. This meant no explicit clickjacking protection and no CSP backstop limiting where scripts/connections may load from.

**Fix (this review):** `next.config.js` now returns a security-header set on every route:

- **Content-Security-Policy** — `default-src 'self'` with an allow-list matched to the app's real dependencies: `*.supabase.co` (REST/Auth/Storage + `wss:` realtime), `*.tile.openstreetmap.org` (Leaflet map tiles), and `nominatim.openstreetmap.org` / `www.emsifa.com` (geocoding and Indonesian region lookup). Fonts (`next/font`) and Leaflet markers are self-hosted, so both are `'self'`.
- **X-Frame-Options: DENY** and `frame-ancestors 'none'` — blocks clickjacking.
- **X-Content-Type-Options: nosniff**, **Referrer-Policy: strict-origin-when-cross-origin**.
- **Permissions-Policy** — `geolocation=(self)` (the "activities near me" feature needs it); camera, microphone, payment, and USB are denied.
- **Strict-Transport-Security** — two-year `max-age`, `includeSubDomains`, `preload`.

**Known limitation (documented in the config):** `script-src` keeps `'unsafe-inline'` because Next's App Router emits inline bootstrap scripts and the theme-flash guard is inline. A future hardening step is a nonce-based CSP generated in middleware, which would let `'unsafe-inline'` be dropped. In development only, the policy also allows `'unsafe-eval'` and a `ws://localhost:*` connection so Next's hot-reload and React's dev tooling work; **production stays strict** (no `'unsafe-eval'`, no `ws:`). Verified: production build serves the strict header; the dev relaxations apply only under `next dev`.

### 4.2 — Account enumeration on PIN-recovery start *(Low)* — FIXED

`POST /api/auth/pin-recovery/start` returns `404 { reason: "not_found" }` when the submitted email/username has no account, and `200` when it does. An attacker can therefore probe which emails or usernames are registered.

**Fix (this review):** the route now returns `200 { ok: true }` for any well-formed identifier and only actually sends a code when the account exists, so the response no longer reveals which accounts are registered. The forgot-PIN screen shows a neutral "if an account exists, we've sent a code to its email" message instead of the masked address.

### 4.3 — Thin app-level rate limiting on the recovery route *(Low)* — FIXED

`verify_login_pin` has its own per-network throttle, which is good. The PIN-recovery **start** route, however, relies entirely on Supabase's built-in OTP send limits. There is no additional per-IP throttle in the application layer, so the route's abuse ceiling is whatever Supabase permits.

**Fix (this review):** migration `013_recovery_rate_limit.sql` adds `rate_limit_recovery(p_client)`, a service-role function that caps recovery requests at 5 per network per 15 minutes, reusing the same hashed-network `security_events` counter as PIN login. The route calls it before sending and returns `429` when the limit is hit. (Until the migration is applied the route still works, just without the extra throttle.)

---

## 5. Notes and scope limits

- **This was a static review.** It reads the code and policies; it does not prove runtime behavior under every input. RLS and the `security definer` functions were read carefully, but a full assurance would also include integration tests that assert each policy denies the cases it should.
- **Autonomous scanners were deliberately not run.** Because local development connects to the **live production Supabase database** (`.env.local` holds production values), running an exploitation tool such as Strix against `localhost` or the live site was rejected as unsafe: it would act on real user data. The correct setup for dynamic testing is a separate throwaway Supabase project seeded with fake data; that remains a possible future step. For this app, where authorization is concentrated in the SQL layer, a black-box scanner would also miss most of the real attack surface that this static review covered.
- **Not in scope:** third-party dependency CVE audit (`npm audit`), Supabase project-level settings (auth providers, JWT expiry, storage bucket public/private flags as configured in the dashboard), and email-deliverability/SPF/DKIM.

---

## 6. Recommended next steps

1. **Done —** security headers (4.1), neutral PIN-recovery response (4.2), and recovery rate limit (4.3) are all applied.
2. **Run migration `013_recovery_rate_limit.sql`** by hand in the Supabase SQL editor to activate the recovery throttle.
3. After deploy, verify the headers on production (e.g. `curl -I https://komunitasa.vercel.app`).
4. Run `npm audit` and review Supabase dashboard auth/storage settings (out of scope here).
5. Optional, later: nonce-based CSP to drop `'unsafe-inline'` from `script-src`.
