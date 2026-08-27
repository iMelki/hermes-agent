# hermes-web — heading scale source fix (2026-08-27)

Parent: [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45).
Gauntlet scorecard: `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
(**14/21** on served artifact `index-DbV3C9Nb.js`).

## What changed in this checkout

`web/src/contexts/PageHeaderProvider.tsx` `h1` went from `text-sm` /
`tracking-[0.08em]` (measured **13.125px** vs body **15px**) to `text-xl`
`tracking-tight`. That is the inverted heading-scale ding from the first
gauntlet run.

## Serve pin — do not rescore :9119 from this edit

The 2026-08-27 gauntlet scored the **served** bundle, not an arbitrary HEAD.
Until `web/` is rebuilt and the launcher at `:9119` serves a byte-identical
new `web_dist`, this change is **source-only**. Do not attribute `:9119` to
this commit. Composite stays **UNSCORABLE / 6.0 carried** for fleet ledger
purposes until a new identity-matched capture exists.

## Not claimed

No 8.0 Awwwards. No 19–21/21. Empty `/system` body, 401s, 221 under-24px
skills targets, and reduced-motion `spin` are unchanged.
