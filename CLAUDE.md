# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Komunitas: a mobile-first Next.js app for discovering, creating, and joining local social activities. Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 3, Supabase (Postgres + Auth + RLS), Leaflet/OpenStreetMap. Deploy target is Vercel.

## Commands

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build; also the main type-check
npx tsc --noEmit # type-check only
```

There is no test suite and no ESLint config. The `lint` script calls `next lint`, which Next.js 16 no longer ships, so use `npm run build` / `tsc` for verification.

Env: copy `.env.local.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. The DB schema lives in `supabase/schema.sql`, which is run manually in the Supabase SQL Editor (there is no migration tooling). `supabase/fix_rls_recursion.sql` is a one-off patch for projects created before the RLS fix; `schema.sql` already includes it. If you change the schema, update `schema.sql` and add a standalone patch SQL file for existing projects.

## Architecture

**Supabase clients.** Use `@/lib/supabase/server` in Server Components (async factory: `await createClient()`, since `cookies()` is async) and `@/lib/supabase/client` in Client Components. `src/middleware.ts` only refreshes the auth session cookie on every request; it does not guard routes.

**Auth gating.** Route protection happens in server layouts/pages, not middleware. `src/app/(app)/layout.tsx` redirects unauthenticated users to `/login` and renders the app shell (Sidebar, Header, MobileNav) for every page in the `(app)` route group. `src/app/admin/page.tsx` sits outside that group and does its own check (`profiles.role === 'admin'`).

**Username login on top of Supabase email auth.** Login and registration map a username to a fake email, `${username.toLowerCase()}@users.komunitas.app` (duplicated in `login/page.tsx` and `register/page.tsx`; keep them in sync). The real username lives in `profiles.username`. The `profiles` row is inserted client-side by the register page after `signUp`; there is no DB trigger for it.

**Authorization is RLS.** All access control is enforced by Postgres RLS policies in `schema.sql`; the app uses only the anon key. Policies that cross `events` and `event_participants` must go through the `security definer` helpers `is_event_owner()` / `is_event_participant()`. Referencing the other table directly in a policy causes infinite recursion.

**Logic in the database.** `event_code` and `share_token` are generated via `supabase.rpc("generate_event_code" | "generate_share_token")` in the create flow. `events.status` (open / almost_full / full) is maintained by the `trg_refresh_event_status` trigger on `event_participants`, so don't compute or write it from the app. `get_event_by_token()` exists for private-event access but has no page yet.

**Server vs client split.** Most pages are async Server Components that query Supabase directly. Interactive pieces are Client Components (`create`, `explore`, `settings`, `login`, `register`, the landing page, and widgets like `JoinPanel`, `ShareBox`, `ProfileEditor`). Leaflet cannot SSR. Load maps with `next/dynamic` and `ssr: false` from inside a Client Component (see `EventMapClient.tsx` wrapping `EventMap.tsx`, and `MapPicker` in `create/page.tsx`).

**i18n.** Client-side only: `LanguageProvider` (in the root layout) plus the `useLanguage().t(key)` hook, with English (`en`) and Indonesian (`id`) strings in `src/lib/i18n/translations.ts`. Missing keys fall back to English, then to the key itself. Because Server Components can't use the hook, translated text in server pages goes through small client components (e.g. `DashboardGreeting`, `ProfileStatLabel`). Add new keys to both languages.

**Location.** Geolocation is read live from the browser in `explore` and `create`; coordinates are intentionally not persisted to profiles (a privacy requirement). Distance sorting uses the haversine helper in `src/lib/utils.ts`. Indonesian region pickers (`LocationSelect`) fetch from the public emsifa wilayah static API via `src/lib/wilayah.ts`, which caches results in memory.

**Styling.** Design tokens (Orange/Cream palette, `ink` color, Plus Jakarta Sans via `--font-plus-jakarta`) are in `tailwind.config.ts`. Shared classes such as `card` and `ambient-gradient` are in `src/app/globals.css`. Path alias: `@/*` resolves to `src/*`.

## Known gaps (from README)

These are not built yet: the Edit Activity page (the RLS policy already exists), approve/reject actions on the Notifications page, admin moderation screens and a `reports` table, image uploads (the `banner_url` / `avatar_url` columns exist but there is no Storage bucket), and a `/join/[token]` page.
