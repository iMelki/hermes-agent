# Frontend SOTA Gauntlet — Scorecard (hermes-web, restamp recapture)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27 (restamp recapture)
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: **14 / 21** on served `cea8fa537` / `index-DbV3C9Nb.js`.
Scored served artifact: **`index-57itTrlN.js`** (1,970,350 B,
`sha256:5d1c4c78c0091ad470ceb8971752a34f54523aa34b0ae04a4f6d5a17221316f3`)
Audited tip: **`3a0f08fbeb9195217b41afa12be204f1b623bfb1`**
  (`git log -1` on source `dev` and on `%LOCALAPPDATA%\Hermes\hermes-agent`)
Harness: Playwright 1.59.1, isolated loopback, `waitUntil: commit`, never
`networkidle`, 1440×900 + 390×844, reduced-motion pair
Cost: **$0.00**, 0 paid provider calls, 0 generated assets

---

## Total: **14 / 21** — usable, **not** a strong internal benchmark

The gauntlet bands: below 14 = prototype · 14–18 = usable · **19–21 = strong**.
This recapture does **not** unlock a 9 on any Awwwards dimension. Fleet Awwwards
stays **no 8+** (6.0 carried / UNSCORABLE for award claims).

| # | Area | Score | Why |
|---|---|---:|---|
| 1 | Visual direction | **2** | Same Hermes Teal / Nous chrome. Heading scale ding is gone: `h1` now **18.75px** vs body **15px** (was 13.125px inverted). Still not memorable at the pixel. |
| 2 | UX clarity | **2** | Sessions and Skills stay scannable. Held by a 17-item flat nav, a blank `/system` body, and a 401 on every surface. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` 1440 ran `pulse` (1). Reduced-motion this capture had **0** CSS animations (prior run still had `spin`). |
| 4 | Technical quality | **2** | Identity-matched restamp: served JS + runtime/source SHA agree. Held by a 401 on all five surfaces and an empty System body. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390; mobile restacks. Held by **222/251** sub-24px targets on `/skills` and nav links at **239×38**. |
| 6 | Verification | **2** | Browser shots, console, provenance self-test + negative control, before/after digest stability. No repo test suite and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, honest measurement of the served surface, no 3D/marketing overbuild. |

---

## Identity (why this run is scorable)

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| Entry HTML (token-stripped) | `sha256:362bff60d63e1b3e1ee76ad3885462c7f15b639e81d57f5e9e7e8346667e7155` (511 B) |
| JS | `/assets/index-57itTrlN.js` 1,970,350 B `5d1c4c78…221316f3` |
| CSS | `/assets/index-Cxobo1gB.css` 114,172 B `399cc6b1…b6a51a95` |
| Source `git log -1` | `3a0f08fbeb9195217b41afa12be204f1b623bfb1` |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` at the same SHA (detached; `imelki` remote only) |
| Disk `web_dist` JS | **byte-identical** to served |
| `/api/status` | HTTP **200**, `version` 0.18.2 (no git SHA field; SHA is from `git log -1`) |
| `/health` | SPA fallback HTML **200**, same `index-57itTrlN.js` |
| Provenance after capture | same entry digest; 0 nav failures |

The launcher session token was stripped before hashing. No new operator login
was required (`sessionTokenStripped: true`). NousResearch `origin` on the
runtime checkout was **not** fetched, pushed, or mutated.

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions 18.75px | 0 | 3/27 | 401 |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills 18.75px | 0 | 222/251 | 401 |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System 18.75px | 0 | 3/22 | 401 |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions 18.75px | 0 | 3/28 | 401 |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions 18.75px | 0 | 3/29 | 401 |

`/system` still titles itself System and still has **almost no body content**.

---

## What this does and does not unlock

**Unlocked.** `:9119` is attributable to `3a0f08f` / `index-57itTrlN.js`. The
heading-scale source fix is no longer source-only.

**Not unlocked.** 14/21 is still the usable band. Do not quote 19–21/21. Do not
quote Awwwards 8+.

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. Empty `/system` body (next defect).
2. Recurring 401 on the already-authenticated dashboard.
3. Skills list hit targets (222 under 24px) and nav height 38px.
4. Reduced-motion `spin` did not appear on this RM pass; keep watching.
