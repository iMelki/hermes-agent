# Frontend SOTA Gauntlet — Scorecard (hermes-web, /system in-page 24px)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27 (/system in-page 24px links + labeled redact checkbox)
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: **15 / 21** on served `9cb51827e18a81d03f45cda779ee49075b690be2` / `index-BloUMaE8.js`.
Scored served artifact: **`index-DFSF3_kR.js`** (1,973,248 B,
`sha256:89bc089d96d2d58edadbbc6c0d4332eb9ea92cbba3b1b77d222ce1471e97cbdb`)
Audited tip: **d5ca89ca2a52c58a470d8714d487720abaeb8348**
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
| 1 | Visual direction | **2** | Same Hermes Teal / Nous chrome. Live `h1` is **18.75px** vs body **15px** (heading larger; not inverted). Still not memorable at the pixel. No heading-scale change this pass. |
| 2 | UX clarity | **3** | `/system` still shows a real host/portal/curator body (2905 chars, 10 headings). In-page Manage subscription / Plugins links now meet the 24px floor. Console `err=0`. Still a 17-item flat nav. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` 1440 ran `pulse` (1) with motion allowed. Reduced-motion `/sessions` ran **0** animations (`pulse` already gated). No GSAP on this ops surface. |
| 4 | Technical quality | **2** | Served JS + disk source/runtime hashes agree. Headerless `GET /api/status` 200 is the public liveness contract. No auth bypass and no new unauthenticated write tool. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390. Skills under-24px **0/251**. Sessions **0/27** (390: **0/28**). `/system` under-24 **4/65 → 0/65**. Nav links **239×45**. Under-44 leftovers remain (system 46, skills 231). |
| 6 | Verification | **2** | Browser shots, console, provenance self-test + negative control, before/after digest stability. No repo test suite for the page and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, no GSAP/Canvas/Framer novelty on this cockpit page. |

---

## Identity (why this run is scorable)

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| JS | `/assets/index-DFSF3_kR.js` 1,973,248 B `89bc089d…1e97cbdb` |
| CSS | `/assets/index-DS6owGOh.css` 114,669 B `fc5e7b52…5b82aa50` |
| Source `git log -1` (fix) | d5ca89ca2a52c58a470d8714d487720abaeb8348 |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` detached via `imelki` only |
| Disk `web_dist` JS | **byte-identical** to served |
| `/api/status` | HTTP **200** without SPA session header, `version` 0.18.2 (no git SHA field) |

The launcher session token was stripped before hashing. No new operator login
was required. NousResearch `origin` on the runtime checkout was **not** fetched,
pushed, or mutated.

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions 18.75px | 0 | 0/27 | none |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills 18.75px | 0 | 0/251 | none |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System 18.75px | 0 | 0/65 | none |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions 18.75px | 0 | 0/28 | none |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions 18.75px | 0 | 0/27 | none |

`/system` body is **2905** text chars with live host facts. It does **not**
invent host or gateway numbers.

---

## What this does and does not unlock

**Unlocked.** `:9119` is attributable to `index-DFSF3_kR.js`. `/system` in-page
15px text links and the unlabeled 15×15 redact checkbox now meet the 24px /
named-control floor.

**Not unlocked.** 15/21 is still the usable band. Do not quote 19–21/21. Do not
quote Awwwards 8+. Command Center scoreboard hermes row stays **15/21** (number
unchanged).

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. Under-44 leftovers: `/system` **46/65**, Skills **231/251**. WCAG 2.5.5 AAA
   is 44×44; 2.5.8 AA (24×24) is now met on captured surfaces.
2. Motion-allowed `pulse` on live/status badges (`/sessions`, `/system`). RM
   already 0. Do not add GSAP.
3. Visual hierarchy remains 18.75px `h1` vs 15px body (not inverted; modest).
