## Restamp + gauntlet recapture (2026-08-27)

hermes-web-restamp-3a0f08f

### Plain-English Summary

The live dashboard at `http://127.0.0.1:9119` was rebuilt from current `dev` and restamped. The files it serves now match source commit `3a0f08fbeb9195217b41afa12be204f1b623bfb1` (`git log -1` on both the iMelki checkout and the local runtime). The recapture score is **14 / 21** (usable). It is **not** 19–21/21. Awwwards is still **not** 8+.

### Current State

- Served SHA: `3a0f08fbeb9195217b41afa12be204f1b623bfb1`. JS bundle `index-57itTrlN.js` (1,970,350 bytes, sha256 `5d1c4c78c0091ad470ceb8971752a34f54523aa34b0ae04a4f6d5a17221316f3`). CSS `index-Cxobo1gB.css` unchanged. HTTP 200. No login redirect.
- `/api/status` 200 (`version` 0.18.2; that endpoint has no git SHA field). `/health` is the SPA HTML and also references `index-57itTrlN.js`.
- Heading scale is now live: `h1` **18.75px** vs body **15px** (was inverted 13.125px).
- Score still **14/21**: Visual 2, UX 2, Motion 1, Technical 2, Responsiveness 2, Verification 2, Complexity fit 3.
- Next defect: empty `/system` body. Also still: recurring 401, Skills 222/251 under 24px.

### Fix/Action Status

Restamped and recaptured. No Framer/GSAP. NousResearch remotes were not pushed or mutated. Runtime `origin` remains NousResearch (fetch/push unused); checkout moved locally via the `imelki` remote.

### Not A Blocker

The dashboard is usable. This score still blocks any “world-class / 19–21 / Awwwards 8+” claim.

### Related Docs / Evidence Links

On `iMelki/hermes-agent` `dev`:

- `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
- `docs/frontend-sota-gauntlet-2026-08-27/verification.md`
- `docs/frontend-sota-gauntlet-2026-08-27/gauntlet.json`

Marker: `served SHA 3a0f08f / 14/21 / no Awwwards 8+`
