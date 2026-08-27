# Verification — hermes-web gauntlet 401 follow-up 2026-08-27

## Restamp path used

Documented serve path (no dedicated restamp script; no ops pin file present):

1. Build source `web/` with `NODE_OPTIONS=--use-system-ca npm run build`
   → `hermes_cli/web_dist` (`web/README.md`, `vite.config.ts` `outDir`).
2. Copy new `web_dist` into
   `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist`.
3. Local-only `git fetch imelki` + `git switch --detach 3bea4c481` on the runtime
   checkout. **Did not fetch or push `origin` (NousResearch).** Runtime
   `package-lock.json` dirt was left untouched.
4. Stop the previous :9119 listener, then windowless start:
   `S:\source\CCAI\Assistants\hermes\scripts\windows\Start-HermesNativeDashboard.ps1 -Json`
   → `action=started serving=true http=200 pid=109316`.

## Attribution proof

```text
GET /               200  SERVED_JS=/assets/index-CAurVnFC.js
GET JS              200  1972319 B  sha256:99c71e0b32af84b36bd21bf93bd01987c828f3cb3d4a430ab7617137e16a1498
disk source JS      same hash
disk runtime JS     same hash
source HEAD         3bea4c4819062f0a7c491a20f6cae13144778422
runtime HEAD        3bea4c4819062f0a7c491a20f6cae13144778422
GET /api/status     200  version 0.18.2 (no git SHA field; no SPA session header)
```

## 401 research

```text
bare GET /api/status              200   public liveness path
bare GET /api/sessions            401   gated, as designed
bare GET /api/auth/me             401   gated, as designed
token GET /api/sessions           200   documented X-Hermes-Session-Token
token GET /api/skills             200
token GET /api/system/stats       200
token GET /api/auth/me            401   no OAuth session on loopback
```

SPA already sent `credentials: include` and `X-Hermes-Session-Token`.
The recurring console 401 was AuthWidget probing `/api/auth/me` on every
route. Loopback skip uses `__HERMES_AUTH_REQUIRED__`. Not parked. Not a
login bypass.

## Gauntlet commands

```text
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0
  WROTE gauntlet.json
  capturedAt 2026-08-27T18:15:33.466Z
  total 15/21 (scored from receipt + shots; not auto-awarded)
  sessions-1440   err=0  u24=3/27   nav=239x45  anim=pulse
  skills-1440     err=0  u24=3/251  nav=239x45  anim=0
  system-1440     err=0  u24=4/43   anim=pulse
  sessions-390    err=0  u24=3/28
  sessions-1440-rm err=0 u24=3/27   anim=0
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
- No password typed. No unauthenticated write tool.
