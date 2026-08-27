# hermes-web — Visual/Motion park (2026-08-27)

Parent: [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45).
Latest receipt: `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md` (**15/21**, V2 UX3 M1 T2 R2 Ver2 C3).
Served (unchanged this pass): `:9119` → `a720ad7ab` / `index-DFSF3_kR.js` (fix `d5ca89ca2`).
No rebuild, restamp, or gauntlet recapture. Awwwards still **not** 8+. Do not quote 19–21.

## Why Visual is 2

Rubric: 2 = coherent and polished; **3 = distinct, memorable, original**.

The 15/21 scorecard already named the hold: same Hermes Teal / Nous chrome; live `h1` **18.75px** vs body **15px**; not memorable at the pixel.

What is already in tree:

- Heading scale already moved once (`text-sm` 13.125px → `text-xl` 18.75px in `PageHeaderProvider.tsx`). Visual stayed **2**.
- Body stays the default-theme system stack at `--theme-base-size: 15px`. Brand chrome is Rules Expanded + Mondwest via `@nous-research/ui`. That pairing **is** the product identity.
- Contrast tokens were already remapped: `text-muted-foreground` → DS `--color-text-secondary`. README bans text opacity below 0.7.
- Empty states exist on populated-page misses: Sessions (`Clock` + “No sessions” / start hint), System (muted one-liners for empty credential pool / shell hooks). Gauntlet shots are populated (`/sessions` 1145 chars, `/skills` 47236, `/system` 2905), so empty-state polish would not appear on the scored surfaces.

What would unlock Visual 3 (and why it is not ops-safe):

- A new default type pairing, material language, or leftover art that reads as “original” against Nous teal chrome.
- That fights scanability, ThemeProvider, and the Complexity-3 hold (“operator dashboard, no leftover novelty”).
- Another modest h1 bump (24px) is a heading-scale rerun. It already failed to move Visual.

## Why Motion is 1

Rubric: 1 = works but distracts; **2 = supports content**; 3 = signature moment with restraint.

Receipt: `/sessions` 1440 has **1** `pulse`; Skills **0**; RM `/sessions` **0**. `gauntlet.mjs` only counts `animationName !== none` (CSS transitions do not count).

What is already in tree:

- Live-badge `animate-pulse` on Sessions / System, already `motion-reduce:animate-none`. That **is** the content-supporting status signal.
- Toast / dialog / tooltip keyframes exist and are transform/opacity only. They are not on the scored first paint.
- `motion` and `gsap` sit in `web/package.json` for the DS graph. App ops pages do not import them. Wiring either onto `/sessions` or `/system` would spend the Complexity **3**.

What would chase Motion 2 (and why it is not ops-safe):

- Page-enter stagger of session rows delays first scan of titles. Ops-hostile.
- A Framer/GSAP/Canvas “signature beat” is leftover novelty on a cockpit. Forbidden this pass; would drop Complexity.
- Hover/`:active` scale is already DS-normal and invisible to the gauntlet animation probe.
- Extra pulse/fade is still generic Tailwind. Honest rescoring of the same `pulse` as a 2 would be inflation, not a new receipt.

## 44px (explicitly not this path)

WCAG **2.5.5 AAA** leftovers: `/system` 46/65, Skills 231/251. AA 24×24 is already met (0 under-24 on captured surfaces). Inflating Skills switches to 44px wrecks the ops cockpit and does not move Visual or Motion. Optional 1–3 `/system` primaries at 44 was left unused; it is free but score-irrelevant.

## Park

No `web/` edit. No `:9119` restamp. No new gauntlet JSON. Command Center hermes row stays **15/21**.

Next defect (unchanged): named under-44 leftovers as 2.5.5 AAA, not as an 8+ / 19–21 plan. The 19–21 path is a separate showcase surface, not this cockpit.
