# Frontend SOTA Gauntlet — Scorecard (hermes-web, chrome + /system follow-up)

Subject: **hermes-web** (`web/` in `iMelki/hermes-agent`, served at `http://127.0.0.1:9119`)
Date: 2026-08-27 (chrome 24px floor + `/system` first-paint load)
Workflow: `frontend-sota-gauntlet` (`agent-settings/shared/prompts/frontend-sota-gauntlet.md`)
Previous score: **15 / 21** on served `3bea4c4819062f0a7c491a20f6cae13144778422` / `index-CAurVnFC.js`.
Scored served artifact: **`index-BloUMaE8.js`** (1,972,971 B,
`sha256:526c6ed2e33172b0b35ea86e52d4303e76deb816e134edb7e653670e35bad47e`)
Audited tip: **PENDING_HEAD** (stamped to `dev` HEAD after commit)
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
| 2 | UX clarity | **3** | `/system` now shows a real host/portal/curator body (2906 chars, 10 headings). Console still `err=0`. Still a 17-item flat nav. |
| 3 | Motion / interactivity | **1** | No signature beat. `/sessions` 1440 ran `pulse` (1) with motion allowed. Reduced-motion `/sessions` ran **0** animations (`pulse` gated). No GSAP on this ops surface. |
| 4 | Technical quality | **2** | Served JS + disk source/runtime hashes agree. Headerless `GET /api/status` 200 is the public liveness contract. Tokened `/system` reads are 200. No auth bypass and no new unauthenticated write tool. The 1046-char failure notice is gone because the first-paint set no longer races the 10s git update-check. |
| 5 | Responsiveness | **2** | **0px** page overflow at 1440 and 390. Skills under-24px **3/251 → 0/251**. Sessions **0/27** (390: **0/28**). Nav links **239×45**. `/system` still has 4 under-24 in-page links/buttons (15px text links + one 15×15 unlabeled button) now that the page actually loaded. |
| 6 | Verification | **2** | Browser shots, console, provenance self-test + negative control, before/after digest stability. No repo test suite for the page and no canvas-nonblank proof. |
| 7 | Complexity fit | **3** | Operator dashboard, honest empty/error retained for real failures, no GSAP/Canvas/Framer novelty on this cockpit page. |

---

## Identity (why this run is scorable)

| Surface | Value |
|---|---|
| Served URL | `http://127.0.0.1:9119` HTTP **200**, no login redirect |
| Entry HTML (token-stripped) | `sha256:46266caf6595b4399f852c82f04063a9258c03fd1d7a5d875c86f2c2862362d6` (511 B) |
| JS | `/assets/index-BloUMaE8.js` 1,972,971 B `526c6ed2…35bad47e` |
| CSS | `/assets/index-DS6owGOh.css` 114,669 B `fc5e7b52…5b82aa50` |
| Source `git log -1` | PENDING_HEAD |
| Runtime checkout | `%LOCALAPPDATA%\Hermes\hermes-agent` detached via `imelki` only |
| Disk `web_dist` JS | **byte-identical** to served |
| `/api/status` | HTTP **200** without SPA session header, `version` 0.18.2 (no git SHA field) |

The launcher session token was stripped before hashing. No new operator login
was required (`sessionTokenStripped: true`). NousResearch `origin` on the
runtime checkout was **not** fetched, pushed, or mutated.

---

## Surfaces captured

| Shot | Route | Viewport | Settled | h1 | Overflow | under24 | Console |
|---|---|---|---|---|---:|---:|---|
| `shots/sessions-1440.png` | `/sessions` | 1440×900 | yes | Sessions 18.75px | 0 | 0/27 | none |
| `shots/skills-1440.png` | `/skills` | 1440×900 | yes | Skills 18.75px | 0 | 0/251 | none |
| `shots/system-1440.png` | `/system` | 1440×900 | yes | System 18.75px | 0 | 4/65 | none |
| `shots/sessions-390.png` | `/sessions` | 390×844 | yes | Sessions 18.75px | 0 | 0/28 | none |
| `shots/sessions-1440-rm.png` | `/sessions` | 1440×900 RM | yes | Sessions 18.75px | 0 | 0/27 | none |

`/system` body is **2906** text chars with live host facts. It does **not**
invent host or gateway numbers. The previous 1046-char first-paint notice is
gone on this receipt.

---

## `/system` diagnosis (fixed the client race, not invented stats)

Tokened sequential and parallel probes of the nine `/system` reads all returned
**200** in under 2s / 4s. Paths are correct. The leftover notice was the SPA
5s `settleWithTimeout` racing `GET /api/hermes/update/check`, whose server git
`ls-remote`/`fetch` is allowed **10s**. That call is now off the first-paint
failure set (15s, badge-only). Failed first-paint names are labeled
`(timeout)` or `(NNN)` so a future miss stays honest.

---

## What this does and does not unlock

**Unlocked.** `:9119` is attributable to `index-BloUMaE8.js`. Theme, language,
and Nous footer chrome meet the 24px floor on sessions/skills/390.

**Not unlocked.** 15/21 is still the usable band. Do not quote 19–21/21. Do not
quote Awwwards 8+.

---

## Follow-ups (fork-safe)

Tracked on [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45):

1. `/system` in-page under-24 leftovers: Manage subscription / Plugins text
   links at 15px, plus one unlabeled 15×15 button.
2. `/sessions` still runs `pulse` when motion is allowed (live badge).
3. Visual hierarchy still 18.75px `h1` vs 15px body.
