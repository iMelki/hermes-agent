# Verification — hermes-web gauntlet system-body recapture 2026-08-27

## Restamp path used

Documented serve path (no dedicated restamp script; no ops pin file present):

1. Build source `web/` with `NODE_OPTIONS=--use-system-ca npm run build`
   → `hermes_cli/web_dist` (`web/README.md`, `vite.config.ts` `outDir`).
2. Recycle old runtime JS (`index-57itTrlN.js`, then the intermediate
   `index-BCIj-9Xe.js`); copy new `web_dist` into
   `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist`.
3. Local-only `git fetch imelki` + `git switch --detach <SHA>` on the runtime
   checkout. **Did not fetch or push `origin` (NousResearch).**
4. Stop the :9119 `HermesDashboardLauncher.pyw` listener.
5. Windowless start:
   `S:\source\CCAI\Assistants\hermes\scripts\windows\Start-HermesNativeDashboard.ps1 -Json`
   → `action=started serving=true http=200 pid=71796`.

## Attribution proof

```text
GET /               200  SERVED_JS=/assets/index-3A4qXw6p.js
GET JS              200  1972061 B  sha256:29daf7e3ef4a5c7041f49935a965a2e5e84bc87b5b2d0a8ee23313be3ea9c375
disk source JS      same hash
disk runtime JS     same hash
GET /api/status     200  version 0.18.2 (no git SHA field; no SPA session header)
GET /health         200  SPA HTML with index-3A4qXw6p.js
```

## Gauntlet commands

```text
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0
  WROTE gauntlet.json
  total 15/21 (scored from receipt + shots; not auto-awarded)
```

## Recipe

- Isolated loopback `127.0.0.1:9119` only.
- `waitUntil: 'commit'`. Never `networkidle`.
- Viewports 1440×900 and 390×844. Dark scheme.
- One reduced-motion context (`prefers-reduced-motion: reduce`).
- Provenance gate before the browser and again after. Entry digest stable.

## /system body

Was chrome-only (**199** chars, full-page spinner hung on 401). Now **1046**
chars: honest “System details did not load” notice, failed-API chips, Retry,
credential form, Operations. No invented host/gateway numbers.

Root cause: `fetchJSON` can return a never-resolving promise on loopback 401,
so `Promise.allSettled` never finished. Fix: `settleWithTimeout` plus no
full-page spinner gate.

## 401 (not fixed)

Every captured surface still logs a 401. A headerless `GET /api/status` is
200. The SPA session-token path is a different contract. No password was
typed. No unauthenticated write tool was added.

## Not claimed

- No 19–21/21.
- No Awwwards 8+.
- No NousResearch push or upstream mutation.
