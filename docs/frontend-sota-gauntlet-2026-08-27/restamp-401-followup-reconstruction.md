# Restamp reconstruction — `cf417614d3` (2026-08-27 401 follow-up)

> **This is a RECONSTRUCTION from a recovered log, not a fresh live verification.**
> Nothing here was observed by the agent that wrote it. The `127.0.0.1:9119`
> processes of 2026-08-27 are gone and the runtime `web_dist` has been overwritten
> several times since, so the window this describes cannot be reopened or re-measured.
> Every claim below is bounded by what a 4-line receipt can carry.

Parent: [iMelki/hermes#45](https://github.com/iMelki/hermes/issues/45).
Gauntlet scorecard for the evening's final state: `docs/frontend-sota-gauntlet-2026-08-27/scorecard.md`
Source receipt: `docs/frontend-sota-gauntlet-2026-08-27/restamp-401-followup.log`
(recovered by `5f72bd3928`; **do not edit it** — it is an honest capture of what happened).

## Why this file exists

Every other `fix(web)` of 2026-08-27 got its own `docs(web): restamp :9119 to <sha>
and recapture NN/21` commit. `cf417614d3` did not: the docs chain skipped from
`d9872fd7d7` (restamping `9faae85`) straight to `9c343b487f` (restamping `3bea4c481`).
The fix landed on `dev` with no scorecard or verification entry of its own.

| # | source fix | landed (+0300) | restamp docs commit |
|---|---|---|---|
| 1 | `3a0f08fbeb` restore heading scale | — | `39da16505a` |
| 2 | `9faae85d97` honest `/system` body | 20:43:40 | `d9872fd7d7` |
| 3 | **`cf417614d3`** skip loopback `/api/auth/me` 401 | **20:54:19** | **none — this file** |
| 4 | `3bea4c4819` clear 24px / 44px floors | 21:12:38 | `9c343b487f` |
| 5 | `9cb51827e1` lift chrome to 24px | — | `6f2424219a` |
| 6 | `d5ca89ca2a` `/system` in-page links | — | `a720ad7ab1` |

The receipt was written 20:56:59 +0300 — 2m40s after the commit — which is why it
survived at all: it was still untracked in an abandoned working tree when the recovery
pass found it.

That 20:56:59 is a file mtime, not an in-file timestamp: unlike its sibling, this
receipt prints no clock. The mtime is trustworthy here because its sibling
`restamp-system-links.log` carries both — mtime `2026-08-27 21:43:11.1477 +0300`
against its own last line `2026-08-27T18:43:11.1472708Z restamp script done`, the same
instant to sub-second. The recovery preserved write times. (A fresh clone will not:
git stores no mtimes, so this cross-check only holds on the machine that recovered them.)

## The fix being reconstructed

`cf417614d3c6fbead26d86db97fdc33b77de5db2` — *fix(web): skip loopback `/api/auth/me`
401 and lift leftover hit targets*. 7 files, +33/−8:

- `web/src/components/authWidgetGate.ts` (new) — `shouldFetchAuthMe(authRequired)`
  returns `true` only when the OAuth gate is engaged, so loopback stops probing a
  route that 401s by design.
- `web/src/components/authWidgetGate.test.ts` (new) — the fix shipped its own test.
- `App.tsx`, `AuthWidget.tsx`, `SidebarStatusStrip.tsx`, `SessionsPage.tsx`,
  `SkillsPage.tsx` — the gate wiring plus leftover hit-target lifts.

## What the recovered receipt proves

```text
recycleCount=0
copyJsMatch=True hash=9fc4e2266bcbc5dbda966a9588436f45fc56e208279b3572a118de34a1931218
runtimeHead=cf417614d3c6fbead26d86db97fdc33b77de5db2 fix(web): skip loopback /api/auth/me 401 and lift leftover hit targets
status=## HEAD (no branch)  M package-lock.json
```

Read literally, and no further:

- The runtime checkout under `%LOCALAPPDATA%\Hermes\hermes-agent` was detached at
  `cf417614d3` — the fix reached the runtime tree, not just `dev`.
- A freshly built JS bundle was copied into the runtime `web_dist` and the copy's
  SHA-256 matched its source (`copyJsMatch=True`), digest
  `9fc4e2266bcbc5dbda966a9588436f45fc56e208279b3572a118de34a1931218`
  (64 hex, well-formed).
- `recycleCount=0` — no stale runtime assets needed recycling on this pass.
- The runtime tree carried only `package-lock.json` dirt, consistent with every
  other receipt that evening; the detached-HEAD state matches the documented
  "fetch `imelki` only, never `origin`/NousResearch" restamp path in `verification.md`.

## Digest shape — counted, not eyeballed

A 2026-09-01 reconciliation pass read this receipt as carrying a **63**-character
digest and opened it as an off-by-one in the producer. It is 64. Counted three
independent ways, so nobody has to re-litigate it by eye:

```text
$ sed -n '2p' restamp-401-followup.log | awk '{split($2,a,"="); print length(a[2])}'
64
$ sed -n '2p' restamp-401-followup.log | od -c | tail -2
0000120   9   3   1   2   1   8  \n
0000127
```

`0127` octal = 87 bytes for the whole line: `copyJsMatch=True hash=` (22) + 64 + `\n`.
Nor is it a lone survivor. Scanning every lowercase hex run of length 30–70 under
`docs/` finds **27 at exactly 40 and 36 at exactly 64 — and none of any other length**.
Of those, 22 are digest-labelled (`sha256:`, `hash=`, `"servedHash":` …); all 22 are 64.
There is no short digest anywhere in this fork's evidence.

Neither failure mode named in that report is present, and neither is reachable from this
repo's own code. Every in-repo producer of an *evidence* digest goes through Node
`createHash('sha256').…digest('hex')` — `docs/evidence/lib/bundle-provenance.mjs` and
`docs/frontend-sota-gauntlet-2026-08-31/hermes-dashboard/measure.mjs`, both fork-side
files — which is fixed-width and keeps leading zeros. Truncating call sites do exist
(`…hexdigest()[:16]` in `agent/`, `gateway/`, `scripts/whatsapp-bridge/bridge.js`), but
they sit in the upstream-tracked runtime trees and mint deliberate short cache/session
IDs at 12, 16 or 24 chars — never receipt evidence, and never 63.  The per-byte
`'{0:x}' -f` PowerShell idiom that *does* drop leading zeros appears nowhere in this tree.

And the script that wrote this receipt is not in this repo at all: it ran from the
runtime checkout and was never committed here. There is no producer on this fork's
surface to fix, so no producer fix or `^[0-9a-f]{64}$` regression test was added —
a test with no real failing direction would be theatre. The receipt's genuine weakness
is the missing `name=`/`bytes=` described below, not the digest's shape.

## What it does NOT prove — read this before quoting it

- **No HTTP receipt.** Unlike `restamp-system-links.log`, this receipt has no
  `starting dashboard` section and no `hermes-native-dashboard-start` JSON. There is
  no `serving=true httpStatus=200` for `cf417614d3`. The nearest dashboard-start
  receipts belong to the passes on either side (17:33:48Z → `9faae85`,
  18:14:01Z → `3bea4c481`).
- **No browser capture, no score.** No shots, no `gauntlet.json`, no `served-identity.json`
  for this pass. The 15/21 in `scorecard.md` was measured at `d5ca89ca2a`, four commits
  later, and is unchanged by this file.
- **The commit message of `5f72bd3928` overstates it.** It calls this log "the only
  record that `cf417614d3` was ever verified live". What the log actually records is a
  *deploy with a matching copy digest* — deployed to the runtime, not observed serving.
  That wording is corrected here rather than in the commit, which is immutable history.
- **The digest is unbindable.** This receipt prints a bare `hash=` with no `name=` and
  no `bytes=`. The later receipt from the same evening
  (`restamp-system-links.log`, 18:42:59Z) prints
  `copyJsMatch=True name=index-DFSF3_kR.js hash=… bytes=1973248` — same field, two more
  columns, so the two receipts were not written by the same producer revision. Whatever
  the cause, `9fc4e226…` cannot be tied to a named artifact and is not re-derivable.
  The bundle was recycled as stale at one of the later passes that evening — the
  18:42Z receipt alone recycles five (`index-B11cbVOj.js`, `index-BloUMaE8.js`,
  `index-CAurVnFC.js`, `index-BBNSWGzv.css`, `index-COrOpURM.css`) — but **which
  file carried this digest is unknowable**, precisely because this receipt omitted
  `name=`. Matching it by name is the one check the omission forecloses.
  A digest with no name and no byte count is the real evidence weakness here.

## Corroboration that is still runnable today

The live window is gone, but the fix's own falsifiability is not. `cf417614d3` shipped
`web/src/components/authWidgetGate.test.ts`, and it still passes at current `dev`:

```text
cd web && npx vitest run src/components/authWidgetGate.test.ts
  Test Files  1 passed (1)
  Tests  2 passed (2)          # 2026-09-01, 258ms
```

Failing-direction control (run outside the repo tree; nothing in the repo was edited):
the three shipped assertions were replayed against the shipped `shouldFetchAuthMe` and
against two wrong implementations — the pre-fix always-probe behaviour the commit
removed, and a `authRequired !== false` near-miss that treats "unknown" as "gated".
The shipped implementation passes; **both** wrong implementations are rejected. The
assertions therefore discriminate, so the green above is a real signal and not a
vacuous one.

## Not claimed

- Not a live verification of `cf417614d3`. No `serving=true`, no HTTP 200, no shots.
- No score change. `scorecard.md` stays **15 / 21** at `d5ca89ca2a`; no Awwwards 8+.
- No re-derivation of `9fc4e226…`; the bundle is gone.
- No edit to `restamp-401-followup.log`, to any commit message, or to any 2026-08-27
  scorecard/verification number.
- No NousResearch push or upstream mutation.
