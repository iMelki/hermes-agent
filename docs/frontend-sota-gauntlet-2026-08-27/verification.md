# Verification — hermes-web gauntlet 2026-08-27

## Commands

```text
# Served health
Invoke-WebRequest http://127.0.0.1:9119/  -> 200, 721 raw bytes

# Provenance (self-test + negative control + live capture)
node docs/evidence/lib/bundle-provenance.mjs http://127.0.0.1:9119
  control.proven=true
  negative.proven=true (accept, dead port, HTTP 500, login redirect)
  verdict.ok=true

# Gauntlet
node docs/frontend-sota-gauntlet-2026-08-27/gauntlet.mjs
  EXIT=0 after 133s
  WROTE gauntlet.json
```

## Recipe

- Isolated loopback `127.0.0.1:9119` only. No private server invented.
- `waitUntil: 'commit'`. Never `networkidle`.
- Viewports 1440×900 and 390×844. Dark scheme.
- One reduced-motion context (`prefers-reduced-motion: reduce`).
- Provenance gate before the browser and again after. Entry digest stable.

## Identity readback

| Check | Result |
|---|---|
| Runtime git SHA | `cea8fa537d95257201a999d59f1846c933adb439` |
| Workspace `dev` SHA | same |
| `origin/dev` | `a154e8be8` (merge PR #2; **empty tree diff** vs `cea8fa537`) |
| Served JS/CSS vs runtime `web_dist` | match |
| Login redirect | none (`redirected: false`, session bootstrap present) |

## Negative controls (this run)

Provenance verifier rejected a dead port (`FETCH_FAILED`), HTTP 500
(`ENTRY_STATUS_NOT_200`), and a 302→`/login` (`ENTRY_REDIRECTED`), and accepted
a well-formed fake dashboard. Recorded in `gauntlet.json`.

## Not claimed

- No 19–21/21.
- No repo `web/` unit/lint suite in this run.
- No contrast-pair sweep (that lives in the larger `capture-hermes-web.mjs` harness).
- Reduced-motion did **not** clear animations (`spin` still present).
