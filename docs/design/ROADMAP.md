# Build roadmap: every feature is in, delivered in 6 phases

Each phase ships something you can use every day. Don't start the next phase until the current one's checks all pass on a real phone (iPhone Safari installed to the Home Screen, and Android Chrome).

## Phase 0: Foundation (about 1 week)
- Next.js + Tailwind + Supabase (EU) + Vercel (fra1). Design tokens from the README as Tailwind theme and CSS variables. Light, dark and auto themes.
- Auth: email + password, plus passkey sign-in. One household, 2 members.
- App shell: sidebar on desktop, header + bottom tabs + FAB on mobile, More page, command palette, toast, bottom-sheet form component (generic field kinds).
- PWA: manifest, icons, service worker (app shell), "Offline" pill, install button / iOS steps.
- Settings: Appearance, Members, Export/Import JSON backup.
- **Checks:**
  - Installs to the Home Screen.
  - Opens offline and shows the shell.
  - Both people can sign in.
  - No horizontal scroll at 360px.

## Phase 1: Money core
- Categories (fixed/flexible, limits), transactions (manual add/edit/delete), the **Private / Family** field everywhere, RLS on.
- Budget page, the full version. Home: stats, briefing (template text, no AI yet), 3 things, goals.
- **Recurring** + daily cron.
- Alerts center (computed), warning threshold, emergency fund.
- Setup checklist (onboarding for empty data).
- **Checks:**
  - A private transaction is invisible to the partner, including in totals.
  - A recurring item posts exactly once a month.
  - The budget statuses match the rules.

## Phase 2: Money complete
- Debts with the payoff simulation; Subscriptions; Goals (Private/Family); **To Indonesia** (EUR + IDR); **Business monthly totals + file upload** (PDF/CSV/Excel to Storage); Taxes & refund fed from the business months.
- Invest overview (manual asset values; IDR converted at the saved rate).
- **Checks:**
  - Remittance maths matches the README.
  - Business files open from their row.
  - Net worth = assets − debts.

## Phase 3: Capture, security, reminders
- **Bank import, any bank:** CSV column mapper (saved per bank), PDF via Claude, dedupe hash, merchant rules, flagged review.
- **Receipt scan** via Claude vision. Always confirm before saving.
- **PIN + passkey lock**, auto-lock, Forgot PIN through re-login.
- **Web Push:** per-type toggles, morning summary, test button.
- Offline write queue (IndexedDB) + sync.
- **Checks:**
  - Import a real Sparkasse CSV and one other bank's file without duplicates.
  - Push arrives with the app closed on iOS 16.4+ installed.
  - Wrong-PIN backoff works.

## Phase 4: Time & life
- This week board, Shifts (plus roster photo read via Claude), Yearly goals with the 52-week strip, Learning, Gym, Journal (private by default), Date nights + ideas.
- Shift and calendar reminders.
- **Check:** a shift reminder fires 2 hours before.

## Phase 5: Intelligence & reports
- **Ask Rialna** (Claude, server-side, only sees data the asker is allowed to see; answers with number cards + a next step).
- AI briefing on Home + Listen (speechSynthesis).
- **What if** sliders, **10-year simulation**, Career roadmap.
- **Monthly report**: print CSS → PDF; optionally emailed on the 1st.
- **Checks:**
  - Rialna never mentions the partner's private items.
  - The report prints on A4 without cut-off sections.

## Ongoing
- Back up the database daily (Supabase PITR or nightly dump).
- Error tracking (Sentry).
- Before each release, test the privacy rules with both accounts.
