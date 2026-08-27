# Verification — hermes-web gauntlet restamp recapture 2026-08-27

## Restamp path used

Documented serve path (no dedicated restamp script; no ops pin file present):

1. Build source `web/` at `3a0f08f` with `NODE_OPTIONS=--use-system-ca npm run build`
   → `hermes_cli/web_dist` (`web/README.md`, `vite.config.ts` `outDir`).
2. Recycle old runtime JS `index-DbV3C9Nb.js`; copy new `web_dist` into
   `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist`.
3. Local-only `git switch --detach 3a0f08f` on the runtime checkout via the
   `imelki` remote. **Did not fetch or push `origin` (NousResearch).**
4. Stop listener pid 52960 (`HermesDashboardLauncher.pyw --port 9119`).
5. Windowless start:
   `S:\source\CCAI\Assistants\hermes\scripts\windows\Start-HermesNativeDashboard.ps1 -Json`
   → `action=started serving=true http=200 pid=48212`.

## Attribution proof

```text
source  git log -1  3a0f08fbeb9195217b41afa12be204f1b623bfb1
runtime git log -1  3a0f08fbeb9195217b41afa12be204f1b623bfb1
GET /               200  SERVED_JS=/assets/index-57itTrlN.js
GET JS              200  1970350 B  sha256:5d1c4c78c0091ad470ceb8971752a34f54523aa34b0ae04a4f6d5a17221316f3
disk source JS      same hash
disk runtime JS     same hash
GET /api/status     200  version 0.18.2 (no git SHA field)
GET /health         200  SPA HTML with index-57itTrlN.js
```

## Gauntlet commands

```text
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0 after ~38s
  WROTE gauntlet.json
  total 14/21 (scored from receipt + shots; not auto-awarded)
```

## Recipe

- Isolated loopback `127.0.0.1:9119` only.
- `waitUntil: 'commit'`. Never `networkidle`.
- Viewports 1440×900 and 390×844. Dark scheme.
- One reduced-motion context (`prefers-reduced-motion: reduce`).
- Provenance gate before the browser and again after. Entry digest stable.

## Not claimed

- No 19–21/21.
- No Awwwards 8+.
- No NousResearch push or upstream mutation.
