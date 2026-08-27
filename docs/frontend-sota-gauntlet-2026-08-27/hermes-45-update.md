## First frontend quality-bar capture (2026-08-27)

hermes-web-gauntlet-2026-08-27

### Plain-English Summary

The Hermes web dashboard at `http://127.0.0.1:9119` is up, it did **not** ask for a new login, and the files it served match the audited build. That is the first time this app could be scored honestly against the shared frontend quality bar (Frontend SOTA Gauntlet: seven areas, 0–3 each, 21 max). The score is **14 / 21** (usable). It is **not** 19–21/21.

Why it matters: earlier fleet rounds carried a 6.0 because the checkout being read was not the build the operator sees. A later agent could otherwise quote 19–21/21 or “world-class” with no pixels. This capture closes that gap.

### Current State

- Served SHA: runtime checkout `cea8fa537d95257201a999d59f1846c933adb439`. JS bundle `index-DbV3C9Nb.js` (1,970,353 bytes, sha256 `34e28728f1f8c24bf1672c0fbdc9202d957cf9b26fa4710eb10779e6949b87f8`). CSS `index-Cxobo1gB.css` matches the same disk files. HTTP 200. No login redirect.
- Capture ran: five surfaces (`/sessions` 1440, `/skills` 1440, `/system` 1440, `/sessions` 390, `/sessions` reduced-motion). Recipe: isolated loopback, never `networkidle`.
- Score **14/21**: Visual 2, UX 2, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3.
- `/system` now shows the System title (the old “this URL painted Sessions” bug is gone) but the page body is almost empty.
- Every surface logged one `401 Unauthorized` resource.
- Reduced-motion still ran a `spin` animation.
- Skills has 221 of 250 controls under 24px.

### Fix/Action Status

Captured and scored only. No dashboard UI code was changed. Fork-safe quick-wins from this issue are still open.

Not happening now: no gateway restart, no scheduled-task change, no spend, no NousResearch mutation, no claim that the UI is finished.

### Not A Blocker

The dashboard is usable now. This score does not block Hermes runtime work. It does block any “world-class / 19–21” claim until a later capture moves the number.

### Related Docs / Evidence Links

On the iMelki fork, `dev` at `6e5602e4a`:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`
- `docs/frontend-sota-gauntlet-2026-08-27/shots/`
