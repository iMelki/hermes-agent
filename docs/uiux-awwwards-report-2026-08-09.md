# hermes-web — Awwwards-Level UI/UX Audit

Date: 2026-08-09
Auditor: fleet design audit (rubric v1.0)
App: hermes-web — dashboard at `S:\source\CCAI\Assistants\tools\hermes-agent-imelki\web` (serves http://127.0.0.1:9119 from the built bundle)
Repo: iMelki fork of NousResearch/hermes-agent (`git remote -v`: origin iMelki, upstream NousResearch)

> **Adversarial verification (2026-08-09):** ~35 file/line references in this report were spot-checked against source by an independent reviewer. Nearly all held up exactly (including the 21-primitive / import-census counts, the single reduced-motion guard, and the 180 aria-* occurrences across 33 files). Fixed inline: the locale count is 16, not 18 (`LOCALE_META`, `i18n/context.tsx:48`); `ConfirmDialog.tsx` is 122 lines; `DeleteConfirmDialog` has 9 page consumers; the profile-scope mechanism at `App.tsx:793-806` is a remount guard, not a banner; and the Awwwards-weighted composite arithmetic was corrected.

> **Audit mode: CODE-ONLY.** No browser was launched and no server was started. All scores are code-inspection estimates, not browser-proven measurements. Per rubric Section 2.8, no score of 8+ is awarded here without browser evidence; any future score of 8+ must be treated as "provisional pending browser proof" until a Frontend Proof Bundle (desktop + mobile screenshots, console/network, interaction states incl. reduced-motion) exists. No proof bundle currently exists for this app.

---

## 1. Executive summary

hermes-web is the strongest *design-system citizen* of any non-fleet app audited so far: it consumes the upstream Nous Research design system (`@nous-research/ui` 0.18.2) through 180+ imports of 21 distinct primitives, enforces written typography/contrast rules in its own README (`web/README.md:55-104` — text-size floor, opacity floor, semantic text tokens, per-surface font tiers), and layers an unusually sophisticated runtime theme engine on top (8 built-in themes that change palette, typography, radius, and density together — `web/src/themes/presets.ts`, `web/src/themes/context.tsx`). Composite score: **6.3/10** — solid Honorable-Mention grade, not yet Site-of-the-Day. The fundamentals (tokens, states, i18n, dialogs) are largely in place; what is missing is the Linear-grade layer: a keyboard-first path (no command palette, 17 flat nav items), choreographed rather than sprinkled motion, skeletons instead of spinner walls, and closure of a handful of consistency leaks (a hand-rolled `ConfirmDialog` duplicating the DS one, one native `window.confirm`, hardcoded English toasts bypassing a 16-language i18n system). House-rule findings: the stack is Vite (upstream's choice — flagged, not resolved), the sidebar animates `width` against the transform/opacity-only rule, three upstream themes ship Inter/serif/near-violet palettes that collide with the anti-slop bans, and no component-sourcing preflight record exists anywhere in `docs/`. **The one change that matters most:** add a cmdk command palette + nav grouping — it converts a 17-item scroll-and-scan sidebar into a decision-in-one-glance, action-in-one-keystroke operator flow, and it is purely additive (fork-safe). All recommendations below are additive or component-scoped to keep upstream merges painless.

---

## 2. Current-state assessment

### Stack and token audit
- **Stack:** Vite 8 + React 19 + TypeScript + Tailwind v4 (`web/package.json:14-55`, `web/vite.config.ts`). React Router 7 for routing (`web/src/App.tsx:13-20`). NOT Next.js — this is the upstream project's established stack; per the stack rule ("Adapt to the target repo... do not silently replace the repo's framework"), replacement is out of scope, but the Vite tension is flagged in Open questions.
- **Design system:** `@nous-research/ui` (the Nous "design-language" package) supplies Button, Card, Badge, Input, Toast, Select, Dialog, ConfirmDialog, Segmented, Spinner, Stats, BottomSheet, ListItem, Tabs, Typography, etc. Import census (grep over `web/src`): button 33, spinner 25, badge 23, card 22, input 21, toast 17, label 17 — the DS is the real primitive layer, not decoration.
- **Token system:** three-layer palette (`--background` / `--midground` / `--foreground`, each with `-base` and `-alpha` variants) defined at `web/src/index.css:50-89`, with a shadcn-compat bridge (`@theme inline` remapping `--color-card`, `--color-muted-foreground`, `--color-border`, etc. onto the Nous palette via `color-mix`) at `web/src/index.css:154-187`. Density is a genuine token: `--spacing: calc(0.25rem * var(--theme-spacing-mul))` (`index.css:119-123`) scales every Tailwind spacing utility per theme. Radius, base font size, line-height and letter-spacing are all theme tokens. This is a real semantic token system, unusual for an internal tool.
- **Theme engine:** `web/src/themes/context.tsx` rewrites ~40 CSS custom properties on `:root` per theme, supports server-side user YAML themes, per-theme font stacks with runtime Google-Fonts injection (`context.tsx:290-307`), theme-name migration aliases (`context.tsx:49-56`), component-style buckets (`--component-sidebar-clip-path` etc., consumed at `App.tsx:557-561`), and an independent font-override layer (`context.tsx:324-341`).

### Live conventions inventory
- Layout shell: fixed sidebar (collapsible, localStorage-persisted, tooltip rail when collapsed — `App.tsx:347-716`), `PageHeaderProvider` giving every route a unique h1 + `afterTitle` badge slot + `end` toolbar slot (`web/src/contexts/PageHeaderProvider.tsx:52-121`).
- Typography conventions: `themedChrome` / `themedBody` / `themedFont` helpers (`web/src/lib/utils.ts:8-15`) implementing the README's font-tier table; `text-display` opt-in uppercase instead of blanket `uppercase`.
- Dialog convention: `DeleteConfirmDialog` wraps the DS `ConfirmDialog` with i18n defaults (`web/src/components/DeleteConfirmDialog.tsx:1-29`) — used by 9 pages (grep-verified: Cron, Env, Files, Mcp, Pairing, Profiles, Sessions, System, Webhooks).
- Feedback convention: DS `Toast` + `useToast` (17 import sites); status pulses via `animate-pulse` dot badges (`pages/LogsPage.tsx:121`, `pages/SessionsPage.tsx:602`).
- Plugin SDK: plugins get the same DS components from `window.__HERMES_PLUGIN_SDK__` (`web/src/plugins/registry.ts:143-160`), so third-party tabs inherit the design system — a genuinely good consistency mechanism.
- Icons: Lucide throughout (`App.tsx:21-56` imports 30+ Lucide icons). Lucide is the live convention.

### States coverage
- Loading: DS `Spinner` everywhere; one true skeleton (`web/src/components/SidebarStatusStrip.tsx:13` — pulse bar). Chat host shows an `aria-busy` / `aria-live="polite"` loading row (`App.tsx:756-766`).
- Empty: translated empty strings exist across 16 locales (`i18n/en.ts:148-149` "No sessions yet" / "No sessions match your search"; locale registry `i18n/context.tsx:48`); Sessions hides its "Delete empty" button when the global empty count is zero (`pages/SessionsPage.tsx:732-741` — honest affordance).
- Error: per-panel error text (`SessionsPage.tsx:647-648`), toast failures with distinct messages, plugin load errors carry diagnosis steps ("Check the Network tab (dashboard-plugins/…)" — `i18n/en.ts:49-52`).
- Background refresh is silent (no flicker): `loadSessions(p, silent)` skips the spinner on polls (`SessionsPage.tsx:810-823`).

### Preflight / proof-bundle record check
- No component-sourcing preflight record found anywhere under `docs/` (grep for "sourcing|preflight" matches only an unrelated SSL RCA). **FAIL on record-keeping** (Section 2.3).
- No Frontend Proof Bundle or gauntlet scorecard exists for this app.

### Duplication vs primitives
- `web/src/components/ConfirmDialog.tsx` is a 122-line hand-rolled modal duplicating the DS `confirm-dialog` that the same codebase imports six times (App, DeleteConfirmDialog, OAuthProvidersCard, ConfigPage, PluginsPage, SystemPage). Consumers: `ModelReloadConfirm.tsx:1`, `ModelPickerDialog.tsx:7`, `pages/ModelsPage.tsx:31`. It lacks a focus trap (only initial-focus + Escape + focus restore, `ConfirmDialog.tsx:32-56`) — Tab can walk out of the dialog into the inert background.
- Hand-rolled dropdown menus: ThemeSwitcher and LanguageSwitcher build their own portal dropdowns (`components/ThemeSwitcher.tsx:47-57` outside-click handling), and `ProfilesPage.tsx:81-86` documents copying "the hand-rolled dropdown pattern used by ModelsPage's 'Use as' menu". Three-plus same-purpose menus with no shared menu primitive.
- Tables: 3 bespoke `<table>` tags, all in `pages/AnalyticsPage.tsx:253,312,367`, sorted by a local 35-line `useTableSort` (`AnalyticsPage.tsx:55-89`). This is far lighter than the fleet's worst offenders (memsys 28, paperclip 23); no ratchet needed yet.
- Native `window.confirm("Clear all pending pairing requests?")` at `pages/PairingPage.tsx:73` — the only native confirm in the app, and a consequential bulk action.

---

## 3. Scorecard

All scores are code-inspection estimates (no browser evidence). None reach the 8+ threshold that would require immediate proof; if any improvement lands, re-score with a proof bundle.

| Dimension | Score /10 | Evidence |
|---|---|---|
| Visual craft | 7 | Real semantic token system w/ density + radius + type tokens (`index.css:50-187`); written contrast/typography law (`README.md:55-104`); distinctive brand fonts (Mondwest/Rules/Collapse, `public/fonts/`); grain texture utility (`index.css:235-246`); real data everywhere; no emoji in markup (verified scan). Drift: raw `oklch()` platform colors bypass tokens (`SessionsPage.tsx:73-75`); legacy `uppercase` call sites acknowledged in README:79. |
| Motion & interaction | 5 | Keyframes are transform/opacity only (`index.css:191-214`); clever tooltip "warm" suppression skips re-animation between adjacent items (`App.tsx:1260-1273`); hover/active/disabled cycles via DS. Violations/gaps: sidebar animates `width` (`App.tsx:554` `lg:transition-[width]`) against the transform-only rule; exactly ONE `prefers-reduced-motion` guard in the whole app (`ProfilesPage.tsx:58-63`); no motion duration/easing tokens — `cubic-bezier(0.23,1,0.32,1)`, 120/200/300ms repeated inline (`App.tsx:551,554,866,1289`). |
| IA & user flows | 6 | Separated routes with unique headers + per-route toolbar slots (`PageHeaderProvider.tsx:52-121`); pagination reads "N–M of Total" (`SessionsPage.tsx:684-700`); counts surface in header badges (`SessionsPage.tsx:779-791`); persistent chat host survives tab switches (`App.tsx:124-132,753-779`); profile-keyed route remount (`ProfileKeyedRoutes`) kills stale-target writes on profile switch (`App.tsx:793-806`). Gaps: 17 flat nav items with no grouping (`App.tsx:163-201`); no command palette or keyboard shortcuts (grep for cmdk/metaKey `k`: zero); Analytics hidden-but-reachable is well-reasoned (`App.tsx:383-397`). |
| Design-system consistency | 7 | 21 distinct DS primitives, 180+ imports (census above); plugin SDK forces DS reuse on plugins (`registry.ts:143-160`); README bans drift patterns explicitly. Violations: duplicate hand-rolled `ConfirmDialog.tsx` vs DS confirm-dialog (3 consumers); 3+ hand-rolled dropdown menus (`ProfilesPage.tsx:81-86` admits mirroring); no sourcing-preflight record in `docs/`. |
| Accessibility | 6 | 180 `aria-*` occurrences across 33 files; dialogs use `role="dialog" aria-modal` with focus restore (`ConfirmDialog.tsx:60-69`); `aria-expanded`/`aria-controls` on nav toggle (`App.tsx:515-517`); `role="toolbar"` on log filters (`LogsPage.tsx:160`); `aria-busy`/`aria-live` on async regions (`App.tsx:759-760`); focus-visible rings on nav/actions (`App.tsx:849,1109`). Gaps: native `confirm()` for a bulk destructive action (`PairingPage.tsx:73`); local ConfirmDialog lacks a focus trap (`ConfirmDialog.tsx:32-56`); sortable `<th onClick>` is mouse-only, no `aria-sort`/button semantics (`AnalyticsPage.tsx:106-112`); one reduced-motion guard app-wide; no skip-link. |
| Perceived performance | 6 | Silent background refresh kills flicker (`SessionsPage.tsx:810-823`); persistent PTY host avoids terminal respawn (`App.tsx:124-132`); WebGL xterm renderer (`ChatPage.tsx:22`); local woff2 fonts with `font-display: swap` (`index.css:23-43`). Red flags (unproven, code-level): `three`, `gsap`, `leva`, `@react-three/fiber`, `@observablehq/plot` sit in the dep graph — declared directly in `web/package.json` (`three` as a devDependency) to satisfy the DS, and force-deduped because they "exist in BOTH places" (`vite.config.ts:76-84` and its comment) — while zero app code imports any of them (`motion` is likewise a declared-but-unimported direct dep); bundle audit needed; theme applied in `useEffect` post-paint so non-default themes likely flash teal on load (`context.tsx:468-471` vs the "flash-free" claim at `context.tsx:33-35`); runtime Google-Fonts CDN injection per theme (`context.tsx:290-307`); spinner-walls instead of layout-matching skeletons on Sessions/Models/Channels. |
| Content & microcopy | 7 | 16-locale i18n (`src/i18n/` — en, de, es, fr, ja, ko, zh, zh-hant, ru, uk, tr, it, pt, hu, af, ga; count verified against `LOCALE_META`, `i18n/context.tsx:48`); consequential-action copy answers the four questions — update dialog states the exact command, commit count, restart behavior, and prompt-cache retention (`App.tsx:934-945`); plugin errors include where-to-look next steps (`i18n/en.ts:49-52`); relative dates (`utils.ts:18-35`); sortable headers (`AnalyticsPage.tsx:91-127`). Gaps: hardcoded English toasts bypass i18n ("Session renamed", "Failed to rename session", "Enter a valid number of days", `SessionsPage.tsx:1123,1126,1152,1161,1168,1176`); `timeAgo` is English-only for all 16 locales (`utils.ts:18-35`). |
| Delight / signature moments | 6.5 | The theme engine is a genuine identity feature: 8 themes shifting palette+font+radius+density together (`presets.ts`), 3-stop palette swatches in the picker (`ThemeSwitcher.tsx:14-19`), user YAML themes, independent font override, component clip-path hooks (`App.tsx:557-561`); braille unicode spinner with reduced-motion first-frame fallback (`ProfilesPage.tsx:52-79`); embedded real terminal as the chat surface. But the delight is *latent* — no single choreographed moment ties it together; theme switching is an instant variable swap, not a reveal. |

**Composite: 6.3/10** (unweighted mean 6.31; Awwwards-weighted ≈ 6.3 — Design 40% = 6.3 (avg of visual 7, motion 5, consistency 7), Usability 30% = 6.0 (avg of IA 6, a11y 6, perf 6), Creativity 20% = 6.5, Content 10% = 7.0; same dimension-to-category mapping as the sibling component-marketplace audit).

---

## 4. Improvements (13)

Sourcing note: this app's tier-1 pool is its own live conventions + the upstream `@nous-research/ui` DS. Fork rule applied throughout: additive components and token layers only; no framework or DS replacement; anything touching upstream-owned files is marked.

1. **Replace the native `confirm()` on Pairing with the app's own dialog.**
   Where: `web/src/pages/PairingPage.tsx:73`.
   How: target-app `DeleteConfirmDialog` (`components/DeleteConfirmDialog.tsx`) — the exact pattern 9 pages already use, including PairingPage itself (it already imports `DeleteConfirmDialog` for its delete flow).
   Impact: quick-win. (Also closes the EUX-09 gap.)

2. **Retire the hand-rolled `ConfirmDialog.tsx` duplicate.**
   Where: `web/src/components/ConfirmDialog.tsx`; consumers `ModelReloadConfirm.tsx:1`, `ModelPickerDialog.tsx:7`, `pages/ModelsPage.tsx:31`.
   How: target-app DS — `@nous-research/ui/ui/components/confirm-dialog`, exactly as `DeleteConfirmDialog.tsx` wraps it. Removes the focus-trap gap for free.
   Impact: quick-win.

3. **Keyboard-accessible sortable headers.**
   Where: `web/src/pages/AnalyticsPage.tsx:91-127` (`SortHeader`).
   How: target-app conventions — render a `<button>` inside the `<th>`, add `aria-sort` on the th, keep the existing `useTableSort`. No new dependency.
   Impact: quick-win.

4. **Route the stray English strings through i18n and localize relative time.**
   Where: `web/src/pages/SessionsPage.tsx:1123,1126,1152,1161,1168,1176`; `web/src/lib/utils.ts:18-35`.
   How: target-app i18n system (`src/i18n/`); use `Intl.RelativeTimeFormat` keyed to the active locale for `timeAgo`/`isoTimeAgo`.
   Impact: quick-win.

5. **Global reduced-motion story.**
   Where: `web/src/index.css:191-214` (keyframes); `App.tsx` transitions; generalize the guard at `ProfilesPage.tsx:58-63`.
   How: native CSS — one `@media (prefers-reduced-motion: reduce)` block zeroing animation/transition durations, plus a shared `usePrefersReducedMotion` hook in `src/hooks/` (target-app hooks lane).
   Impact: quick-win.

6. **Pre-paint theme application to kill the default-teal flash.**
   Where: `web/index.html` (add inline script); `web/src/themes/context.tsx:33-35` claims flash-free but `applyTheme` runs in `useEffect` (`context.tsx:468-471`), which is post-paint.
   How: target-app theming — a ~10-line inline script reading `hermes-dashboard-theme` from localStorage and setting the three layer vars before the bundle loads. Purely additive.
   Impact: quick-win (verify the flash in a browser first — see Open questions).

7. **Motion tokens next to the existing theme tokens.**
   Where: `web/src/index.css:50-89` (`:root` block); inline call sites `App.tsx:551,554,866,1289`.
   How: target-app token system — `--motion-fast: 120ms; --motion-base: 200ms; --motion-slow: 300ms; --ease-out-quint: cubic-bezier(0.23,1,0.32,1)`; themes may later override (a "calm" theme can slow everything). Additive; no DS change.
   Impact: medium.

8. **Sidebar collapse without animating `width`.**
   Where: `web/src/App.tsx:554` (`lg:transition-[width]`) and the label `opacity` fade at `App.tsx:864-868`.
   How: target-app + native CSS — animate the nav labels with transform/opacity and snap the column via `grid-template-columns` change (or accept the tradeoff and record an explicit exception). The mobile drawer already uses `transition-[transform]` correctly (`App.tsx:551`).
   Impact: medium. Flagged as a doctrine tension, not a defect: a 260ms width transition on a compositor-friendly desktop sidebar may test fine — measure before rewriting.

9. **Group the 17-item sidebar into labeled sections.**
   Where: `web/src/App.tsx:163-201` (`BUILTIN_NAV_REST`).
   How: target-app pattern — the sidebar already renders a labeled group for plugins (`App.tsx:631-661` with `role="group"` + section heading); apply the same structure to core items (suggested: Operate / Automation / Connect / Setup).
   Impact: medium.

10. **Command palette (Ctrl/Cmd-K).**
    Where: new `web/src/components/CommandPalette.tsx`; one keydown listener + mount in `App.tsx`.
    How: cmdk (curated shortlist; the fleet's keyboard-first backbone, already proven in Command Center) styled with the app's existing tokens; actions = navigate to any route, switch theme, switch profile, restart gateway (reusing `useSystemActions`). Additive file — near-zero upstream merge risk.
    Impact: medium.

11. **Layout-matching skeletons for the three list-heavy pages.**
    Where: `pages/SessionsPage.tsx` (initial `loading`), `pages/ModelsPage.tsx`, `pages/ChannelsPage.tsx`.
    How: target-app pattern — generalize the pulse-bar skeleton already shipped in `SidebarStatusStrip.tsx:13` into a `ListSkeleton` that mirrors the DS `ListItem`/Card row heights. No new dependency.
    Impact: medium.

12. **Self-host theme webfonts.**
    Where: `web/src/themes/presets.ts:72-73,97-98,125-126,149-150,178-179` (five Google-Fonts CDN URLs injected at runtime via `context.tsx:290-307`).
    How: target-app precedent — the repo already self-hosts JetBrains Mono in `public/fonts-terminal/` with documented license (`index.css:16-43`); do the same for the theme fonts (all OFL/Apache). Removes an external CDN dependency from a loopback operator tool and the FOUT on theme switch.
    Impact: medium.

13. **Bundle audit of the DS's heavy transitive deps.**
    Where: `web/vite.config.ts:76-84` dedupes `three`, `gsap`, `leva`, `@react-three/fiber`, `@observablehq/plot`; all five are also declared in `web/package.json` itself (`three` under devDependencies), and `motion` is a sixth declared-but-unimported dependency; zero imports of any of them in `web/src` (verified by control grep).
    How: proof lane — build with `vite build` + a treemap (rollup-plugin-visualizer is fine as a devDependency) to confirm whether the DS's chunks actually ship these to the dashboard; if they do, ask upstream for a subpath export that excludes the 3D/animation layers, or lazy-load the DS overlay module.
    Impact: medium (potentially large payload win; needs measurement first).

---

## 5. Awwwards flagship concept — "Lens Shift"

**One signature moment, scoped to the app's real identity feature: theming.** Hermes's themes are called lenses internally (LENS_0, the `lens-5i` alias at `context.tsx:49-52`). Today, switching themes is an instant ~40-variable swap (`context.tsx:347-405`) — the most distinctive capability in the app produces zero moment.

- **The moment:** selecting a theme in `ThemeSwitcher` triggers a single choreographed cross-morph of the entire dashboard: palette, radius, and type interpolate over ~450ms as one composited transition, originating radially from the picker (the "lens" sweeping across the glass). The picker rows themselves upgrade from 3-stop swatches (`ThemeSwitcher.tsx:14-19`) to live miniature previews (a stamp-sized sidebar+card mock rendered with each theme's own vars — pure CSS, no screenshots).
- **Complexity ladder level:** native-API tier — `document.startViewTransition()` wrapping the existing `applyTheme()` call, with CSS `::view-transition` timing. No WebGL, no scroll choreography, no GSAP required (even though gsap exists in the dep graph). This is deliberately the lowest ladder rung that delivers the moment.
- **Asset/motion plan:** zero new assets; motion tokens from improvement #7 drive duration/easing; the radial origin uses a `clip-path` circle on the new-state snapshot — consistent with the theme system's existing clip-path vocabulary (`--component-*-clip-path`, `App.tsx:557-561`).
- **Reduced-motion fallback:** `prefers-reduced-motion: reduce` (and browsers without View Transitions) get today's instant swap — the feature degrades to exactly the current behavior, so nothing is lost.
- **Fork maintainability:** contained to `ThemeSwitcher.tsx` + a ~15-line wrapper around `applyTheme` in `themes/context.tsx` + one CSS block. Upstream-mergeable as a self-contained PR; equally easy to carry as a fork patch.
- **Proof required:** frontend-sota-gauntlet scorecard target 19-21/21 with browser evidence; 60fps trace during the transition on the live 9119 dashboard under real data; reduced-motion screenshot pair; nonblank-canvas check while the chat terminal is mounted (the persistent xterm host must not flicker through the transition — test `data-chat-active` both ways, `App.tsx:770`).

---

## 6. Constraint compliance notes

| Constraint | Status | Notes |
|---|---|---|
| Stack rule (React+Next+Tailwind+shadcn; Vite non-sanctioned) | **TENSION — flagged, not resolved** | Vite 8 is the upstream project's established stack (`package.json:53`; README.md:7). The rule's own text says adapt to the target repo and do not silently replace the framework. Same posture as the job-pipeline-os Vite flag: record, ask the operator (Open question 1). No Next twin exists, so this is not a retire-on-sight duplicate. |
| Reuse-first sourcing ladder | **PASS in substance** | Tier-1 (target-app + its DS) is the terminal answer nearly everywhere; plugin SDK enforces it on plugins (`registry.ts:143-160`). Exceptions listed in Section 2 (duplicate ConfirmDialog, hand-rolled menus). |
| Preflight record (Section 2.3) | **FAIL (record-keeping)** | No `Test-FrontendComponentSourcingPreflight` record found under `docs/`. Any improvement from Section 4 that writes operator UI must run the preflight first and commit the record. |
| Paid tools / provenance (2.7) | **PASS** | No paid pools. JetBrains Mono documented Apache-2.0 (`index.css:20`); Google Fonts are OFL (self-hosting recommended, #12); `@nous-research/ui` is the upstream vendor's own published package — provenance is the upstream relationship itself. Adopting cmdk (#10) requires a frontend-source-card. |
| Ethical UX (EUX-01..10) | **PASS with one finding; browser items unverified** | Honest defaults and counts (empty-count-gated destructive button, `SessionsPage.tsx:732-741`); consequential actions get real review dialogs with truthful consequence copy (`App.tsx:934-945,1036-1063`); no urgency/scarcity/confirm-shaming patterns found in code. Finding: EUX-09 gap at `PairingPage.tsx:73` (native confirm for bulk clear) — fix #1. Anything requiring rendered-state proof (contrast, focus order) is **unverified**, not passed. |
| Anti-slop bans (2.6) | **MOSTLY PASS; 4 flags** | No emojis in markup (verified scan); no `h-screen` (uses `h-dvh`/`min-h-[100dvh]` — `App.tsx:486`, grep); no pure-#000 app chrome; one accent (midground) per theme; no Inter in the app's own chrome. Flags: (a) sidebar animates `width` (`App.tsx:554`) vs "never animate width"; (b) `midnightTheme` ships Inter (`presets.ts:70-73`) — banned font; (c) `emberTheme`/`roseTheme` ship serif body stacks Spectral/Fraunces (`presets.ts:95,176`) — serif ban for dashboard UIs; (d) `defaultTheme.terminalBackground: "#000000"` (`presets.ts:54`) — pure black, arguably legitimate for a terminal surface; and midnight's `#d4c8ff`-on-`#0a0a1f` is near the LILA boundary. (b)-(d) are **upstream-owned, user-selectable themes** — see Open question 2 before touching them. |
| Proof bundle (2.8) | **ABSENT** | Code-only audit; no browser evidence captured. All scores are estimates; no 8+ awarded. First follow-up action for any implemented improvement: capture the proof bundle against http://127.0.0.1:9119 (headless Playwright fallback from the content-factory tree per rubric; never `networkidle` — Sessions polls). |

---

## 7. Open questions for the operator

1. **Vite fork policy.** hermes-web is Vite because upstream is Vite. Confirm the standing exception for upstream forks (same decision pending for job-pipeline-os), or define when a fork must migrate. Recommendation: exception — a frontend rewrite in a fork is the definition of merge pain.
2. **Do anti-slop font/palette bans apply to user-selectable themes?** Inter/Spectral/Fraunces and the near-violet Midnight palette live in upstream's theme presets (`presets.ts`), where the user chooses them deliberately. Banning them in the fork means diverging from upstream files that change often. Recommendation: bans govern *defaults and app chrome*, not the optional theme catalog — but that is a doctrine call, not mine.
3. **Icon doctrine.** Lucide is this app's live convention (30+ icons, `App.tsx:21-56`). Standing Phosphor/Radix-vs-Lucide conflict: record Lucide as the convention here?
4. **Fork vs upstream contribution.** Several fixes (#1-#5) are upstream-quality patches. Should they go to NousResearch/hermes-agent as PRs (reducing the fork's carry burden) or stay fork-local? Who owns that relationship?
5. **Analytics table engine.** The fleet rule points at TanStack Table, but AnalyticsPage's 3 tables + 35-line sorter are lightweight and working. Adopt TanStack only if a richer grid need materializes (command-center#16-style gate), or extract a small shared SortableTable header instead?
6. **Is the dashboard ever exposed beyond loopback?** Determines how hard to push the Google-Fonts self-hosting (#12) on privacy grounds vs merely on offline-robustness grounds.
7. **Theme flash confirmation.** Verify in a browser whether a saved non-default theme flashes teal on load (`context.tsx:468-471` post-paint application) before investing in #6.
8. **DS bundle weight.** If the build treemap (#13) confirms three/gsap/leva ship in the dashboard bundle, raise a subpath-exports request upstream — who files it?

---

*Every file reference above is relative to `S:\source\CCAI\Assistants\tools\hermes-agent-imelki\` unless prefixed otherwise. Audit performed read-only; no source files were modified.*
