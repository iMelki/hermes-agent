## System body + gauntlet recapture (2026-08-27)

hermes-web-system-body-15-21

The live dashboard at `http://127.0.0.1:9119` was rebuilt from current `dev` and restamped. Served JS is `index-3A4qXw6p.js` (1,972,061 bytes, sha256 `29daf7e3ef4a5c7041f49935a965a2e5e84bc87b5b2d0a8ee23313be3ea9c375`). The recapture score is **15 / 21** (usable). It is **not** 19–21/21. Awwwards is still **not** 8+.

- Source SHA: `9faae85d9732a241c8ac67d5e11908bcfd3bd29a`.
- `/system` now has a body: honest “System details did not load” notice (401/timeout, no invented stats), Retry, credential form, Operations. Text chars **199 → 1046**.
- Skills under-24px **222/251 → 205/250**. Category rows meet 24px. Remaining worst cluster is 34×19 switches.
- Reduced-motion: `spin` did not run; `pulse` still did.
- Recurring 401 on every captured surface is **not** fixed. Headerless `GET /api/status` is 200; the SPA session fetch is not. No password typed. No unauthenticated write tool added.
- Score **15/21**: Visual 2, UX 3, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3.

Receipts:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`

Marker: `served SHA 9faae85d9732a241c8ac67d5e11908bcfd3bd29a / 15/21 / no Awwwards 8+`

Next defect: recurring 401 on every surface (SPA session vs loopback). Then Skills 34×19 switches, RM `pulse`, nav height 38px.
