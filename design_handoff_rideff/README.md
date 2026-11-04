# Handoff: rideff Life — family life management PWA

## Overview
**rideff Life** (rideff.com) is a calm, private app for a household's money, time and health, with a realtime voice assistant (**Clopar**, name configurable via `aiName`). MVP focus: **money, health, time**.

- **Platform:** PWA (installable). Breakpoint 900px: sidebar on desktop, bottom tab bar on mobile.
- **Languages:** English, Deutsch, Bahasa Indonesia. Key strings live in `T` (en/de/id) in the prototype; long copy is translated by `rideff-i18n.js` (EN source string → DE/ID map).
- **Currency:** EUR primary; IDR only for transfers to Indonesia and IDR-held assets.
- **Plans:** Life €12.90/mo (1 seat, 20 AI msgs), Life Plus €19.90 (1 seat, 60 voice min), Together €29.90 (4 seats, 120 voice min). Yearly = 10× monthly. Feature gates in `GATE` (0 = all, 1 = Plus+, 2 = Together).
- **Privacy:** every personal row is `private` or `family`. Assistant memory is per user, with an optional shared family scope. No cross-user leaks, enforced on the server.

## Files
- `rideff Life v4.dc.html` — full interactive prototype. Keep `support.js`, `rideff-particles.js`, `rideff-i18n.js` next to it.
- `rideff-particles.js` — Clopar particle character (canvas). Production-usable as-is; API in `AI_ASSISTANT.md` §5.
- `AI_ASSISTANT.md` — realtime flow, tools, memory model, privacy, character states.
- `TOKENS.md` — colours, palettes, type, spacing, radii, motion.
- `DATA_MODEL.md` — Postgres schema + RLS.
- `sw.js`, `manifest.webmanifest` — PWA starting points.

The prototype is a **design reference**, not production code. Data lives in `localStorage`; bank parsing, receipts, push and AI fallbacks are faked.

## Fidelity
High-fidelity. Colours, type, spacing, copy and interactions are final. Names, amounts and dates are sample data; real accounts start empty (`fresh` state) with an empty state on every screen.

## Recommended stack
Next.js (App Router) + TypeScript + Tailwind · Supabase EU (Postgres, Auth with passkeys, Storage, Edge Functions + cron, RLS) · Vercel fra1 · Web Push (VAPID) · OpenAI Realtime (voice, WebRTC, ephemeral tokens minted server-side) · Claude/LLM server-side for receipts, statement parsing and memory extraction. No API keys on the client.

## Layout rules
- **One number, one dark card per page.** Each page has at most one `--inv` hero card; everything else is a neutral card.
- **3 metrics max** across Home: money left, Up next, goals.
- **Header** (every screen): mono eyebrow 11/700 +0.16em → H1 28–30/800 → one-line sub in `--mut`. Primary action top-right as a pill.
- **Buttons:** primary pill `--acc` / `--onacc`, min-height 46; secondary pill 1px `--line` on `--card`; icon buttons 40×40 round. All hit areas ≥ 44×44.
- **Mobile (<900px):** sticky header, floating tab bar (Home, Money, Clopar, Map, More) 10px from edges + safe area; FAB 58×58 above it; forms are bottom sheets (radius 24, `max-height: 88dvh`). Verified with no horizontal overflow at 390px on all screens, filled and empty.
- **Desktop:** 248px sidebar, content max 1120px. Ask opens as a right-side panel.

## Screens (prototype key in brackets)
- **Home [home]** — List view: one number (flexible money left + per day), Up next, goals. Map view: full-screen **Life Map** with Clopar in the corner.
- **Money:** Budget [budget] · Debts [debts] · Bank import [import] · Recurring & subscriptions [recur] (subs merged here; `subs` redirects) · To Indonesia [remit] · Business [biz] · Taxes & refund [tax].
- **Time & goals:** This week [week] · Shifts [shifts] · Yearly goals [ygoals] · Learning [learn].
- **Invest & career:** Overview [invest] · 10-year simulation [sim] · Career [career].
- **Life (health):** Gym [gym] · Date nights [together] · Journal [journal] (always private).
- **Tools:** Alerts [alerts] · Monthly report [report] · Ask [ask] · What if [whatif] · Settings [settings] · Plan & billing [plan] · Setup & data [setup] · Help [help] · More [more, mobile].

### Empty states
Every module screen has one when the account is fresh: dashed card, mono eyebrow (screen name), one-sentence H2 explaining the value, primary button opening the right form, secondary "Load sample data". Copy in EN/DE/ID lives in the `E` (tx keys `e_*`, `b_*`) and `EX` maps. Bank import has none: its upload step is the empty state.

## Clopar (assistant)
- Particle body, solid white eyes that blink and follow mood. Appears in the tab bar, Home hero, Map corner, Ask.
- **Map interaction:** tap → grows in place at the corner → listens (ripples) → thinks (orbiting particles) → speaks (body pulse) with a 1–2 line caption → smiles on success → shrinks back. Never covers the map centre.
- Modes: `calm`, `listen`, `think`, `speak`, `confirm`. Drive from realtime session events (see `AI_ASSISTANT.md`).
- Any write the assistant proposes shows a confirm card (Save / Edit / Undo). Never saves silently.

## Settings
Card layout, grouped: Profile & household · Plan & billing · Assistant (name, voice: text / audio / both, morning briefing time, **Memory: private / family-shared toggle + list + forget**) · Appearance (Light / Dark / Auto, palettes) · Language & region · Security (PIN, passkey, auto-lock) · Reminders · Data (export, import, reset).

## Behaviour
- **Recurring:** daily cron 05:00 Europe/Berlin posts items with `day ≤ today` and `last_posted_month ≠ this month`; day range 1–28; alert 3 days before outgoing.
- **Budget status:** Over > limit; Near ≥ warn% (default 80); Fast if flexible and % used > % of month + margin; else On track / Paid.
- **Remittance:** received = (eur − fee) × rate; provider estimates are editable constants.
- **Security:** 4-digit PIN hashed server-side (Argon2) or PBKDF2 on device; backoff after 5 tries; passkeys verified on server; auto-lock on `visibilitychange`.
- **Offline:** app-shell cache, network-first reads, IndexedDB write queue, last-write-wins on `updated_at`. Assistant needs network.
- **Colour rules:** green = money in / done / safe; yellow = soon; red = real problem; ≤ 3 coloured elements per screen.
