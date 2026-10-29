# hermes-dashboard — Fleet UI/UX Score Lane (2026-08-31)

Score-only lane against live `http://127.0.0.1:9119` (read-only GETs, NOT
restarted). Harness: playwright-core 1.59.1 headless Chromium, `waitUntil:
commit`, never networkidle; 1440×900 + 375×812 + reduced-motion contexts.
Full numbers: `scorecard.json` + `measure.json`; 9 screenshots in `shots/`.

## Serve identity (measured today)

Live `:9119` still serves the **pre-stamp** bundle: `GET /build-info.json`
falls through to the SPA HTML and the entry HTML carries no `hermes-build-*`
meta. Hashed today, token-stripped:

| Asset | Bytes | sha256 | Verdict |
|---|---:|---|---|
| `/assets/index-DFSF3_kR.js` | 1,973,248 | `89bc089d…1e97cbdb` | **byte-identical** to the 2026-08-27 gauntlet artifact AND to the stamped `24bd9b30c5` side-serve JS behind round-24's 6.47 |
| `/assets/index-DS6owGOh.css` | 114,669 | `fc5e7b52…5b82aa50` | pre-stamp CSS; NOT identical to the stamped CSS (114,710 B) — carried round-24 fact |

## Gauntlet: **15 / 21** — usable band, MEASURED today on live

| # | Area | Score | One-line justification |
|---|---|---:|---|
| 1 | Visual direction | **2** | Distinctive Hermes Teal identity, but h1 18.75px vs body 15px (computed, reconfirmed) and a 17-item flat nav. |
| 2 | UX clarity | **3** | Real counted data everywhere, search, honest states, console 0/9 surfaces. |
| 3 | Motion/interactivity | **1** | Inventory is pulse/spin/hover-arc; no signature beat; reduce → 0 visible animations (2.2.2 evidence; the 1 running entry paints at opacity 0). |
| 4 | Technical quality | **2** | Hash-verified serve, 0 console errors, FCP 216–576ms; but live still runs the pre-stamp bundle (#689). |
| 5 | Responsiveness | **2** | 0px overflow at 1440/390/375, in-flow control proven in-run; 2.5.8 AA met on all 1440 surfaces, mobile dips (sessions-375 20/132 state-dependent, system-375 4/65, spacing exception unevaluated); 2.5.5 AAA broadly NOT met (skills 233/253). Scoped two-viewport receipt — capped at 2. |
| 6 | Verification | **2** | 9 settled captures, sentinel-proven contrast (invalid-colour control fired every capture), tab pass 15/15, perf API; no 15×4, no AT/manual — stays 2. |
| 7 | Complexity fit | **3** | Ops cockpit; restraint fits the audience. |

Prior 15/21 (2026-08-27) was on the **same JS artifact** (sha256 match): this
lane re-measures it fresh and the total reproduces. Bands: <14 prototype,
14–18 usable, 19–21 strong. **Do not quote 19–21/21.**

## Awwwards composite: **6.47 (prints 6.5) — CARRIED-RECONFIRMED**

Dimensions (round 24, same day, pinned to stamped `24bd9b30c5` side-serve):
Design 6.5 · Usability 6.8 · Creativity 5.7 · Content 6.9 →
`0.4·6.5 + 0.3·6.8 + 0.2·5.7 + 0.1·6.9 = 6.47`.

This lane verified live serves byte-identical JS and its fresh live evidence
corroborates every fundamentals claim (contrast 0 AA fails at 79.7–100%
stated coverage, worst 4.64:1 vs 4.5; overflow 0 proven; focus 12/12; tab
15/15 with visible indicator; console 0; FCP < 600ms).

**Award-bar honesty: 6.47 unrounded is 0.03 BELOW the published Honorable
Mention 6.5 bar. The print rounds up; no HM or any award claim is made.**

## New findings this lane (not in round-24 receipts)

1. **Mobile 375 under-24 targets, live data:** sessions card list renders
   15×15 "Select session" checkboxes (20/132 under-24 in the main
   screenshot-backed capture; two later settled re-captures saw 0/29 with the
   list not fully mounted — state/data-dependent); `/system` at 375 shows 4/65
   under-24 (15×28 remove credential/hook). 2.5.8 spacing exception not
   evaluated. Naming criteria: these are **2.5.8 AA** observations; **2.5.5
   AAA** remains broadly unmet everywhere (skills 233/253).
2. **Under reduce, one `gradient-stroke` CSSAnimation keeps running** on
   `span.arc-border` — at computed `opacity: 0`, so nothing visible moves
   (receipt: `rm-anim-probe.mjs` output embedded in scorecard.json).
3. **Keyboard pass is real and labeled:** 15 Tab presses land on labeled
   controls (skip-nav anchors → action buttons), 15/15 with a visible
   indicator, 0 dead-end on `<body>`.

## Honest limits

See `scorecard.json.honestLimits` — composite not independently re-derived;
RM parity not byte-comparable on live; no 15×4 / axe / AT; one flat-wait
probe run discarded as unsettled; session token stripped before hashing.
