# Komunitas — Community Social Activity Platform

A mobile-first web app for discovering, creating, and joining local social
activities (running, reading, cycling, badminton, basketball, community
gatherings, and more). Built as an MVP prototype per the product spec.

## Stack

- **Next.js 16 (App Router) + React 19 + TypeScript**
- **Tailwind CSS** — warm Orange/Cream design system
- **Supabase** — Postgres, Auth, Row Level Security
- **Leaflet + OpenStreetMap** — maps, no API key required
- **Vercel** — deployment target

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open the SQL Editor and run the contents of `supabase/schema.sql`. This
   creates all tables, enums, RLS policies, and helper functions
   (`generate_event_code`, `generate_share_token`, event-status triggers).
3. In **Project Settings → API**, copy the Project URL and anon public key.

## 2. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

## 3. Install and run

```bash
npm install
npm run dev
```

Visit `http://localhost:3000`.

## 4. Deploy

Push to GitHub, then import the repo in Vercel. Add the same two
environment variables in the Vercel project settings. Vercel auto-detects
Next.js — no extra build config needed.

---

## How the spec maps to this codebase

| Spec section | Implementation |
|---|---|
| §2–3 Auth & Registration | `src/app/login`, `src/app/register`. Username+password UX on top of Supabase Auth — see note below. |
| §4–5 Interests & Profile | `interests` / `user_interests` tables, `src/app/(app)/profile` |
| §6–8 Design system | `tailwind.config.ts`, `globals.css` — Orange/Cream tokens, Plus Jakarta Sans |
| §9 Layout / nav | `src/components/Sidebar.tsx` (collapsible), `MobileNav.tsx` (bottom nav on mobile) |
| §10 Landing page | `src/app/page.tsx` |
| §11 Dashboard | `src/app/(app)/dashboard` — nearby / upcoming / ongoing / recommended sections |
| §12–13 GPS & privacy | Browser Geolocation API in `explore` and `create`; coordinates are **not** persisted to the profile by default (see below) |
| §14 Map | `MapPicker.tsx` (create flow), `EventMap.tsx` (read-only, event details) |
| §15–17 Create Activity | `src/app/(app)/create` |
| §18–19 Privacy / event codes | `event_code`, `share_token` generated server-side via Postgres functions; public/private + open/approval-required join logic |
| §20 Sharing | `ShareBox.tsx` — copy link, WhatsApp, QR code |
| §21 Edit event | Creator-only RLS policy is in place; edit UI is the one page not yet built (see Known gaps) |
| §22–23 Explore / nearby search | `src/app/(app)/explore` — search, category/time/price/distance filters, haversine distance sort |
| §24 Event details | `src/app/(app)/activities/[id]` |

### Username + password on Supabase Auth

Supabase Auth is email/password by default. To keep the "username only"
login experience from the spec while staying on Supabase Auth (no custom
auth server), usernames are mapped to a synthetic address:
`username@users.komunitas.app`. The real username is stored in
`profiles.username`. This is intentionally swappable — see §2's note about
expanding to email/phone/OTP/social login later; you'd replace this mapping
with real email capture at that point.

### Location privacy

Per §13, precise coordinates are **not** permanently stored by default —
the browser's live geolocation is used at request time in `explore` and
`create`. `profiles.last_lat` / `last_lng` exist in the schema if you want
to opt into caching a coarse last-known location for faster dashboard
loads, but nothing currently writes to them.

## Known gaps / next steps

This prototype covers the primary participant flow end-to-end. Not yet
built, flagged here rather than left silently missing:

- **Edit Activity** page (RLS already restricts updates to the creator —
  just needs a form reusing the Create Activity layout)
- **Admin moderation** — Users, Areas, Reports, Categories management
  screens (Admin Dashboard with live stats is in place; a `reports` table
  isn't modeled yet)
- **Approval queue actions** — the Notifications page lists pending join
  requests but the approve/reject buttons aren't wired up yet (the
  `event_participants.status` update is a single Supabase call away)
- **Image uploads** (banner, avatar) — Supabase Storage bucket isn't
  configured; `banner_url` / `avatar_url` columns are ready for it
- **Private event access via code/token** — `get_event_by_token()` SQL
  function exists but there's no `/join/[token]` page consuming it yet

## Project structure

```
src/
  app/
    page.tsx                  Landing page
    login/, register/         Auth
    (app)/                    Authenticated shell (sidebar + header + mobile nav)
      dashboard/
      explore/
      create/
      activities/[id]/
      profile/
      my-activities/
      community/
      notifications/
      settings/
    admin/                    Admin dashboard
  components/                 Shared UI (cards, map, nav, join/share widgets)
  lib/supabase/               Browser + server Supabase clients
  lib/utils.ts                Distance, date, currency formatting
  types/                      Shared TypeScript types
supabase/schema.sql           Full DB schema + RLS policies
```
