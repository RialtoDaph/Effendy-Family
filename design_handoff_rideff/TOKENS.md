# Design tokens — rideff Life

Source of truth: the `<style>` block at the top of `rideff Life v4.dc.html` (`:root` + `body:has([data-palette=…])` rules). Theme and palette are set on the root element via `data-theme` and `data-palette`.

## Type
- **Geist** 400–900 (UI), **Geist Mono** 400–700 (eyebrows, keys, badges). Tabular numerals for all numbers.
- H1 28–30/800/−0.02em/1.1 · H2 18–22/700–800/−0.01em · Hero number 46/900/−0.03em · Stat 32/900 · Row title 14–14.5/700 · Body 13.5–14 · Meta 12 · Eyebrow 11/700 mono uppercase +0.16em · Minimum 11. Inputs 16px (no iOS zoom).

## Colour roles
| Token | Role |
|---|---|
| `--bg` | page |
| `--card` | cards, sheets |
| `--soft` / `--soft2` | sidebar, inset fills, pressed |
| `--line` / `--line2` | borders, dashed empty states |
| `--ink` / `--mut` / `--mut2` | text primary / secondary / tertiary |
| `--inv` | the one dark hero card per page; active nav |
| `--acc` / `--onacc` | primary button / its text |
| `--acc2` / `--acct` | accent on dark / accent as text |
| `--tint` / `--tint2` | selected fill / selected border |
| `--ok` `--okbg` · `--warn` `--warnbg` `--warnt` · `--bad` `--badbg` | status (use `--warnt` for yellow text) |
| `--dot` | background dot grid |

## Default (blue) — light
`--bg #FFFFFF · --card #FFFFFF · --soft #F7F8FA · --soft2 #EFF1F4 · --line #E6E8EC · --line2 #CDD1D8 · --ink #0B0D10 · --mut #5B616E · --mut2 #8E94A0 · --inv #0B0D10 · --acc #3355FF · --acc2 #8FA3FF · --acct #2440E0 · --tint #EEF1FF · --tint2 #C9D3FF · --ok #0E9F5B / #E7F8EF · --warn #E0A100 / #FFF6DC / #7A5600 · --bad #E5383B / #FDECEC · --dot #E9EBEF`

## Default — dark
`--bg #0A0B0D · --card #121418 · --soft #16181D · --soft2 #1D2026 · --line #23262D · --line2 #363A43 · --ink #E9EBEF · --mut #A0A6B1 · --mut2 #6C727D · --inv #1A1D23 · --acc #5B7BFF` (status backgrounds = same hue at 13–15% alpha).

## Noir (prototype default)
`--bg #000000 · --card #111113 · --soft #0A0A0B · --soft2 #1C1C1E · --line #1F1F22 · --line2 #2E2E32 · --ink #F4F2EC · --mut #A09D96 · --mut2 #75726C · --inv #2C2C30 · --acc #E8D9B5 (champagne) · --acc2 #C9B68C · --onacc #000000 · --tint rgba(232,217,181,.12) · --ok #7DD3A0 · --warn #E3B341 · --bad #F2777B`

## Other palettes (light accent / text)
mono `#0B0D10` · ocean `#0E8C7E / #0A6B60` · rose `#D6336C / #B0234F` · sunset `#EE5D2B / #C2441A` · midnight `#5B5BF0 / #4141C8` · forest `#2F6B47 / #245538` (warm neutrals) · sand (warm neutrals, brown ink). Each has a dark variant in the prototype.

## Spacing, radii, sizes
- Spacing: 4 · 6 · 8 · 10 · 12 · 14 · 16 · 18 · 20 · 22 · 24 · 32. Card padding 20–22; section gap 16; list rows 12–14 vertical.
- Radii: pills 999 · cards 18 · inner tiles 12–13 · inputs 12 · sheets/modals 24.
- Heights: buttons 46 (icon 40) · inputs 50 · tab bar 52 · FAB 58 · keypad 76 · switch 46×28.
- Shadows: toast `0 10px 30px rgba(0,0,0,.25)` · FAB `0 4px 16px rgba(0,0,0,.18)` · palette `0 24px 70px rgba(0,0,0,.28)`.

## Motion
- UI transitions 160–220ms ease-out; sheets 280ms cubic-bezier(.2,.8,.2,1).
- Clopar grow/shrink on map: 420ms spring-ish ease; confirm smile ~1.4s then `calm`.
- Respect `prefers-reduced-motion`: particles slow to idle drift, no ripples.

## Icons
24-unit stroke icons, 1.7–2.2 stroke, round caps (Lucide metaphors). No emoji in UI.
