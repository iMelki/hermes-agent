# hermes-web — heading scale source fix (2026-08-27)

Parent: [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45).
Gauntlet scorecard: `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`

## What changed in source

`web/src/contexts/PageHeaderProvider.tsx` `h1` went from `text-sm` /
`tracking-[0.08em]` (measured **13.125px** vs body **15px**) to `text-xl`
`tracking-tight`. SHA: `3a0f08fbeb9195217b41afa12be204f1b623bfb1`.

## Serve pin — restamped 2026-08-27

`:9119` now serves `index-57itTrlN.js` built from that SHA. Measured `h1`
**18.75px** vs body **15px**. Recapture total remains **14 / 21**.

## Not claimed

No 8.0 Awwwards. No 19–21/21. Empty `/system` body, 401s, and 222 under-24px
skills targets remain. Reduced-motion `spin` did not appear on this RM pass.
