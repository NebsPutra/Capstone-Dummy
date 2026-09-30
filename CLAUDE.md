# Komunitas — Capstone Project (A Team)

Mobile-first web app for discovering, creating and joining local social activities (running, reading, cycling, badminton, basketball, gatherings). Group project for a university thesis program. Live at https://komunitasa.vercel.app. See README.md for the full feature/spec map and the Supabase setup.

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 3 · Supabase (Postgres, Auth, RLS) · Leaflet/OSM · Vercel.

## Commands
- `npm run dev` starts http://localhost:3000
- `npm run lint` runs ESLint 9 (flat config in `eslint.config.mjs`). There should be 0 errors. `react-hooks/set-state-in-effect` is set to warn on purpose, because existing effects rely on it.
- `npx tsc --noEmit` runs the type check
- `npm run build` does a production build. Run it before any deploy.
- `npm test` runs the Vitest unit tests for the pure logic in `src/lib` (`*.test.ts`). `npm run test:watch` watches.

## Deploying (git-triggered: pushing to `main` deploys to production)
- The Vercel project `alexios3/capstone-dummy` is connected to GitHub. **Every push to `main` goes live** at https://komunitasa.vercel.app automatically.
- So treat a push like a deploy: run lint, tsc and build first, and only push when the user asks.
- `vercel deploy --prod` (project already linked in `.vercel/`) still works for a manual redeploy, but isn't needed after a push.

## Environment & data
- `.env.local` holds **production** values pulled with `vercel env pull`. Local dev talks to the **live** Supabase database, so be careful with writes.
- `SUPABASE_SERVICE_ROLE_KEY` is marked Sensitive in Vercel and can't be pulled. It's entered by hand. Never prefix it with `NEXT_PUBLIC_`, and never commit env files (`.env*` is gitignored).
- DB changes go in new files under `supabase/migrations/NNN_*.sql`. They must be idempotent and are run by hand in the Supabase SQL editor, in order.

## Conventions
- UI strings live in `src/lib/i18n/translations*.ts`, in English and Indonesian. The `id` dictionary is type-checked against the `en` keys, so add every new key to both.
- Design tokens are the Orange/Cream CSS variables in `src/app/globals.css` (`--cream`, `--orange`, `--orange-dark`, `--ink`) with Tailwind classes `cream`, `orange`, `ink`, `surface`. Font: Plus Jakarta Sans.
- Authorization is enforced in the database (RLS + `security definer` functions), not only in the UI.
- Supabase clients: `src/lib/supabase/` (browser and server).

## Other folders
- `flyer/` holds the marketing assets: the A Team logo, flyers, the slide deck, and the scripts that regenerate them (see `flyer/README.md`).
- `docs/setup-log-2026-09-28.md` records how this machine and project were set up, and what changed in the security upgrade.
