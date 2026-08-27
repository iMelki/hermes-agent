# Exhibit: a capture record that passed the provenance gate while the dashboard was down

**This directory is not a score capture. Do not read numbers out of it.** It exists to
hold the evidence for one defect, so the defect stays falsifiable after the runtime
state that produced it is gone.

## What happened

`docs/evidence/lib/bundle-provenance.mjs` closed a fail-open hole in `4d216e87`: the
recorder used to exit 0 against a dead port, and the capture harness now runs the
recorder, its self-test and its negative control **before** launching the browser, and
refuses to capture when the target is not an identifiable Hermes build. Verified
independently on 2026-08-24: a dead port, an HTTP 500 and a 302-to-`/login` fixture are
each rejected with their own named reason and exit 2, and the wired harness writes no
`telemetry.json` in any of the three cases.

That gate is **pre-flight only**. It proves the target was healthy at the moment the run
started and then never looks again.

On 2026-08-24 a full 30-result run against `127.0.0.1:9119` did this:

| stage | observation |
| --- | --- |
| pre-flight gate | accepted — entry `a5d68cc2…`, `index-B4nfmVYw.js` `3d6d6a65…`, `index-CpQhiCeR.css` `ec7a3c4b…` |
| during the run | the gateway stopped answering |
| results 18-30 | 11 × `page.goto: Timeout 30000ms exceeded`, then 2 × `net::ERR_CONNECTION_REFUSED` |
| record written | `provenanceVerdict.ok === true`, 30 results, **13 with no navigation and no probe data** |
| after the run | nothing listening on 9119 |

`telemetry-incomplete-20260824T021748Z.json` in this directory is that record, kept
verbatim. Its `provenanceVerdict` says the target was fine. Thirteen of its thirty
results say otherwise. A reader who trusted the verdict would score seventeen surfaces
and believe they had thirty.

This is the same fail-open class the pre-flight gate was written to close, one level
down: **a control that observes the target once and then reports on a window it did not
observe.**

## The fix

`capture-hermes-web.mjs` now re-asserts after the browser work and refuses to write a
record unless all three hold:

| assertion | catches |
| --- | --- |
| every result has a navigation (`!r.error && r.nav`) | the target dying, hanging, or refusing partway through |
| the provenance verdict still passes, re-measured after the run | the target being down at the end |
| the normalized entry digest is unchanged before vs after | a rebuild or redeploy mid-run, i.e. results describing two different artifacts |

`telemetry.json` gains `provenanceAfter`, `provenanceAfterVerdict` and
`captureIntegrity { resultCount, navFailureCount, entrySha256Stable }`, so a reader can
see the window was observed rather than assumed.

### Proven able to fail, and proven not to reject everything

Both runs used a Hermes-dashboard-shaped loopback fixture, so neither touched the real
gateway.

| case | pre-flight | outcome |
| --- | --- | --- |
| fixture closes 45 s into the run | `PROVENANCE OK` | **EXIT 2**, `CAPTURE_INCOMPLETE: 21 of 30 results have no navigation` + `TARGET_NOT_HEALTHY_AFTER_CAPTURE`, **no `telemetry.json` written** |
| identical fixture, stays up | `PROVENANCE OK` | **EXIT 0**, `PROVENANCE STABLE across the run … navFailures=0`, record written with `captureIntegrity.navFailureCount = 0` |

The accept case is the control on the control: a check that rejected unconditionally
would pass the first row while being exactly as useless.

## What is still open

- **The gateway on `127.0.0.1:9119` was down when this was written and was deliberately
  not restarted.** It backs the operator's live agent; restarting or re-pointing it is
  an operator decision. The scheduled task reported `Running` while nothing listened on
  the port, so task state is not a liveness signal for this service.
- Because the gateway is down, the accept path of the new assertion has been proven
  **against a fixture, not against the live dashboard**. That is stated rather than
  glossed: the next real capture is what confirms it end to end.
- No capture record carrying build identity has been committed for the live dashboard
  yet, so hermes-web's score remains unfalsifiable in the register until one is.

## Build identity of the served artifact, independently confirmed

Recorded over HTTP by the provenance recorder, then checked against the on-disk files in
the runtime root with `sha256sum` — the two agree exactly:

| file | bytes | sha256 |
| --- | --- | --- |
| `/assets/index-B4nfmVYw.js` | 1,588,948 | `3d6d6a65f88688def5a76472f9abab623ed67e31ad5e0fe78a0ad791d830dfae` |
| `/assets/index-CpQhiCeR.css` | 101,506 | `ec7a3c4bbcfc50c91da6d37ace1bc0445bc7e881e8e06e07fc572c6c94315771` |
| entry HTML, normalized (session bootstrap stripped) | 511 (from 722) | `a5d68cc25cf2138f51c1f5471cd8e20dfe77eaa814543db9071f926ca36a38cb` |

Those asset files are dated 2026-06-12 on disk, consistent with the runtime serving a
detached-HEAD checkout that is 65 days older than the audited tree.

**Secret handling:** the recorder strips the injected `window.__HERMES_*` bootstrap
before hashing. The record in this directory was grepped for the token globals and the
fixture token strings before being committed; only the literal substring `__HERMES_`
appears, inside three rejection-reason strings. No session token is present.

Tracked on `agent-settings#689`. Read-only throughout: GETs and page navigations only,
nothing started, stopped, rebuilt or re-pointed.
