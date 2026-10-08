# Effendy Family

Private family app (PWA) for Rialto and Amnah: money, time, goals and life in one place.

- Design source of truth: [`docs/design/`](docs/design/README.md) (prototype, data model, roadmap).
- Current phase plan: [`docs/RENCANA-TAHAP-0.md`](docs/RENCANA-TAHAP-0.md).

## Stack
Next.js (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Frankfurt, `eu-central-1`) · Vercel (`fra1`) · lucide-react · Geist.

## Run locally
```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```

## Database
- Migrations: `supabase/migrations/` (applied to the Supabase project in order).
- Access-rule checks: run `supabase/tests/access_rules.sql` in the Supabase SQL editor
  once both accounts exist. Every check must return `ok = true`.
- New sign-in accounts join the single household automatically (max 2 members).
  Public sign-up must stay switched off in Supabase → Authentication → Sign In / Providers.

## Offline
`public/sw.js` caches every page and its static files on first visit. Its `PAGES`
list must match the routes in `src/lib/nav.ts`.
