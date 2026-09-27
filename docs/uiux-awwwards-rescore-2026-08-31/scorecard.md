# hermes-web — FIRST MEASURED Awwwards composite (2026-08-31)

Replaces the carried **6.0** (from fleet round 3, 2026-08-13) in
`agent-settings/shared/catalog/uiux-fleet-rescore-2026-08-12.md`.
Rubric: `uiux-awwwards-audit-rubric-2026-08-09.md` v1.3 (weights Design 40 /
Usability 30 / Creativity 20 / Content 10; #796 calibration: HM 6.5+ and
Developer Award >7 are the only published bars).

## Composite: **6.47 unrounded — prints 6.5** · MEASURED

| Dimension | Score | Provenance |
|---|---:|---|
| Design | 6.5 | MEASURED |
| Usability | 6.8 | MEASURED |
| Creativity | 5.7 | MEASURED |
| Content | 6.9 | MEASURED (live serve, real data) |
| **Composite** | **6.47 (prints 6.5)** | 0.4·6.5 + 0.3·6.8 + 0.2·5.7 + 0.1·6.9 |

**Award-bar honesty:** 6.47 unrounded is **0.03 below the published 6.5
Honorable Mention bar**. The print rounds to 6.5; no HM-grade claim is made.
Judge the bar on the unrounded value, exactly as the fleet mean does.

## Identity — what was measured (the serving gap, honestly)

The lane brief said "identity-stamped serve at cea8fa537". Reality on
2026-08-31: the running `:9119` serves the **pre-stamp** bundle (built from
`d5ca89ca2`, restamped 2026-08-27, ledger recorded as 15/21) — its
`GET /build-info.json` falls through to the SPA HTML and its entry HTML
carries **no** `hermes-build-*` meta. Per lane instructions Hermes was NOT
restarted; a **keyless side-serve of the stamped commit** was measured and
labelled:

| Surface | Value |
|---|---|
| Stamped commit | **`24bd9b30c507b2294f72d4cda64140ad1adf48d2`** (= `origin/dev` tip, wave-37 stamp feature) |
| Build gate | `npm run build` accept: `{"ok":true,"commit":"24bd9b30c5…","dirty":false,"headMatches":true}` |
| Stamp surface | `GET /build-info.json` → commit/dirty/buildTime; `<meta name="hermes-build-commit|time|dirty">` — both verified on the side-serve |
| Side-serve | `http://127.0.0.1:9219`, static SPA-fallback server (`side-serve.mjs`), **no session token, no /api backend**, loopback only |
| Stamped JS | `assets/index-BpMRcpLA.js` sha256 `89bc089d96d2d58edadbbc6c0d4332eb9ea92cbba3b1b77d222ce1471e97cbdb` — **byte-identical to what live :9119 serves** (`index-DFSF3_kR.js`, same sha256): `git diff d5ca89ca2..24bd9b30c5 -- web/src web/index.html web/public` is **empty**, deterministic JS build |
| Stamped CSS | `index-DfvL14qU.css` sha256 `1b53bd38…` vs live `fc5e7b52…` — **NOT byte-identical** (114,710 B vs 114,669 B; same sources, non-reproducible CSS emission) — stated, not hidden |
| Live serve | `http://127.0.0.1:9119` HTTP 200, read-only GETs only, nothing restarted; used for real-data (Content) evidence |

## Method (settled rules) and in-run controls

- Harness: playwright-core 1.59.1 headless Chromium, `waitUntil: commit`,
  never networkidle, dark scheme. 15 captures = 5 routes (`/sessions /skills
  /system /chat /analytics`) × 3 viewports (1440×900, 768×1024, 390×844) +
  3 reduced-motion contexts, across both targets. Denominator: **15 distinct
  rendered route×viewport surfaces, all settled**.
- **Overflow** = `body.scrollWidth − body.clientWidth`. First-run injected
  control (absolutely-positioned) was **blind** — abs elements don't join
  body scroll overflow — documented in `measure.json` as `proven:false`,
  zeros from that run NOT published. Corrected **in-flow** control run on the
  actual pages (`ovr-control-run2.log`): 0 → **1160** (1440) / 0 → **2210**
  (390) and restored to 0, side and live. Published result: **0px overflow at
  1440/768/390 on both targets, control proven in-run**.
- **Target size, criterion named:** **2.5.8 AA (24px): met** — under-24 = 0
  on 14/15 surfaces (one 25×19 icon button on side `/chat`); live `/skills`
  0/253. **2.5.5 AAA (44px): NOT met** — under-44 leftovers live: skills
  233/253, system 45/64, sessions 8/27. Inline links excluded per 2.5.8
  exception list.
- **Contrast (two-sentinel sRGB canvas):** sentinels proven in every capture
  (21.0 pass / 1.0 fail flagged / invalid colour resolved to null =
  UNMEASURABLE). **0 AA failures on all 15 surfaces**; worst measured ratio
  4.64:1 vs 4.5 required. Coverage stated per surface: **79.4–100%
  resolved/enumerated** (unresolved = background-image or semi-transparent
  stacks, counted in the denominator, not passed).
- **Reduced motion (2.2.2 Level A, computed values):** motion-allowed runs
  show 1–2 animated elements (status `pulse`); under `reduce` **0 running
  animations** and information survives byte-equal (side sessions 255/255
  chars, system 1033/1033).
- **Focus visibility:** 12/12 sampled controls show a computed
  outline/box-shadow delta on focus, every surface.
- **Console:** live serve 0 errors on all 5 captures. Side-serve: exactly 1
  expected keyless artifact (WebSocket handshake with empty token) on
  token-dependent routes; 0 on the rest.

## Dimension rationale (evidence-pinned)

- **Design 6.5** — Coherent, distinctive Nous "Hermes Teal" identity: dark
  teal + parchment accent, custom display faces (Rules Expanded h1, mono
  chip register), consistent radius/spacing, real data everywhere, mobile
  layout holds (`shots/`). Held down by: h1 18.75px vs body 15px (hierarchy
  present but weak at the pixel — carried finding, still true), serif-family
  display faces on a dashboard (house anti-slop conflict; upstream brand),
  near-black chat canvas, 17-item flat nav monotony.
- **Usability 6.8** — The measured fundamentals are clean across the board
  (overflow 0 proven, AA floor, contrast 0 fails at stated coverage, focus
  12/12, RM 2.2.2 pass, console clean, honest degraded states with named
  recovery). Held down by: AAA 44px not met broadly, no keyboard-first
  flow/command palette, 17-item flat nav, raw JSON parse error string
  surfaced in keyless chat.
- **Creativity 5.7** — The aesthetic is genuinely distinctive for an ops
  fleet, but it is inherited upstream brand, and there is **no signature
  motion or interaction**: 1 `pulse` element is the entire motion inventory
  (rubric 1.2 anchor-3 territory). Creativity is a multiplier on
  fundamentals, not a substitute — nothing here multiplies.
- **Content 6.9** — Real data everywhere (667 sessions, 204/204 skills with
  per-category counts, live host facts), relative dates, counted lists, and
  an exemplary honest-analytics block (`/analytics` hides debug token
  estimates by default and names the exact config key to re-enable — EUX-02/
  04 grade). Held down by raw internals leaking into session previews
  (`[IMPORTANT]: You are running as a scheduled cron job…` as card body).

## Not claimed

- No Honorable Mention (6.47 < 6.5 unrounded), no Developer Award, no 8+.
- No gauntlet re-run this lane (last claimed 15/21 at `d5ca89ca2`-era serve).
- No keyboard/screen-reader full pass; focus check is a 12-control sample.
- Live `:9119` was not restarted, not mutated; no password typed, no token
  copied into receipts; side-serve was killed after capture.
- CSS byte-divergence between live and stamped builds means live-serve pixel
  evidence is corroboration, not identity — the composite is pinned to the
  **side-serve of `24bd9b30c5`**.
