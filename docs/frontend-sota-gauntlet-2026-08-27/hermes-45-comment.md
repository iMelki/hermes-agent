## /system in-page 24px + gauntlet recapture (2026-08-27)

hermes-web-system-links-15-21

The live dashboard at `http://127.0.0.1:9119` was rebuilt from `iMelki/hermes-agent` `dev` and restamped. Served JS is `index-DFSF3_kR.js` (1,973,248 bytes, sha256 `89bc089d96d2d58edadbbc6c0d4332eb9ea92cbba3b1b77d222ce1471e97cbdb`). Recapture score is **15 / 21** (usable). It is **not** 19–21/21. Awwwards is still **not** 8+.

- Source SHA: `d5ca89ca2a52c58a470d8714d487720abaeb8348`. Runtime detached via `imelki` only. NousResearch `origin` was not fetched or pushed.
- `/system` in-page links (Manage subscription, Change in Plugins, configure in Plugins) now use a 24px hit target. The unlabeled 15×15 control was the redact-tokens checkbox; it is labeled and 24×24. Nous footer stays visible.
- `/system` under-24 **4/65 → 0/65**. Skills **0/251**. Sessions **0/27** (390: **0/28**).
- Live `h1` confirmed **18.75px** vs body **15px** (not inverted). No heading-scale change. `/sessions` `pulse` already has `motion-reduce`; RM capture ran **0** animations.
- Score **15/21**: Visual 2, UX 3, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3. Command Center hermes row not edited (number unchanged).

Receipts in `iMelki/hermes-agent`:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`

Marker: `served SHA d5ca89ca2a52c58a470d8714d487720abaeb8348 / 15/21 / no Awwwards 8+`

Next defect: under-44 leftovers (`/system` 46/65, Skills 231/251). Motion-allowed `pulse` on live badges remains (RM already 0).
