# hermes-web — `/system` body + cheap a11y follow-up (2026-08-27)

Parent: [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45).
Gauntlet scorecard: `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`

## What changed in source

- `web/src/lib/settleWithTimeout.ts` — hanging or 401-stuck fetches settle.
- `web/src/components/SystemUnavailableNotice.tsx` — honest error/empty card.
- `web/src/pages/SystemPage.tsx` — no full-page spinner; apply payloads as they
  land; omit sections with no payload; do not invent host/gateway numbers.
- Helpers moved to `web/src/pages/systemPageShared.ts` so the oversized page
  did not grow (1541 → ~1529 physical before the loading-card add).
- Skills category / panel rows: `min-h-[24px]` (not `min-h-6`; theme rem is 15px).
- `web/src/index.css`: `prefers-reduced-motion: reduce` disables `.animate-spin`.

## Serve pin

`:9119` serves `index-3A4qXw6p.js`. `/system` shot has a real body. Recapture
total **15 / 21**.

## Not claimed

No 8.0 Awwwards. No 19–21/21. Recurring SPA 401 remains. Skills still 205/250
under 24px (switch cluster). RM still ran `pulse`.
