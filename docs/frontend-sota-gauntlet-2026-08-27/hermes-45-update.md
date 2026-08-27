## Loopback 401 research + gauntlet recapture (2026-08-27)

hermes-web-401-followup-15-21

The live dashboard at `http://127.0.0.1:9119` was rebuilt from current `dev` and restamped. Served JS is `index-CAurVnFC.js` (1,972,319 bytes, sha256 `99c71e0b32af84b36bd21bf93bd01987c828f3cb3d4a430ab7617137e16a1498`). The recapture score is **15 / 21** (usable). It is **not** 19–21/21. Awwwards is still **not** 8+.

- Source SHA: `3bea4c4819062f0a7c491a20f6cae13144778422`.
- 401 **fixed**, not parked. Headerless `GET /api/status` 200 is the public liveness path. Protected APIs already succeed with the documented `X-Hermes-Session-Token`. The recurring console 401 was AuthWidget calling `/api/auth/me`, which 401s on loopback even with a valid session token (no OAuth session). The SPA now skips that probe when `__HERMES_AUTH_REQUIRED__` is false. No password typed. No unauthenticated write tool added.
- Skills under-24px **205/250 → 3/251**. Switches meet the 24px floor. Nav links **239×38 → 239×45**.
- Reduced-motion `/sessions`: **0** animations (`pulse` gated). Motion-allowed `/sessions` can still `pulse` on a live badge.
- `/system` body stays the honest failure notice (1046 chars). Those remaining failures are not the session-token 401.
- Score **15/21**: Visual 2, UX 3, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3.

Receipts:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`

Marker: `served SHA 3bea4c4819062f0a7c491a20f6cae13144778422 / 15/21 / no Awwwards 8+`

Next defect: leftover chrome under 24px (theme 23px, language 23px, Nous footer 15px), then `/system` non-401 load failures.
