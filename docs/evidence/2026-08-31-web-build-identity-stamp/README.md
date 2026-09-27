# hermes-web build-identity stamp — implemented and proven able to fail (2026-08-31)

Lane: close the falsifiability gap named in
[`2026-08-25-hermes-web-bundle-provenance`](../2026-08-25-hermes-web-bundle-provenance/README.md)
open item 2: *"No build-provenance endpoint. The dashboard cannot state its own build identity."*
Serving model untouched — no server code changed, no process restarted, runtime tree read-only.

## Mechanism

`hermes:build-stamp` Vite plugin in `web/vite.config.ts` (build-only):

- resolves `git rev-parse HEAD` at build start and **throws if it cannot** — an
  unattributable bundle must not build silently;
- `dirty` = uncommitted changes under `web/` or `apps/shared` only, so docs/evidence churn
  elsewhere cannot taint attribution;
- injects `<meta name="hermes-build-commit|time|dirty">` into `index.html`;
- emits `web_dist/build-info.json` (`{commit, dirty, buildTime, schemaVersion:1}`).

Both exposures ride the existing static catch-all in `hermes_cli/web_server.py`
(`serve_spa` returns any real file under `WEB_DIST`), so once a stamped bundle is deployed,
`GET /build-info.json` answers with the build identity and the entry HTML carries it in-band —
zero serving-model change. Comparable dashboards expose the same surface: Grafana `/api/health`
(version+commit), Gitea `/api/v1/version`.

## Gate

`web/scripts/check-build-stamp.mjs`, wired as the final step of `npm run build`
(`tsc -b && vite build && node scripts/check-build-stamp.mjs`), plus a standalone
`npm run check:stamp`. Fail-closed: every read error is a rejection with a named reason.
`--require-head-match` upgrades the advisory HEAD comparison to a failure (advisory by default:
a checker run after later commits legitimately sees a moved HEAD).

## Proof — positive control

Build at `f609c125` (dirty: the stamp change itself was uncommitted at build time):

```json
{"ok":true,"commit":"f609c1257811cf00475cb497abfd68fd32f52351","dirty":true,
 "buildTime":"2026-08-31T00:09:50.902Z","headMatches":true}
```

Emitted `index.html` carries all three meta tags; `build-info.json` matches byte-for-byte.

## Proof — the gate can fail (revert-the-fix, in the gate's own runner)

A bundle was built with **HEAD's pre-fix `vite.config.ts`** (extracted via
`git show HEAD:web/vite.config.ts`, built with `vite build --config` into scratch).
The build exits 0; the gate rejects it:

| case | reason | exit |
|---|---|---|
| pre-fix config build (revert-the-fix) | `META_COMMIT_MISSING` | 1 |
| **live runtime dist** `%LOCALAPPDATA%\Hermes\hermes-agent\hermes_cli\web_dist` (read-only) | `META_COMMIT_MISSING` | 1 |
| index stamped, `build-info.json` deleted | `BUILD_INFO_MISSING` | 1 |
| json commit ≠ meta commit | `COMMIT_MISMATCH` | 1 |
| `build-info.json` truncated at 40 bytes | `BUILD_INFO_UNPARSEABLE` | 1 |
| dist dir absent | `DIST_MISSING` | 1 |
| coherent stamp forged to non-HEAD sha, `--require-head-match` | `HEAD_MISMATCH` | 1 |
| healthy stamped dist, `--require-head-match` (accept case) | — | 0 |

Each rejection is for its *own* named reason; the accept case stops a reject-everything gate
from passing.

## Running instance

:9119 still serves the pre-fix bundle (`index-DFSF3_kR.js` era) — the gate run against its
on-disk dist fails `META_COMMIT_MISSING`, which is the honest current state. The next governed
restamp/deploy of `web_dist` picks up the stamped build. Nothing was restarted or copied into
the runtime tree by this lane.

## Tracking

- iMelki/hermes-agent has issues disabled; falsifiability issue filed in the ops repo
  iMelki/hermes (see commit message / OPEN_TASKS.md there).
- Prior provenance record: iMelki/agent-settings#689.
