# Frontend SOTA Gauntlet — Scorecard (hermes-web, system-body recapture)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27 (system-body recapture)
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: **14 / 21** on served `3a0f08fbeb9195217b41afa12be204f1b623bfb1` / `index-57itTrlN.js`.
Scored served artifact: **`index-3A4qXw6p.js`** (1,972,061 B,
`sha256:29daf7e3ef4a5c7041f49935a965a2e5e84bc87b5b2d0a8ee23313be3ea9c375`)
Audited tip: **9faae85d9732a241c8ac67d5e11908bcfd3bd29a**
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
| 2 | UX clarity | **3** | `/system` now has an operator-readable body: honest API-failure notice, Retry, credential form, and Operations. Still held by a 17-item flat nav and a 401 on every captured surface. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` 1440 ran `pulse` (1). Reduced-motion this capture ran `pulse` (1), not `spin`. Skills 1440 still had `spin` with motion allowed. |
| 4 | Technical quality | **2** | Identity-matched restamp: served JS + disk source/runtime hashes agree. Held by a 401 on all five surfaces. Raw `GET /api/status` is 200 without the SPA session header; the dashboard fetch path still 401s. No auth bypass and no new unauthenticated write tool. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390; mobile restacks. Skills under-24px targets improved **222/251 → 205/250** (category rows now `min-h-[24px]`). Remaining worst cluster is 34×19 unlabeled switches. Nav links still **239×38**. |
| 6 | Verification | **2** | Browser shots, console, provenance self-test + negative control, before/after digest stability. No repo test suite for the page and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, honest empty/error state, no GSAP/Canvas/Framer novelty on this cockpit page. |

---

## Identity (why this run is scorable)

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| Entry HTML (token-stripped) | `sha256:0279fd0791583562735ec9136e2e0ced3fc20b06c0705956c6a7918205ea0b60` (511 B) |
| JS | `/assets/index-3A4qXw6p.js` 1,972,061 B `29daf7e3…ea9c375` |
| CSS | `/assets/index-Dh5-37we.css` 114,327 B `454eb30f…165aa3` |
| Source `git log -1` | 9faae85d9732a241c8ac67d5e11908bcfd3bd29a |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` detached via `imelki` only |
| Disk `web_dist` JS | **byte-identical** to served |
| `/api/status` | HTTP **200** without SPA session header, `version` 0.18.2 (no git SHA field) |
| `/health` | SPA fallback HTML **200**, same `index-3A4qXw6p.js` |

The launcher session token was stripped before hashing. No new operator login
was required (`sessionTokenStripped: true`). NousResearch `origin` on the
runtime checkout was **not** fetched, pushed, or mutated.

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions 18.75px | 0 | 3/27 | 401 |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills 18.75px | 0 | 205/250 | 401 |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System 18.75px | 0 | 4/43 | 401 |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions 18.75px | 0 | 3/28 | 401 |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions 18.75px | 0 | 3/27 | 401 |

`/system` body is no longer blank: **1046** text chars (was **199** chrome-only).
The shot shows the honest failure notice plus Operations. It does **not** invent
host or gateway numbers.

---

## What this does and does not unlock

**Unlocked.** `:9119` is attributable to `index-3A4qXw6p.js`. `/system` has a
real operator-readable body.

**Not unlocked.** 15/21 is still the usable band. Do not quote 19–21/21. Do not
quote Awwwards 8+.

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. Recurring 401 on the already-authenticated dashboard (next defect). Raw
   `/api/status` 200 ≠ SPA session fetch. Do not add an unauthenticated write
   tool or type passwords to “fix” it.
2. Skills switch hit targets (34×19 unlabeled buttons; 205/250 still under 24px).
3. Reduced-motion still ran `pulse` on `/sessions`. `spin` did not appear on
   this RM pass.
4. Nav link height 38px.
