# Verification — hermes-web gauntlet chrome + /system follow-up 2026-08-27

## Restamp path used

Documented serve path (no dedicated restamp script; no ops pin file present):

1. Build source `web/` with `NODE_OPTIONS=--use-system-ca npm run build`
   → `hermes_cli/web_dist` (`web/README.md`, `vite.config.ts` `outDir`).
2. Copy new `web_dist` into
   `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist`.
3. Local-only `git fetch imelki` + `git switch --detach <HEAD>` on the runtime
   checkout. **Did not fetch or push `origin` (NousResearch).** Runtime
   `package-lock.json` dirt was left untouched.
4. Stop the previous :9119 listener, then windowless start:
   `S:\source\CCAI\Assistants\hermes\scripts\windows\Start-HermesNativeDashboard.ps1 -Force -Json`
   → `action=started serving=true http=200 pid=100304`.

## Attribution proof

```text
GET /               200  SERVED_JS=/assets/index-BloUMaE8.js
GET JS              200  1972971 B  sha256:526c6ed2e33172b0b35ea86e52d4303e76deb816e134edb7e653670e35bad47e
disk source JS      same hash
disk runtime JS     same hash
GET /api/status     200  version 0.18.2 (no git SHA field; no SPA session header)
```

Source and runtime git SHAs are stamped after the `dev` commit that contains
this recapture.

## `/system` API probe (tokened, no secrets printed)

```text
token GET /api/status              200   476ms
token GET /api/system/stats        200   144ms
token GET /api/memory              200   476ms
token GET /api/credentials/pool    200   1019ms
token GET /api/ops/checkpoints     200   14ms
token GET /api/ops/hooks           200   34ms
token GET /api/curator             200   80ms
token GET /api/portal              200   149ms
token GET /api/hermes/update/check 200   550ms  (warm cache)
parallel burst of the nine          all 200, max 1783ms, total 4011ms
bare GET /api/status               200   public liveness path
bare GET /api/system/stats         401   gated, as designed
```

No 404s. No invented host/gateway numbers. The previous 1046-char notice was
the 5s client deadline vs a 10s git update-check, not a missing session token.

## Gauntlet commands

```text
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0
  WROTE gauntlet.json
  capturedAt 2026-08-27T18:33:34.126Z
  total 15/21 (scored from receipt + shots; not auto-awarded)
  sessions-1440    err=0  u24=0/27   nav=239x45  anim=pulse
  skills-1440      err=0  u24=0/251  nav=239x45  anim=0
  system-1440      err=0  u24=4/65   anim=pulse  body=2906
  sessions-390     err=0  u24=0/28
  sessions-1440-rm err=0  u24=0/27   anim=0
```

## Recipe

- Isolated loopback `127.0.0.1:9119` only.
- `waitUntil: 'commit'`. Never `networkidle`.
- Viewports 1440×900 and 390×844. Dark scheme.
- One reduced-motion context (`prefers-reduced-motion: reduce`).
- Provenance gate before the browser and again after. Entry digest stable.

## Maintainability (this slice)

- `SystemPage.tsx` 1524 → 1530 physical. `takeSettled` extracted to
  `settleWithTimeout.ts` so the oversized page did not absorb more load logic.
- `settleWithTimeout.ts` 27 → 50 physical. Tests 36 → 72 physical, 5 passed.
- No GSAP added to ops chrome.

## Not claimed

- No 19–21/21.
- No Awwwards 8+.
- No NousResearch push or upstream mutation.
- No password typed. No unauthenticated write tool.
