# Verification — hermes-web gauntlet /system in-page 24px 2026-08-27

## Restamp path used

Documented serve path (no dedicated restamp script; no ops pin file present):

1. Build source `web/` with `NODE_OPTIONS=--use-system-ca npm run build`
   → `hermes_cli/web_dist` (`web/README.md`, `vite.config.ts` `outDir`).
2. Recycle stale hashed assets in
   `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist` via
   `Remove-ItemToRecycleBin.ps1`, then copy the new `web_dist`.
3. Stop the previous :9119 `pythonw` listener. Windowless start:
   `S:\source\CCAI\Assistants\hermes\scripts\windows\Start-HermesNativeDashboard.ps1 -Force -Json`
   → `action=started serving=true http=200 pid=81552`.
4. After the docs commit, local-only `git fetch imelki` + `git switch --detach <HEAD>`
   on the runtime checkout. **Did not fetch or push `origin` (NousResearch).**
   Runtime `package-lock.json` dirt was left untouched.

## Attribution proof

```text
GET /               200  SERVED_JS=/assets/index-DFSF3_kR.js
GET JS              200  1973248 B  sha256:89bc089d96d2d58edadbbc6c0d4332eb9ea92cbba3b1b77d222ce1471e97cbdb
disk source JS      same hash
disk runtime JS     same hash
GET /api/status     200  version 0.18.2 (no git SHA field; no SPA session header)
source fix HEAD     d5ca89ca2a52c58a470d8714d487720abaeb8348
```

No password typed. Session token from the launcher HTML was not copied into
receipts.

## Gauntlet commands

```text
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0
  WROTE gauntlet.json
  capturedAt 2026-08-27T18:44:18.402Z
  total 15/21 (scored from receipt + shots; not auto-awarded)
  sessions-1440    err=0  u24=0/27   nav=239x45  anim=pulse
  skills-1440      err=0  u24=0/251  nav=239x45  anim=0
  system-1440      err=0  u24=0/65   anim=pulse  body=2905
  sessions-390     err=0  u24=0/28
  sessions-1440-rm err=0  u24=0/27   anim=0
```

## Recipe

- Isolated loopback `127.0.0.1:9119` only.
- `waitUntil: 'commit'`. Never `networkidle`.
- Viewports 1440×900 and 390×844. Dark scheme.
- One reduced-motion context (`prefers-reduced-motion: reduce`).
- Provenance gate before the browser and again after. Entry digest stable.

## Live heading check (no change)

`h1` **18.75px** vs body **15px** on every captured surface. Heading is larger
than body, so the old inversion (13.125 vs 15) is gone. No heading-scale edit
this pass.

## Maintainability (this slice)

- `SystemPage.tsx` 1530 → 1533 physical. Already oversized; no section extract.
  Shared `SYSTEM_IN_PAGE_LINK` constant only.
- `systemPageShared.ts` 58 → 61 physical.
- No GSAP added to ops chrome.

## Not claimed

- No 19–21/21.
- No Awwwards 8+.
- No NousResearch push or upstream mutation.
- No password typed. No unauthenticated write tool.
- Command Center hermes scoreboard row not edited (15/21 unchanged).
