# Prompts for Claude Code

Put this whole folder at `docs/design/` inside your repo first. Paste the prompts one phase at a time.

## Start (run once)
```
Read docs/design/README.md, DATA_MODEL.md and ROADMAP.md fully. Open docs/design/Effendy Family v7.dc.html in a browser and treat it as the visual and behavioural source of truth. It is an HTML prototype: recreate it, don't copy it.
Stack: Next.js App Router + TypeScript + Tailwind + Supabase (EU) + Vercel fra1. Use lucide-react icons and the Geist / Geist Mono fonts.
Set up the project, the Tailwind theme from the README tokens (as CSS variables, light/dark/mono), and the Supabase schema + RLS from DATA_MODEL.md as migrations.
Before writing code, write a short plan and list any questions.
```

## Each phase
```
Implement Phase N from docs/design/ROADMAP.md.
- Match the prototype screens pixel-close at 390px and 1280px widths.
- Every tappable element is at least 44×44; inputs use 16px text; safe-area insets on fixed bars and sheets.
- Every user-owned row has owner_id + visibility (family|private) enforced by RLS. Add a test that the partner cannot read a private row or see it in totals.
- When done, list each acceptance check from the roadmap and how you verified it.
```

## Useful follow-ups
- "Compare the <Screen> page with the prototype at 390px and list every visual difference, then fix them."
- "Write Playwright tests for: add transaction, recurring posting, private item hidden from partner, PIN lock."
- "Audit for security: secrets in the client, RLS gaps, PIN storage, passkey verification on the server."
