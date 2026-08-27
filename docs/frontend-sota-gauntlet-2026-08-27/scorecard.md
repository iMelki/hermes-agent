# Frontend SOTA Gauntlet — Scorecard (hermes-web, first run)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: none. Fleet Awwwards composites (6.3 / 6.4 / 6.0) were code-only or
tree≠runtime and are **not** a gauntlet score.
Scored served artifact: **`index-DbV3C9Nb.js`** (1,970,353 B,
`sha256:34e28728f1f8c24bf1672c0fbdc9202d957cf9b26fa4710eb10779e6949b87f8`)
Audited tip: **`cea8fa537d95257201a999d59f1846c933adb439`** (same tree as
`origin/dev` merge `a154e8be8`)
Harness: Playwright 1.59.1, isolated loopback, `waitUntil: commit`, never
`networkidle`, 1440×900 + 390×844, reduced-motion pair
Cost: **$0.00**, 0 paid provider calls, 0 generated assets

---

## Total: **14 / 21** — usable, **not** a strong internal benchmark

The gauntlet bands: below 14 = prototype · 14–18 = usable · **19–21 = strong**.
This run does **not** unlock a 9 on any Awwwards dimension.

| # | Area | Score | Why |
|---|---|---:|---|
| 1 | Visual direction | **2** | Coherent Hermes Teal / Nous chrome with a real heading face (`Rules Expanded` on every `h1`). Not memorable at the pixel: `h1` computes **13.125px** against body **15px** (inverted scale). |
| 2 | UX clarity | **2** | Sessions and Skills are scannable with live counts. Held by a 17-item flat nav, a blank `/system` body, and a 401 on every surface. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` at 1440 had **0** CSS animations. Reduced-motion still ran `spin` (1 element). |
| 4 | Technical quality | **2** | Identity-matched capture, `/system` now titles itself System (the old Sessions-render bug is gone). Held by a 401 on all five surfaces and an empty System body. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390; mobile restacks to a hamburger. Held by **221/250** sub-24px targets on `/skills` and nav links at **239×38**. |
| 6 | Verification | **2** | Browser shots, console, provenance self-test + negative control, before/after digest stability. No repo test suite and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, first honest measurement of the served surface, no 3D/marketing overbuild. |

---

## Identity (why this run is scorable)

Earlier fleet rounds were **UNSCORABLE**: the audited fork tree was not the
runtime that answered `:9119`. This run stamps both.

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| Entry HTML (token-stripped) | `sha256:1f53315ebc3e7c83bbaa1938b53f3640c8cace34952c0bd91df829d7ce950452` (510 B) |
| JS | `/assets/index-DbV3C9Nb.js` 1,970,353 B `34e28728…6949b87f8` |
| CSS | `/assets/index-Cxobo1gB.css` 114,172 B `399cc6b1…b6a51a95` |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` at `cea8fa537` |
| Disk `web_dist` JS/CSS | **byte-identical** to served |
| Provenance after capture | same entry digest; 0 nav failures |

The launcher session token was stripped before hashing. No new operator login
was required (`sessionTokenStripped: true`).

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions | 0 | 3/28 | 401 |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills | 0 | 221/250 | 401 |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System | 0 | 3/22 | 401 |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions | 0 | 3/28 | 401 |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions | 0 | 3/28 | 401 |

`/system` no longer silently renders Sessions (round-3 finding). The page now
shows the System header and a kebab, and **almost no body content**.

---

## What this does and does not unlock

**Unlocked.** hermes-web has a first gauntlet scorecard against the artifact
the operator actually uses, at a named SHA, with screenshots. Later rounds can
move a number only with a new capture of the same (or a newly stamped) bundle.

**Not unlocked.** 14/21 is the usable band. Do not quote 19–21/21 from this
folder. The 2026-08-09 Awwwards 6.3 and later 6.0 carry are not this score.

---

## Tracks

| Track | Run | Reason |
|---|---|---|
| Screenshot redesign | **yes** | Measure the shipped operator UI; no redesign this run. |
| Design-skill transfer | partial | House rules visible in type/theme; no new interaction added. |
| Award microsite | no | Not a marketing page. |
| Immersive 3D | no | Two canvases on `/sessions` (chat host); not a 3D track. |
| Playable UI | no | Operator console, not a game. |
| Portfolio page | no | No case-study surface. |
| Six-level prompt ladder | no | Measurement run, not a prompt build. |

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. Empty `/system` body after the route title was fixed.
2. Recurring 401 on the already-authenticated dashboard.
3. Skills list hit targets (221 under 24px) and nav height 38px.
4. Reduced-motion still allows `spin`.
5. Inverted heading scale (13.125px `h1` vs 15px body).
