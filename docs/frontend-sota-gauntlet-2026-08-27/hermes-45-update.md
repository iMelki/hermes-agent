## Chrome 24px + /system first-paint (2026-08-27)

hermes-web-chrome-system-15-21

The live dashboard at `http://127.0.0.1:9119` was rebuilt from current `dev` and restamped. Served JS is `index-BloUMaE8.js` (1,972,971 bytes, sha256 `526c6ed2e33172b0b35ea86e52d4303e76deb816e134edb7e653670e35bad47e`). The recapture score is **15 / 21** (usable). It is **not** 19–21/21. Awwwards is still **not** 8+.

- Source SHA: `9cb51827e18a81d03f45cda779ee49075b690be2`.
- Theme, language, and Nous footer chrome now meet the 24px floor (sessions/skills/390 under-24 **0**). The Nous footer stays a visible link; it is not hidden.
- `/system` first-paint no longer races the 10s git update-check. Tokened reads were already 200 (no 404, no invented host/gateway numbers). Body **1046 → 2906** chars with live host/portal/curator facts.
- Skills under-24px **3/251 → 0/251**. Nav links still **239×45**.
- Reduced-motion `/sessions`: **0** animations. Motion-allowed `/sessions` can still `pulse` on a live badge.
- Score **15/21**: Visual 2, UX 3, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3.

Receipts:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`

Marker: `served SHA 9cb51827e18a81d03f45cda779ee49075b690be2 / 15/21 / no Awwwards 8+`

Next defect: `/system` in-page 15px text links (Manage subscription, Plugins) and one unlabeled 15×15 button. Then `/sessions` pulse and 18.75px `h1`.
