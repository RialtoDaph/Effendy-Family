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
- Access-rule checks: run `supabase/tests/access_rules.sql` (members) and
  `supabase/tests/money_rules.sql` (Private/Family, recurring posting) and
  `supabase/tests/money_complete_rules.sql` (debts, assets, transfers, files) and
  `supabase/tests/reminders_rules.sql` (what reminders go out, to whom, once) in the Supabase
  SQL editor. Every check must return `ok = true`. All of them roll back; nothing is kept.
- Recurring items are posted by `private.post_recurring()`, run hourly by pg_cron
  (does nothing before 05:00 Europe/Berlin).

## Tests
`npm test` runs the unit tests (Vitest): money and finance rules, the PIN hash, and the
Web Push encryption in `supabase/functions/push/webpush.test.ts`.

## Files
Business reports live in the private Supabase Storage bucket `files`, path
`<household_id>/<owner_id>/<name>`. An object can only be read when its `files` row is
visible to the reader, so Private files stay private.
- New sign-in accounts join the single household automatically (max 2 members).
  Public sign-up must stay switched off in Supabase → Authentication → Sign In / Providers.

## Offline
`public/sw.js` caches every page and its static files on first visit. Its `PAGES`
list must match the routes in `src/lib/nav.ts`.
Changes saved without internet wait in IndexedDB (`src/lib/offline-queue.ts`) and are
sent when the connection is back; the header shows how many wait.

## Reminders (Web Push)
- `supabase/functions/push` (Edge Function, deployed with JWT check off; it checks
  sign-in itself for the test action). pg_cron calls it every 15 minutes with
  `{"action":"run"}`; it sends what `private.push_due()` returns. Each reminder is logged in
  `private.push_log`, so nothing is sent twice.
- The VAPID key pair is created by the function on first use and kept in
  `private.push_keys`. Nobody has to copy keys anywhere.
- Each phone's subscription is in `push_subscriptions`, saved through
  `save_push_subscription()`. Signing out removes this phone's subscription.
- iPhone: iOS 16.4+ and the app opened from the Home Screen.
