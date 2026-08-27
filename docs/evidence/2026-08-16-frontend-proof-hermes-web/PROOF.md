# Frontend Proof Bundle — hermes-web, 2026-08-16

Round-6 lane for the fleet UI/UX programme
(`agent-settings/shared/catalog/uiux-fleet-rescore-2026-08-12.md`, tracking
[agent-settings#586](https://github.com/iMelki/agent-settings/issues/586)).

**Headline: the programme has been scoring this app's code from a checkout that does not build
the bundle it captures.** The browser evidence is valid for the surface the operator uses. Every
code-derived claim in rounds 1-3 is not, because it was read from a different tree on a different
remote. Details in §1.

**Read-only.** This lane issued GETs against a server another lane owns. It did not start, stop,
restart, rebuild or configure anything, and it did not write to the runtime root. No credential
was needed (`__HERMES_AUTH_REQUIRED__` is false on this host) and no token value is stored here.

---

## 1. What "hermes-web" actually is, and the surface/source split

`hermes-web` is the **Hermes Agent web dashboard**: a Vite 7 + React 19 + react-router-dom 7 SPA,
shipped as a static build and served by the Hermes gateway.

| | |
|---|---|
| URL | `http://127.0.0.1:9119` — **reachable**, HTTP 200 |
| Server process | pid **31808**, `pythonw.exe` (uv cpython-3.11.10) |
| Command | `HermesDashboardLauncher.pyw --runtime-root C:\Users\Milky\AppData\Local\Hermes\hermes-agent --hermes-home C:\Users\Milky\AppData\Local\Hermes --host 127.0.0.1 --port 9119` |
| Process start | 2026-08-16 11:56:55 |
| Served artifact | `hermes_cli/web_dist/` — `index.html` + `assets/index-B4nfmVYw.js` (1.59 MB) + `assets/index-CpQhiCeR.css` (101 KB) |

**The port registry's "hermes native dashboard (pythonw)" and "hermes-web" are the same surface,
not two.** The pythonw process is the server; hermes-web is the SPA it serves. The known
"pythonw dashboard cannot start cleanly / 0-byte logs" defect was not reproduced — the launcher
is up and serving.

### The finding: two checkouts, and the audit reads the wrong one

| | Audited by the programme | **Actually serving 9119** |
|---|---|---|
| Path | `S:\source\CCAI\Assistants\tools\hermes-agent-imelki` | `C:\Users\Milky\AppData\Local\Hermes\hermes-agent` |
| Remote | `git@github.com:iMelki/hermes-agent.git` | `git@github.com:NousResearch/hermes-agent.git` (upstream) |
| Branch | `dev` | **detached HEAD** |
| Tip | `2cf0bbb9093d5aa2159ec285b86f5b4b56a9ae0a` (2026-08-12) | `d62979a6f34f64f2ed840f159aac66e24d7cad78` (2026-06-12) |
| Working tree | clean | **11 uncommitted paths** (`agent/agent_init.py`, `cli.py`, `gateway/platforms/api_server.py`, `gateway/run.py`, `hermes_cli/_parser.py`, `hermes_cli/config.py`, `hermes_cli/tips.py`, `package-lock.json`, `run_agent.py`, + 2 untracked) |
| `web/src` files | 118 | **98** |
| Clone type | **shallow, depth 4** (`.git/shallow` present, `git rev-list --count HEAD` = 4) | full |

- `git cat-file -t 2cf0bbb90` in the serving checkout → **`fatal: Not a valid object name`**. The
  audited commit does not exist in the tree that serves the app.
- `hermes_cli/web_dist/assets/index-B4nfmVYw.js` mtime **2026-06-12 00:48** — 65 days older than
  the audited tip.
- `hermes_cli/web_dist/` is **gitignored** (`.gitignore:68`) in both checkouts. The served artifact
  is untracked and unversioned: it cannot be attributed to any commit in either repo.

Round 3 recorded "hermes-web has no build-provenance endpoint, so that drift is not measurable
from outside". It is measurable from inside, and the drift is not marginal — it is a different
repository.

> Caveat stated plainly: the audited fork is a **depth-4 shallow clone**, so `git merge-base`
> against `d62979a6f` fails and `git rev-list --count HEAD..d62979a6f` returns 11,473. Those two
> numbers are shallow-clone artifacts and are **not** evidence of divergence. The evidence of
> divergence is the missing object, the file counts, the bundle mtime, and §2.

### Consequence for the programme

Everything in rounds 1-3 derived from reading `web/src` — the 118-file count, "`prefers-reduced-motion`
appears once in 118 files", `@nous-research/ui` 0.18.2, `lucide-react ^0.577.0`, the
`BUILTIN_ROUTES_CORE` route map at `App.tsx:133-152`, "0 native `confirm(`/`alert(`/`prompt(` in
118 files" — describes a tree that produced **none** of the pixels ever captured. The browser
findings were and remain valid; the code findings were attributed to the wrong artifact.

Fix is one of: build and serve the audited tip, or re-point the audit at the runtime checkout, or
add a build-provenance endpoint so the served bundle names its own commit.

---

## 2. Round 3's unresolved Finding 3 is resolved: it is drift, and it is worse than one route

Round 3: "`/system` is declared in `BUILTIN_ROUTES_CORE` but deep-linking it renders the Sessions
page … Cause is unresolved: either a redirect, or drift between the served `web_dist` build and
`web/src`."

**It is drift.** Literal-string grep of the shipped bundle `index-B4nfmVYw.js`:

| Route literal | occurrences in shipped bundle | declared in `web/src/App.tsx` |
|---|---|---|
| `/sessions` `/analytics` `/models` `/logs` `/cron` `/skills` `/plugins` `/profiles` `/config` `/env` `/docs` `/chat` | 3-8 each | yes |
| **`/files` `/mcp` `/pairing` `/channels` `/webhooks` `/system` `/profiles/new`** | **0** | **yes, in both checkouts** |

Seven of nineteen declared routes do not exist in the shipped build at all.

**Negative control, same run:** `/__does_not_exist_control__` was requested alongside the real
routes. It returns HTTP 200 and renders `h1` = "Sessions" with **248 elements**. `/system` returns
HTTP 200 and renders `h1` = "Sessions" with **248 elements**. A phantom route is byte-for-byte
indistinguishable from a route that was never declared. There is no not-found state anywhere in
the app.

See `screenshots/system-desktop.png` against `screenshots/sessions-desktop.png`.

### Route counting for the Gap-2 denominator

- Declared in source (identical in both checkouts): **19** in `BUILTIN_ROUTES_CORE` + `/chat` = 20 paths.
- **Resolving in the shipped build: 12 distinct pages** — `/sessions`, `/analytics`, `/models`,
  `/logs`, `/cron`, `/skills`, `/plugins`, `/profiles`, `/config`, `/env`, `/docs`, `/chat`
  (+ `/` root redirect).
- Phantom: **7**.
- **Captured: 12 of 12** at 1440. Four (`/sessions`, `/skills`, `/system`, `/logs`) additionally at
  390 and 320. Plus 7 phantom routes, 1 negative control, and a reduced-motion pair = **30 captures**.

Use **12** as hermes-web's Gap-2 denominator, not 19 or 20.

---

## 3. Method, and the three detectors this lane had to fix

- Harness: `playwright-core` 1.59.1, headless chromium, resolved read-only from the canonical
  install in `S:\source\CCAI\Assistants\tools\content-factory`. Harness source is committed
  alongside this file as `capture-hermes-web.mjs`.
- Viewports: desktop 1440x900@1, mobile 390x844@2, narrow 320x800@2 (WCAG 2.1 SC 1.4.10 is
  specified at 320px), `colorScheme: dark`, plus a `reducedMotion: reduce` desktop pair.
- `domcontentloaded` + 5s settle + `await document.fonts.ready`. Never `networkidle`.
- Loaded-content proof on every capture: element count, link/button/input/svg/canvas counts, rendered
  text length, skeleton-marker count, and `h1` text. Range 246-5497 elements with real copy on every
  route — no capture is a skeleton, and none is a login redirect (no auth is configured on this host).

### Detector 1 — page overflow. The fleet's standard signal is DEAD on this app.

The brief's guidance for the fleet's Next apps is that `body.scrollWidth - body.clientWidth` is the
live signal and `document.scrollingElement` is dead. **On hermes-web it is the exact opposite, and
a probe using `body.scrollWidth` here can never fail.**

Measured computed styles: `overflow-x: hidden` on `html`, on `body`, **and** on `#root`.

Positive control (2000px absolutely-positioned block appended to `body`, `/sessions`, 1440):

| signal | baseline | with control | after removal |
|---|---|---|---|
| `documentElement.scrollWidth - clientWidth` | 0 | **560** | 0 |
| `body.scrollWidth - clientWidth` | 0 | **0** | 0 |
| `scrollingElement` (= `HTML` here) | 0 | **560** | 0 |

`body` does not move. Any lane that read `body.scrollWidth` on hermes-web read a structural zero.

**This means round 3's reflow result is an artifact.** Round 3 recorded "0 horizontal page overflow
at 1440, 390 and 320px and 0 lateral scrollers anywhere — jointly the best reflow result measured in
this fleet". With `overflow-x: hidden` on all three ancestors, *nothing can ever scroll laterally* —
content that does not fit is clipped and lost, which is a WCAG 1.4.10 failure mode, not a pass. The
claim was unfalsifiable as measured.

### Detector 2 — clipped content, which survives `overflow:hidden`

Any element whose own `scrollWidth - clientWidth > 1`. Positive control: a 3000px in-flow child
appended to `<main>`, asserted to appear in the walk and to disappear on removal.

### Detector 3 — elements laid out past the viewport's right edge

Positive control: the viewport-relative block from detector 1, asserted visible past `innerWidth`.

This detector **failed its control twice before it was trusted**, and both failures were
self-inflicted in ways that would have produced a silent pass:

1. the walk excluded any element whose `id` starts with `__pc_` — which excluded the control
   element itself, so the probe could not see its own control;
2. the walk guarded `width < viewport*3`, which silently rejected a fixed 2000px control at the
   390 and 320 viewports.

Both fixed. **All three detectors are proven alive on all 30 captures** (`control.detectorProvenA/B/C`
in `telemetry.json`).

### Detector 4 — contrast. This lane fabricated a finding and then refuted it.

The first pass reported `/skills` carrying dark-green text on black at **1.19:1** — effectively
invisible text. That finding is **false and withdrawn**. Cause: a hand-rolled colour parser handling
only `rgb()`/`rgba()`/`color(srgb …)`. This app is Tailwind v4 and paints most surfaces in
`oklab()`/`oklch()`; the parser returned `null` for those, the background walk fell through them, and
the probe compared the chip's text against the page's black ground. Direct inspection of the real
element showed its background is `oklab(0.938314 0.0158656 0.0420899 / 0.9)` — near-white, i.e. high
contrast.

Replaced with a canvas-based resolver that makes Chromium perform the CSS Color 4 conversion, plus
proper alpha compositing up the ancestor chain. Per-capture self-test, recorded in `telemetry.json`:

```
whiteOnBlack: 21    sameOnSame: 1    oklabResolved: true
oklabAsRgb: "rgb(255, 230, 203)"    unresolvedColorStrings: 0    proven: true
```

After the fix, `/skills` has **0 failing pairs**. Any other lane in this programme parsing colours by
regex should assume the same class of error.

---

## 4. Measured results

All figures from `telemetry.json`, captured 2026-08-16 against `index-B4nfmVYw.js`.

### Holds from round 3

| Probe | Result |
|---|---|
| console errors / page errors / failed requests / http>=400 | **0 / 0 / 0 / 0** across all 30 captures |
| emoji in rendered text | **0** on every capture |
| unlabeled icon-only buttons | **0** on every capture — still the fleet's best accessible-naming result |
| page overflow @ 1440 / 390 / 320 (detector proven) | **0px / 0px / 0px** |
| clipped-content elements on `/sessions` `/skills` `/logs` `/system` | 0 at 1440 and 390; **1** at 320 (a `truncate` span on `/sessions`, 42px) |

The reflow result survives re-measurement with a working detector. It is now a measured zero rather
than a clipped one — but see §5, 1.1: it is bought with `overflow-x: hidden`, so content that does
not fit is silently cut rather than reachable.

### Typography — the cross-app heading/body defect does NOT apply here

Computed, identical on every route at every viewport:

| role | family | size | weight | letter-spacing |
|---|---|---|---|---|
| `h1` | `"Rules Expanded", sans-serif` | **13.125px** | **700** | **1.05px** |
| `body` | `system-ui, -apple-system, "Segoe UI", Roboto, …` | **15px** | 400 | normal |
| mono | `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace` | 11.25px | 400 | normal |

Loaded faces: `Rules Expanded`, `Rules Compressed`, `Mondwest`, `Collapse`, `JetBrains Mono`.
Body background `color(srgb 0.0157 0.1098 0.1098)` — deliberate dark green, not `#000`.

**hermes-web is not a third instance of the openai-proxy / memsys-console defect.** Those two resolve
`h1` and `body` to the same family *and* the same weight (400/400), separated only by a size step.
Here the heading differs in family, in weight (700 vs 400) and in tracking (1.05px vs normal). The
hypothesis that a fleet-wide weight/tracking fix has a third data point is **refuted** — it remains
2 of 3 apps examined.

Two different defects are present instead, and neither was in the round-3 record:

1. **The heading is smaller than the body text.** `h1` 13.125px against `body` 15px, on every route
   at every viewport. The hierarchy is inverted; weight, tracking and family carry the entire
   heading role.
2. **The mono role is not the loaded mono face.** `JetBrains Mono` loads successfully and is never
   used by the elements that compute to a monospace family — those fall through to the host
   `ui-monospace` stack. Round 3 credited hermes-web with "a heading role and a mono role and no
   body role" (2 of 3). Measured, it is **1 of 3**: only the heading uses a design-owned face.

### Reduced motion — 0% coverage, proven

`matchMedia('(prefers-reduced-motion: reduce)').matches` is `true` in the reduced-motion captures, so
the preference reaches the page. The app changes nothing.

| route | animated els | animation names | transitioning els | canvases |
|---|---|---|---|---|
| `/sessions` normal | 2 | `pulse` | 36 | 2 × 640x432 |
| `/sessions` **reduce** | **2** | **`pulse`** | **36** | **2 × 640x432** |
| `/profiles` normal | 0 | — | 34 | 2 × 640x432 |
| `/profiles` **reduce** | **0** | — | **34** | **2 × 640x432** |

`screenshots/profiles-desktop.png` and `screenshots/profiles-desktop-rm.png` are **byte-identical**
— SHA-256 `89b712672a68be033b16b53295977a26a9b8b5420ae6b76093d7c51580c046b9` for both.

`/profiles` is precisely the page whose source carries the audited fork's single
`prefers-reduced-motion` check (`web/src/pages/ProfilesPage.tsx:60`). In the shipped build that check
has **no observable effect** — consistent with §1: the bundle predates it.

**reducedMotionCoverage: 0/2 animations suppressed, 0/36 transitions suppressed, 0/2 canvases
suppressed on `/sessions`; 0/34 and 0/2 on `/profiles`.**

Per the round-6 lane brief the shared motion primitive was **not** adopted here — a sibling lane is
changing that primitive in this same run and adopting it would mean adopting a moving target.
hermes-web is recorded as a **candidate** with a measured 0% baseline to improve on.

### Hit targets

`total` = visible interactive controls (`a[href]`, `button`, `input`, `select`, `textarea`,
`[role=button|link|tab|menuitem]`, `[tabindex]` ≥ 0).

| capture | total | < 44px (either axis) | **< 24px** |
|---|---|---|---|
| `/sessions` desktop | 21 | 20 | 3 |
| `/sessions` mobile 390 | 23 | 22 | 3 |
| `/sessions` narrow 320 | 23 | 22 | 3 |
| `/skills` desktop | 197 | 196 | **179** |
| `/skills` narrow 320 | 184 | 183 | **164** |
| `/logs` desktop | 38 | 37 | 3 |
| `/config` desktop | 73 | 72 | 38 |
| `/env` desktop | 113 | 111 | 34 |
| `/docs` desktop | 823 | **823** | 379 |

- Primary navigation links measure **239x38** on every capture at every viewport — confirms round 3.
- Under-24px controls exist on **every** route. At 390 and 320 the language toggle renders **15x8**
  — a 120 px² target — and the theme toggle **28x21**. On desktop the footer "Nous Research" link is
  **83x15**.
- Round 3 measured the 44px floor only. The 24px axis is new and is materially worse.

### Minimum rendered text size

**10.5px** on `/skills`, `/plugins`, `/config`, `/env` (smallest sample: the `All (161)` filter chip).
**11.3px** on every other application route. No application route's smallest text reaches 12px.

### Contrast (validated resolver, self-test proven on every capture)

| route | failing pairs / distinct pairs |
|---|---|
| all application routes except `/models` and `/docs` | **0** / 9-24 |
| `/models` | 2 / 22 |
| **`/docs`** | **22 / 24** |

- `/models`: capability tags `Reasoning` `oklch(0.558 0.288 302.321)` on `rgb(17,7,26)` = **3.54:1**
  (11.3px, weight 500, 6 occurrences) and `Vision` = **3.71:1** (5 occurrences). Both below the
  4.5:1 floor for normal-size text.
- `/docs` is third-party Swagger UI (see below) rendered light-on-dark: `rgb(59,65,81)` on
  `rgb(7,21,15)` = **1.83:1** at **306 occurrences**, and `PATCH` badges white on
  `rgb(80,227,194)` = **1.6:1**.

### External origins — round 3's "0 external origins, fully local" is route-scoped, not app-wide

- `/sessions`: **0** external subresources requested. Only an `<a href>` to `nousresearch.com`.
  Round 3's four captured routes were genuinely clean.
- **`/docs` loads two third-party subresources from a public CDN:**
  `https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js` and
  `…/swagger-ui.css`.

That script is version-pinned only to the **major** (`@5`), is fetched at runtime from a CDN, and
executes in the dashboard's own origin — the same document into which the server injects
`window.__HERMES_SESSION_TOKEN__`. This is a live supply-chain exposure and it was not visible to
round 3 because round 3 did not capture `/docs`.

---

## 5. Proposed round-6 scores

Scored against `shared/catalog/uiux-awwwards-audit-rubric-2026-08-09.md`, from the measurements
above only. **These score the shipped build**, which per §1 is not built from this repository.

| Dim | | R3 | **Proposed** | Basis |
|---|---|---|---|---|
| 1.1 | Visual craft | 7 | **6.0** | Heading renders *smaller* than body (13.125 vs 15px) on every route; mono role falls through to the host stack despite JetBrains Mono loading — 1 of 3 type roles uses a design-owned face, not the 2 of 3 recorded. Dark-green identity, single accent, consistent radius and four genuinely loaded display faces hold it at 6. |
| 1.2 | Motion & interaction | 4.5 | **4.0** | Reduced-motion coverage is **0%, measured** rather than inferred: identical animation/transition/canvas inventory under `reduce`, and a byte-identical screenshot pair. The one source-level check has no effect in the shipped build. Rubric anchor 3 ("no reduced-motion handling") is now proven, not estimated. |
| 1.3 | IA & user flows | 6 | **4.5** | Largest move. **7 of 19 declared routes do not exist in the shipped build** and all 7 render Sessions *indistinguishably from a route that was never declared* (negative control: both 248 elements, both `h1` "Sessions"). No not-found state anywhere. 37% of the declared navigation surface fails silently and unobservably. |
| 1.4 | Design-system consistency | 6 | **4.5** | Round 3's reasons stand (Vite non-sanctioned §2.1; `@nous-research/ui` 0.18.2 with no source card or licence evidence §2.7; `docs/preflight/records/` empty; `lucide-react ^0.577.0` vs fleet `^1.31`). Added and decisive: the shipped artifact is **gitignored, untracked, two months stale, and built from a different repository**. A system whose build cannot be traced to any commit is not a consistent system. |
| 1.5 | Accessibility | 5.5 | **4.5** | Sub-44px confirmed (nav 239x38 everywhere) and extended: under-24px controls on **every** route, 179 of 197 on `/skills`, a **15x8** language toggle at 390/320. Minimum rendered text 10.5-11.3px; no app route reaches 12px. `/models` tags at 3.54:1 and 3.71:1. Offset by 0 unlabeled icon buttons and a real 320px reflow. |
| 1.6 | Perceived performance | 6.5 | **6.0** | R3 raised this to 6.5 partly on "0 external origins … fully local". True of the four routes it captured, false of the app: `/docs` pulls an unpinned Swagger UI bundle from `cdn.jsdelivr.net` at runtime. Console cleanliness holds 0/0/0/0 across 30 captures. Still no timing metrics taken — not scored on speed. |
| 1.7 | Content & microcopy | 7 | **7** | Hold. 0 emoji across 30 captures, real data with relative dates, honest per-platform states, unique route headers, no filler. Nothing measured moves this. |
| 1.8 | Delight / signature moments | 6 | **5.5** | The signature moment is two 640x432 canvases on every desktop route — and they are also the app's single largest accessibility failure, rendering unchanged under `reduce`. Still inherited upstream product design (Nous Research mark, v0.16.0, `@nous-research/ui`), not fleet work. |

**Composite: 6.0 → 5.25** (mean of the eight, matching the programme's method).

Six of eight move down. Every move is measured in this run, at the artifact actually being served.

### What would move it back up, cheapest first

1. **Give the served bundle provenance.** Either build and serve this repository's tip, or add a
   build-provenance endpoint that names the commit. Nothing else in §1-§4 can be trusted to stay
   fixed until the audited tree and the served tree are the same tree. (1.4)
2. **Add a not-found route.** A catch-all that says so would convert 7 silent failures into 7
   honest ones in one commit. (1.3)
3. **Reduced-motion pass.** 0% baseline is measured and the two canvases are the whole exposure.
   Adopt the shared motion primitive *after* the sibling lane's changes settle. (1.2)
4. **Type roles.** Make `h1` larger than `body`, and route the mono role to the JetBrains Mono face
   that already loads. (1.1)
5. **Self-host the Swagger UI assets** rather than fetching an unpinned major from a public CDN into
   the token-bearing origin. (1.6, and it is a security item independent of the score.)
6. **Hit targets.** The 15x8 language toggle and 28x21 theme toggle at mobile widths are the worst
   offenders and are a small, contained fix. (1.5)

---

## 6. Premises refuted in this lane

| Premise | Source | Status |
|---|---|---|
| "tip `2cf0bbb90` unmoved since 2026-08-12" describes the surface being scored | round-6 lane brief | **Refuted.** True of the audited repo; that repo does not build the served bundle. |
| 9119 might be a different surface from hermes-web | round-6 lane brief | **Refuted.** Same surface — pythonw is the server, hermes-web is its SPA. |
| The pythonw dashboard cannot start cleanly / 0-byte logs | known defect | **Not reproduced.** Launcher up since 11:56:55, serving HTTP 200. |
| "0 horizontal overflow … jointly the best reflow result measured in this fleet" | rescore v1.2 §3.9 | **Refuted as measured.** `body.scrollWidth` cannot report overflow on this app. The result survives re-measurement, but as a clip, not a reflow. |
| "0 external origins in the DOM — fully local" | rescore v1.2 §3.9 | **Refuted app-wide.** True of the 4 routes captured; `/docs` loads a CDN script. |
| hermes-web is a third instance of the h1/body same-family-same-weight defect | round-6 lane brief §3 | **Refuted.** Different family, weight and tracking. Remains 2 of 3. |
| "a heading role and a mono role and no body role" (2 of 3) | rescore v1.2 §3.9 | **Refuted.** 1 of 3 — the mono role computes to the host stack. |
| `/system` renders Sessions, cause unresolved | rescore v1.2 §3.9, Finding 3 | **Resolved.** Build drift; 7 routes affected, not 1. |
| `/skills` carries 1.19:1 invisible text | **this lane's own first pass** | **Refuted and withdrawn.** Colour-parser artifact; `/skills` has 0 failing pairs. |
| The audited fork and the runtime share no common ancestor | this lane's first read | **Refuted.** `merge-base` failure and the 11,473 count are depth-4 shallow-clone artifacts. |

## 7. Not measured

- **No performance timing.** No LCP/CLS/INP/TTFB, no bundle-parse timing. 1.6 is not scored on speed.
- **No keyboard-only traversal, no focus-visible audit, no screen-reader pass.** 1.5 covers hit
  targets, naming, contrast and reflow only.
- **No mobile/320 capture of `/models`, `/config`, `/env`, `/docs`, `/plugins`, `/cron`,
  `/analytics`, `/chat`, `/profiles`.** Those nine were captured at 1440 only.
- **No authenticated state.** `__HERMES_AUTH_REQUIRED__` is false on this host; a gated deployment
  was not exercised.
- **Nothing was rebuilt.** The audited tip's `web/src` was never built or served, so this bundle
  says nothing about how *this repository* would score if it were the thing running.

## 8. Files

- `telemetry.json` — 30 captures; per-capture console/pageerror/requestfailed/http>=400, all four
  detector self-tests, and the full DOM probe.
- `capture-hermes-web.mjs` — the harness, committed so the run is reproducible.
- `screenshots/` — 7 PNGs: `sessions-desktop`, `sessions-desktop-rm`, `profiles-desktop`,
  `profiles-desktop-rm` (byte-identical to the previous), `system-desktop` (phantom route),
  `skills-desktop` (179/197 controls under 24px), `sessions-narrow` (320px).
