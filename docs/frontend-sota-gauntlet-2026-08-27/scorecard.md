# Frontend SOTA Gauntlet — Scorecard (hermes-web, 401 follow-up)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27 (loopback `/api/auth/me` skip + hit-target floors)
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: **15 / 21** on served `9faae85d9732a241c8ac67d5e11908bcfd3bd29a` / `index-3A4qXw6p.js`.
Scored served artifact: **`index-CAurVnFC.js`** (1,972,319 B,
`sha256:99c71e0b32af84b36bd21bf93bd01987c828f3cb3d4a430ab7617137e16a1498`)
Audited tip: **3bea4c4819062f0a7c491a20f6cae13144778422**
Harness: Playwright 1.59.1, isolated loopback, `waitUntil: commit`, never
`networkidle`, 1440×900 + 390×844, reduced-motion pair
Cost: **$0.00**, 0 paid provider calls, 0 generated assets

---

## Total: **15 / 21** — usable, **not** a strong internal benchmark

The gauntlet bands: below 14 = prototype · 14–18 = usable · **19–21 = strong**.
This recapture does **not** unlock a 9 on any Awwwards dimension. Fleet Awwwards
stays **no 8+** (6.0 carried / UNSCORABLE for award claims). Do not quote 19–21/21.

| # | Area | Score | Why |
|---|---|---:|---|
| 1 | Visual direction | **2** | Same Hermes Teal / Nous chrome. `h1` still **18.75px** vs body **15px**. Still not memorable at the pixel. |
| 2 | UX clarity | **3** | `/system` body stays operator-readable. Console 401s are gone on every captured surface. Still a 17-item flat nav. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` 1440 ran `pulse` (1) with motion allowed. Reduced-motion `/sessions` ran **0** animations (`pulse` gated). |
| 4 | Technical quality | **2** | Identity-matched restamp: served JS + disk source/runtime hashes agree. SPA 401 was the expected loopback `/api/auth/me` probe, not a missing session header. Headerless `GET /api/status` 200 is the public liveness contract. No auth bypass and no new unauthenticated write tool. `/system` still shows the honest load-failure notice (1046 chars) for non-401 failures. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390. Skills under-24px **205/250 → 3/251** (switches cleared the 24px floor). Nav links **239×38 → 239×45**. Remaining under-24 cluster is chrome: theme 23px, language 23px, Nous footer 15px. |
| 6 | Verification | **2** | Browser shots, console, 401-path logging, provenance self-test + negative control, before/after digest stability. No repo test suite for the page and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, honest empty/error state, no GSAP/Canvas/Framer novelty on this cockpit page. |

---

## Identity (why this run is scorable)

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| Entry HTML (token-stripped) | `sha256:1bb0c5e2f19937c0f2956a0d950e023070f5a620197736786a378e9ddaa8e6e0` (511 B) |
| JS | `/assets/index-CAurVnFC.js` 1,972,319 B `99c71e0b…16a1498` |
| CSS | `/assets/index-BBNSWGzv.css` 114,638 B `ca240640…998ddc` |
| Source `git log -1` | 3bea4c4819062f0a7c491a20f6cae13144778422 |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` detached via `imelki` only |
| Disk `web_dist` JS | **byte-identical** to served |
| `/api/status` | HTTP **200** without SPA session header, `version` 0.18.2 (no git SHA field) |
| `/health` | SPA fallback HTML **200**, same `index-CAurVnFC.js` |

The launcher session token was stripped before hashing. No new operator login
was required (`sessionTokenStripped: true`). NousResearch `origin` on the
runtime checkout was **not** fetched, pushed, or mutated.

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions 18.75px | 0 | 3/27 | none |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills 18.75px | 0 | 3/251 | none |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System 18.75px | 0 | 4/43 | none |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions 18.75px | 0 | 3/28 | none |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions 18.75px | 0 | 3/27 | none |

`/system` body remains **1046** text chars: honest failure notice plus Operations.
It does **not** invent host or gateway numbers. Those remaining failures are
not the loopback session-token 401.

---

## 401 research (fixed, not parked)

Headerless `GET /api/status` 200 is **by design** (`PUBLIC_API_PATHS`).
Protected APIs (`/api/sessions`, `/api/skills`, `/api/system/stats`) return
**200** with the documented `X-Hermes-Session-Token` from
`window.__HERMES_SESSION_TOKEN__`, and **401** without it. `/api/auth/me`
returns **401 even with a valid loopback token** because there is no OAuth
`request.state.session`. AuthWidget was calling that probe on every route.

Fix: skip `getAuthMe()` when `window.__HERMES_AUTH_REQUIRED__` is not true.
That is the documented injected flag. No password typed. No cookie bypass.
No unauthenticated write tool.

---

## What this does and does not unlock

**Unlocked.** `:9119` is attributable to `index-CAurVnFC.js`. Console 401s are
gone. Skills switch floor and nav 44px+ are live.

**Not unlocked.** 15/21 is still the usable band. Do not quote 19–21/21. Do not
quote Awwwards 8+.

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. Chrome under-24px leftovers: theme 23px, language 23px, Nous footer 15px.
2. `/system` still shows the honest load-failure notice after the 401 fix
   (non-401 failures / timeouts; do not invent stats).
3. `/sessions` still runs `pulse` when motion is allowed (live badge).
4. Visual hierarchy still 18.75px `h1` vs 15px body.
