# Handoff: Effendy Family — family life & money PWA

## Overview
**Effendy Family** (effendyfamily.com) is a private web app for two people, Rialto and Amnah Effendy, living in Eichstätt, Germany. It puts household money, goals, time (bar shifts, the week), investments, career, and shared life (gym, journal, date nights) in one place. It also has an AI assistant ("Rialna") and a monthly report.

- **Platform:** PWA only. It is installed from the browser to the Home Screen. No App Store.
- **Users:** exactly 2 (Rialto, Amnah), sharing one household.
- **Language:** English UI only.
- **Currency:** EUR is primary. IDR is used only for transfers to Indonesia and for assets held in Indonesia.
- **Budget style:** a monthly limit per category (fixed vs flexible categories).
- **Businesses** (Rialto Studio, Amnah Atelier) run in their own apps. This app only stores **monthly totals plus the uploaded monthly report file**.
- **Privacy:** every personal item has 2 options, **Private** or **Family**.
- **Builder:** Rialto, solo, using Claude Code.

## About the design files
The files in this bundle are **design references built in HTML**. They are working prototypes that show the intended look and behaviour; they are not production code to copy. Rebuild them in a real stack (recommended below). The prototype keeps all data in `localStorage` and fakes anything that needs a server: bank parsing, receipt reading, push, AI fallback answers, and passkeys outside the real domain.

Open `Effendy Family v7.dc.html` in a browser (keep `support.js` next to it). Resize below 900px to see the mobile layout.

## Fidelity
**High-fidelity.** Colours, type, spacing, copy and interactions are final. Recreate them pixel-close. Copy text is final unless marked as sample data. Names, amounts, merchants, dates and employers are **sample data**, and the real app starts empty, guided by the Setup checklist.

## Recommended stack
- **Next.js (App Router) + TypeScript + Tailwind CSS.** Tailwind maps 1:1 onto the inline styles in the prototype.
- **Supabase in the EU (Frankfurt) region:** Postgres, Auth (email + passkeys), Storage (receipts, statements, business reports), Edge Functions + cron (recurring posting, reminders), Row Level Security for Private/Family.
- **Vercel in region fra1.**
- **Web Push (VAPID)** from an Edge Function. On iOS this needs 16.4+ and the app installed to the Home Screen.
- **Anthropic Claude API, server-side only:** receipt reading (vision), PDF statement and roster parsing, Ask Rialna. Never expose keys to the client.
- **Service worker** (`sw.js` in this bundle is a starting point): app shell cached, network-first data, IndexedDB queue for offline writes.

See `DATA_MODEL.md` for the schema, `ROADMAP.md` for build phases, and `CLAUDE_CODE_PROMPT.md` for ready-to-paste prompts.

---

## Global layout
**Desktop (≥ 900px)**
- Fixed left sidebar, 248px wide, background `--soft`, 1px right border `--line`, padding 20/14/14.
- Sidebar contents: logo tile "ef" (32×32, radius 10, `#0A0A0A`), search field "Search or ask ⌘K", a 38×38 accent "+" button, the nav list, and the person switcher at the bottom.
- Nav list: Home · MODULES (Money, Time & goals, Invest & career, Life) · TOOLS (Alerts with count badge, Monthly report, Ask Rialna, What if, Settings, Setup & data).
- Module rows do **not** expand. The sub-pages live in the in-page tab row.
- Active row: background `--inv`, text white, radius 10.
- Main padding is 32/40/56, with 288px left offset. Content max-width is 1120px, centred, with a 16px vertical gap.
- Page background: `--bg` with a dot grid, `radial-gradient(var(--dot) 1px, transparent 1px)` at 22×22.

**Mobile (< 900px)**
- Sticky top header with: logo, the "effendy family" wordmark, an "Offline" pill when offline, and 40×40 round buttons for Search, Alerts (red count badge), Theme and Avatar.
- Fixed bottom tab bar:
  - Position: 10px from the sides, `10px + safe-area-inset-bottom` from the bottom.
  - Card styling, radius 10, 5 equal columns: Home, Money, Ask, What if, More.
  - Buttons are 52px high; the active one is `--inv` with white text.
- Main padding: 18px top, 14px sides, `120px + safe-area` bottom.
- FAB "+": 58×58 circle, `--acc`, placed 18px from the right and `92px + safe-area` from the bottom. On desktop it is 28px from the right and 24px from the bottom. It opens **Quick add**.
- Module pages show a horizontal scrolling tab row (pills, 40px high). The active pill is `--inv`. When the page changes, the row auto-scrolls so the active pill is visible.

**Overlays**
- Forms are **bottom sheets on mobile**: top radius 24, `max-height: 88dvh`, inner scroll with `overscroll-behavior: contain`, bottom padding includes the safe area.
- On desktop, forms are centred modals with radius 24.
- Scrim `rgba(0,0,0,.55)`. Tapping the scrim closes the overlay.

**Touch rules**
- Every tappable element has at least a 44×44 hit area. The prototype uses a `::after` expander under `pointer:coarse`; do the same or pad the element.
- Inputs use a 16px font so iOS does not zoom.
- `-webkit-tap-highlight-color: transparent`.

## Screens
Module → pages, with the prototype key in brackets.

### Home [home]
- **Purpose:** the 10-second daily view.
- **Header:** date eyebrow (mono), "Good morning, Rialto & Amnah", and a person filter (Family / Rialto / Amnah) that changes the briefing and stats.
- **Contents, in order:**
  - Alert chip ("5 alerts →").
  - Rialna briefing: chip or strip style with Read all and Listen. Listen uses `speechSynthesis`.
  - 3 stat cards. Example: "Flexible money left €917 · €38 a day · 24 days".
  - "3 things this week" checklist. Each item has an owner pill and a CTA to the relevant page.
  - Shared goals with progress bars and a "+".
  - Private goals, only for their owner (dashed border, lock).
  - Next 7 days.
  - Net worth sparkline.
- The Family briefing pulls from all family data. A person briefing pulls from their own items plus family items.

### Money
- **Budget [budget]**
  - Hero (`--inv`): flexible money left, spent vs limit, daily allowance.
  - Category list: icon, name, spent/limit, a thin bar, and a status pill (Paid / On track / Fast / Near limit / Over).
  - Warning threshold slider (default 80%) with a list of categories over the threshold.
  - Emergency fund card: target of 3/4/6 months of budget; status "Below 3 months / Minimum reached / Fully funded".
  - Income sources.
  - Latest transactions, with **Scan** and **+ Add**.
- **Debts [debts]**
  - Total, monthly payment and debt-free date.
  - Avalanche/Snowball toggle and an "Extra per month" slider (0–400, step 10).
  - Payoff order with timeline bars.
- **Bank import [import]**
  - Three steps: Upload → Check → Done.
  - Account picker. Any bank is supported: Sparkasse and Trade Republic are only examples, and "Any other bank" uses generic CSV/PDF.
  - Reading progress.
  - Auto-categorised rows, plus **flagged rows** where the user picks one of 3 suggested categories.
  - Finish.
- **Recurring [recur]**
  - 3 cards: goes out every month, comes in every month, next up.
  - "Every month" list: day tile, name, status pill (Added DD Mon in green / Due DD Mon in yellow / Next DD Mon / Paused), amount, and an on/off switch.
  - Rows can be edited.
- **Subscriptions [subs]**
  - Monthly and yearly totals, the "not used in 45+ days" amount, and money saved by cancelling.
  - Per-row actions: Cancel/Keep.
- **To Indonesia [remit]**
  - Hero: sent this year in EUR, ≈ IDR received, transfer count, monthly average, fees, and bars per recipient.
  - **Before you send** calculator: amount, quick chips €100/200/300/500, and an editable "1 € = Rp" rate.
  - Provider comparison (Wise / bank SWIFT / Western Union); the best one is outlined green with a "Most arrives" badge.
  - "Log this transfer" pre-fills the form.
  - Transfers list (EUR + Rp).
- **Business [biz]**
  - One card per business: revenue over 3 months, profit over 3 months, profit per month.
  - **Upload monthly report (PDF, CSV, Excel)** opens the month form with the file attached.
  - Month rows show the file name, or "No file attached" in yellow.
  - No invoices or bookkeeping here.
- **Taxes & refund [tax]**
  - Tax pot and refund estimate (joint filing).
  - Deadlines: VAT pre-return, quarterly prepayment, annual return.
  - Deduction checklist.
  - VAT and the tax pot are fed by the Business monthly entries (`tax` field).

### Time & goals
- **This week [week]:** 3 priorities, a 7-day board coloured by owner (Rialto / Amnah / Together), and "+".
- **Shifts [shifts]:** shift count and hours for the month; upcoming shifts with night/Sunday tags. "Read roster" reads a photo or PDF of the roster and lets the user confirm each shift.
- **Yearly goals [ygoals]:** a card per goal with a 52-week heat strip, a status (Ahead / On track / Behind), this week's step and a tip.
- **Learning [learn]:** minutes per person against a weekly goal, with bars; tracks containing books and courses with a percentage.

### Invest & career
- **Overview [invest]:** net worth hero and asset cards (ETF, Tagesgeld, gold, IDR deposit…). IDR assets are converted at the saved rate.
- **10-year simulation [sim]:** bad / middle / good scenarios, with toggles.
- **Career [career]:** the Studio plan and stage roadmap.

### Life
- **Gym [gym]:** sessions per person per week; log a session.
- **Date nights [together]:** this Friday's plan; ideas around Eichstätt (tap to plan); history with a rating.
- **Journal [journal]:** private by default; textarea and Save.

### Tools
- **Alerts [alerts]:** filters All / Money / Time / Goals; groups Needs attention (red), Coming up (yellow), Good to know (grey). Each alert has Open and Dismiss/Mark done.
- **Monthly report [report]:** print-ready summary of money, goals and life for the month; "Save as PDF" via print.
- **Ask Rialna [ask]:** chat with suggestion chips. Answers carry up to 3 number cards and a "next step" action.
- **What if [whatif]:** sliders (income change, quit smoking, rent, extra savings…) showing the effect on goals and dates.
- **Settings [settings]:**
  - Your data: saved label, Export/Import backup, Reset.
  - Appearance: Light / Dark / Auto.
  - **Security:** PIN, Face ID / fingerprint, auto-lock (right away / 1 min / 5 min), Lock now, Change PIN.
  - **Reminders:** permission pill, Allow button, per-type toggles, morning summary time, Send test.
  - **Offline & install:** status, storage used, install button or Home Screen steps.
  - Members, Privacy defaults, Export data, Language & region.
- **Setup & data [setup]:** an 8-step onboarding checklist with progress. Each step opens the right form or page.
- **More [more]** (mobile only): list of every module and tool.

### Global overlays
- **Quick add:** a grid of Scan receipt, Debt, Transaction, Calendar event, Bar shift, Goal, Subscription, Investment value, Gym session, Journal note, Recurring payment, Transfer home.
- **Command palette:** ⌘K or the search icon. Navigation plus actions; ↵ with no match asks Rialna.
- **Scan receipt:**
  - Opens the camera (`capture="environment"`).
  - Shows "Reading…", then a review with the thumbnail, merchant, item count, total, category chips (suggested first), Paid by chips, and the item list.
  - Buttons: Edit first / Save transaction.
- **Lock screen:**
  - Full-screen with the logo, title, 4 dots, error line, and a 3×4 keypad of 76px circles.
  - The bottom-left key is Face ID (when enabled) and the bottom-right key is delete.
  - "Forgot PIN?" link.
  - Setup flow: Choose PIN → Enter once more → toast "PIN lock is on".
- **Toast:** dark pill, top centre. On mobile it sits at `66px + safe-area-top`. Disappears after 3.8s.

## Interactions & behaviour
### Forms
- All forms share one generic sheet. Field kinds: text, amount (with € or Rp prefix), number, date, chips (single select), toggle.
- Required fields show "Please fill in: <label>" when missing.
- Editing shows Delete (members m1 and m2 cannot be deleted). Save button text is "Save" or "Save changes".

### Recurring
- A server cron runs daily at 05:00 Europe/Berlin.
- For each active item where `day ≤ today` and `last_posted_month ≠ this month`, it inserts a transaction, adds the amount to the category's spent total, and sets `last_posted_month`.
- Allowed day range is 1–28.
- A new item with `day ≤ today` counts as already posted this month.
- An alert appears 3 days before an outgoing item. When items are posted, the toast reads "N recurring items added · …".

### Budget statuses
- Status per category is **Over** if spent > limit, else **Near limit** if spent ≥ warn%, else **Fast** if (flexible and % used > % of month elapsed + margin), else **Paid** (fixed) or **On track**.
- Bar colours: Over red, Near/Fast yellow, fixed grey, flexible ink.

### Emergency fund
`months = fund / Σ category limits`. Status: below 3 months, minimum reached (3+), or fully funded (≥ target).

### Remittance maths
- Amount received = `(eur − fee) × rate`.
- Provider estimates are editable constants, so do not show them as live data:
  - Wise: fee 0.62 + 0.57%, mid-market rate.
  - Bank: €15 fee, rate × 0.975.
  - Western Union: €4.90 fee, rate × 0.968.
- Store `eur`, `fee`, `rate` and `idr_received` on each transfer.
- A live rate API (e.g. ECB, or Wise if you have a key) is optional in phase 3.

### Receipt scan (real)
1. Upload the image to Storage.
2. Call the Claude vision server route. Return JSON `{merchant, date, total, currency, items:[{name, price}], suggested_category}`.
3. Show the review sheet.
4. Never save without user confirmation.
5. Keep the image linked to the transaction.

### Bank import (real)
- **CSV:** detect the delimiter and encoding (often ISO-8859-1 / `;` for German banks). Ask the user once to map the columns (date, amount, payee, purpose), then save the mapping per bank.
- **PDF:** extract the statement with Claude and confirm with the user.
- **Deduplication:** a hash of `date + amount + payee + purpose`.
- **Auto-categorise:** past merchant → category rules first, AI second. Anything below the confidence threshold goes to "flagged".

### Reminders (push)
- One morning summary at the chosen time (07:00 / 08:00 / 20:00), plus event pushes:
  - Bills / recurring: 1 day before.
  - Tax deadlines: 3 days before.
  - Bar shifts: 2 hours before.
  - Budget: when a category crosses warn%.
  - Goals: Sunday at 19:00.
- Respect the per-type toggles. Store a push subscription per device.

### Security
- PIN: 4 digits. Store it as **Argon2/bcrypt on the server** or as a WebCrypto PBKDF2 hash with a salt on the device, never in plain text. The prototype's FNV hash is a placeholder only.
- After 5 wrong tries, wait 30s, doubling each time.
- Face ID / fingerprint: a WebAuthn passkey (platform authenticator, `userVerification: required`) registered for the account and **verified on the server**.
- Auto-lock on `visibilitychange` after the chosen delay.
- "Forgot PIN" requires the account password or passkey sign-in.

### Offline
- Cache the app shell; data reads are network-first with a cache fallback.
- Writes made offline go to an IndexedDB queue and sync when back online, last-write-wins per row using `updated_at`.
- Show an "Offline" pill in the header.
- Ask Rialna, bank import and partner sync need the network. Say so in Settings.

### Responsive
Breakpoint at 900px. Grids use `repeat(auto-fit, minmax(min(100%, Npx), 1fr))`. No horizontal page scroll on 360px screens.

### Theme
Light / Dark / Auto, stored per device. Palettes: mono (current default), blue, lime, teal, violet (see tokens).

## Privacy model: Private / Family
- Every user-owned row has `owner_id` and `visibility ∈ {'family','private'}`.
- **Family:** both people can see and edit it.
- **Private:** only the owner can see it. The partner does not see the item, its amount, or any total that includes it. The server enforces this with RLS, not just the UI.
- Defaults per module (changeable in Settings → Privacy):
  - Journal → Private.
  - Gym, learning, yearly goals → Family.
  - Goals → asked in the form.
  - Transactions → Family. A private transaction is excluded from family budget totals and counts only toward the owner's personal view.
  - Assets, debts → Family.
- UI: private items show a lock icon and a dashed border. Forms have a 2-chip "Visible to: Family · Only me" field.
- Ask Rialna only uses data the asking person can see.

## State and data
- Prototype state keys (persisted): `cats, txs, goals, incomes, subs, events, ygoals, learn, assets, ideas, members, gyms, jnl, dates, debts, recur, remits, biz, fx, sec, notif, priv, warnPct, efMonths, done, dismissed, cancelled, resolved, …`.
- These map onto the tables in `DATA_MODEL.md`.
- UI-only state: `screen`, `form`, `scan`, `lockMode`, `toast`, `cmdOpen`, `viewer`, `person`, `theme`, `online`, `notifPerm`.

## Design tokens
**Font:** Geist 400–900 for UI; Geist Mono 400–700 for eyebrows, keys and badges. Use tabular numerals for every number. Base letter-spacing is −0.005em.

**Type scale**

| Use | Size / weight / tracking |
|---|---|
| Page H1 | 28–30 / 800 / −0.02em / line-height 1.1 |
| Section H2 | 18 / 800 / −0.01em |
| Hero number | 46 / 900 / −0.03em |
| Stat number | 32–34 / 900 / −0.02em |
| Row title | 14–14.5 / 800 |
| Body | 13.5–14 |
| Meta | 12–12.5 |
| Eyebrow | 11 / 700, uppercase, Geist Mono, +0.16em |
| Minimum text | 11 |

**Colours — light (default + mono palette)**

| Token | Value |
|---|---|
| `--bg`, `--card` | `#FFFFFF` |
| `--soft` | `#F7F8FA` |
| `--soft2` | `#EFF1F4` |
| `--line` | `#E6E8EC` |
| `--line2` | `#CDD1D8` |
| `--ink` | `#0B0D10` |
| `--mut` | `#5B616E` |
| `--mut2` | `#8E94A0` |
| `--inv` | `#0B0D10` |
| `--dot` | `#E9EBEF` |
| Mono accent: `--acc` / `--acct` | `#0B0D10` |
| Mono accent: `--acc2` | `#B9BEC7` |
| Mono accent: `--tint` / `--tint2` | `#F3F4F6` / `#DDE0E5` |
| Status, mono: `--ok` / `--okbg` | `#4E8A5F` / `#EAF3EC` (sage) |
| Status, mono: `--warn` / `--warnbg` / `--warnt` | `#D9A520` / `#FBF3DC` / `#6E5200` (mustard; yellow is never used as text on white, use `--warnt`) |
| Status, mono: `--bad` / `--badbg` | `#C2453A` / `#F8E9E7` (brick) |

**Colours — dark**

| Token | Value |
|---|---|
| `--bg` | `#0A0B0D` |
| `--card` | `#121418` |
| `--soft` | `#16181D` |
| `--soft2` | `#1D2026` |
| `--line` | `#23262D` |
| `--line2` | `#363A43` |
| `--ink` | `#E9EBEF` |
| `--mut` | `#A0A6B1` |
| `--mut2` | `#6C727D` |
| `--inv` | `#1A1D23` |
| Mono accent | `#E9EBEF` |
| `--ok` | `#7FBF8E` |
| `--warn` | `#E3B341` |
| `--bad` | `#E07A6E` (status backgrounds are the same hues at 13–14% alpha) |

**Other palettes** (accent / accent text): blue `#3355FF / #2440E0`, lime `#B8F02A / #4C6B00`, teal `#0E8C7E / #0A6B60`, violet `#6246EA / #4B30CC`. Full values are in the `<style>` block of the prototype.

**Colour rules:**
- Green only for money in, done, or safe. Yellow only for "soon / near". Red only for a real problem.
- At most 2–3 coloured elements per screen.
- Cards stay neutral.

**Spacing:** 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24. Card padding is 18–22. Section gap is 16. List row padding is 12–14 vertical.

**Radii:** chips and pills 999; cards 10–12; inputs 10; sheets and modals 24; logo tiles 10–14.

**Shadows:**
- Toast: `0 10px 30px rgba(0,0,0,.25)`.
- FAB: `0 4px 16px rgba(0,0,0,.18)`.
- Palette: `0 24px 70px rgba(0,0,0,.28)`.
- Selected segment: `0 1px 3px rgba(0,0,0,.12)`.

**Heights:** buttons 44 (primary 48–50); inputs 50 (amount 56–60); tab bar buttons 52; keypad 76; toggles 46×28.

**Icons:** 24-unit stroke icons, stroke width 1.7–2.2, round caps and joins (Lucide-style). The prototype maps item emoji to stroke icons, so use **lucide-react** with the same metaphors.

## Assets
- No raster assets. The logo is a typographic "ef" tile.
- Bank logos are letter tiles. Use real bank logos only if licensed.
- `manifest.webmanifest` and `sw.js` are included as starting points. Production still needs 192/512px icons and an Apple touch icon.

## Files in this bundle
- `Effendy Family v7.dc.html`: the full interactive prototype (all screens). Needs `support.js` next to it.
- `support.js`: the prototype runtime. Not for production.
- `sw.js`, `manifest.webmanifest`: PWA starting points.
- `DATA_MODEL.md`: tables, fields and access rules.
- `ROADMAP.md`: build phases and acceptance criteria.
- `CLAUDE_CODE_PROMPT.md`: prompts to paste into Claude Code, one per phase.
