# Gate-proof preservation

Tracking: [agent-settings #1130](https://github.com/iMelki/agent-settings/issues/1130).
The root-install and component-sourcing proofs formerly modified owner-checkout
paths. The former could delete a partial Vite cache; the latter could overwrite
and delete an occupied TSX plant path. Neither repaired proof writes those paths.

## Bounded commands

Use an explicit windowless process launcher on Windows. No package installation,
build, service, provider, taskkill, or Actions activation is needed.
For the historical Git read, resolve a trusted installed Git executable in the
caller and pass its absolute path as `HERMES_PROOF_GIT` in the child environment.
Git receives only an allowlisted OS/temp environment, excluding every `GIT_*`
override; its explicit checkout cwd, 10-second timeout and 16-KiB output cap are
fixed. Missing executable/object, timeout and spawn errors are harness failures,
not negative preservation verdicts.

```text
node tests/gate-evidence/gate-proof-preservation.test.mjs --prove-previous
node tests/gate-evidence/gate-proof-preservation.test.mjs
node tests/gate-evidence/assert-root-install-proof.mjs
node tests/gate-evidence/component-sourcing-preflight-proof.mjs
```

The first command is an intentional **red proof**, expected exit 1: it reads the
two exact published proof sources at `ca0b4f9de6bc4411039190ac0edf767c8204bc21` from
Git and executes them against in-memory filesystem/child doubles. It asserts
preservation and reports two attributed assertion failures, never live deletion.
That object must be available locally; a missing object is a harness failure,
not a preservation verdict. Do not run the old scripts themselves.

The ordinary suite expects exit 0 and is wired as package script
`test:gate-proof-preservation`. It includes the two historical counterexamples,
canonical scratch-byte and invocation checks, exclusive-write refusal, and a
matrix for both repaired proofs: success, negative failure, restored failure,
throw, and synthetic interruption. Every matrix case compares all owner-fixture
paths and bytes before and after, including a partial Vite cache and occupied
TSX path. Success cases execute the byte-copied real gate CLI entrypoints.

The individual proof CLIs emit JSON with the retained fixture root, gate source
SHA256, and observed negative/restored exit codes. The root-install proof keeps
the gate's original relative root contract and adds only a synthetic package
presence stub. The component proof keeps the exact CLI contract and restores
validity by adding a seven-field sourcing record, not by deleting its plant.

## Ownership and retention

The canonical scratch helper is byte-pinned in
`ephemeral-scratch.provenance.json`; it is a copied artifact, not a runtime import
from another repository. Every root is exclusively created using its conforming
name grammar. On Windows roots must be on C:. Linked/non-directory ancestors,
escaped writes, and occupied files are refused. Each root contains
`.proof-owner.json`. Child temp output is confined through TEMP, TMP and TMPDIR;
child environments omit provider credentials. Gate copies are capped at 128 KiB.

There is **no automatic deletion or fixture teardown** on success or failure.
Small synthetic fixtures remain available for reviewer readback. Record the CLI
JSON paths in the private execution checkpoint. Any later cleanup requires its
own approved recoverable-cleanup action; never sweep owner checkout paths.

## Evidence and limits — 1 October 2026

- Published-head red proof: two attributable preservation failures, exit 1;
  zero real owner-filesystem mutations.
- Repaired focused suite: 14 passed, zero failed, exit 0.
- The canonical scratch copy matches agent-settings commit
  `5631d9208102c29e41828bd06afeb74d125a3354`, blob
  `4420b198b56f7eec242f2307f2ff05a3478fa13e`, and its recorded SHA256.
- Exception/interruption tests use synthetic errors. No OS-level interruption,
  child timeout/kill, or process-tree control was exercised.
- This proves isolated gate attribution and preservation, not npm installation,
  a real Vite/Electron build, the Python suite runner, all four gate proofs,
  workflow declarations, hosted checks, or merge acceptance. Other PR5 proofs
  retain their historical scope and were not run by this repair.

Keep PR5 draft until non-author exact-head review and the separate current
landing gates are resolved. PR3, PR4, runtime state, and fork Actions are outside
this preservation repair.
