# Hermes Agent Core Fork — release ledger

Date: 2026-10-23 (Asia/Jerusalem). Status: complete planning specification; product releases remain planned, not delivered. First usable means the first qualified milestone for this audit, not an invented version tag.

Keep core-fork source changes in this repository and operating-instance changes with Hermes Operations. Associate each required patch with an existing core issue; an operational issue is context, not a substitute source tracker.

| ID | Priority | Release | Work / owner | Dependencies | Acceptance | Record | State |
|---|---|---|---|---|---|---|---|
| HA-01 | P1 | R1 | Bind the exact core fork, upstream baseline and named consumer requirement. Owner: Hermes core maintainer. | None | Source refs and dependency files match a concrete operating need; no source/runtime identity conflation. | Issue association pending; check existing repo issues | planned; completion proof pending |
| HA-02 | P1 | R1 | Run focused positive/failure/regression checks for that need. Owner: Hermes core tester. | HA-01 | Required workflow and unsupported configuration behavior pass on the exact candidate. | Issue association pending; check existing repo issues | planned; completion proof pending |
| HA-03 | P1 | R2 | Inventory the required local delta and upstream update evidence. Owner: Hermes core maintainer. | R1 | Each patch maps to an issue and retained regression; unrelated upstream features remain out of this release. | Issue association pending; check existing repo issues | planned; completion proof pending |
| HA-04 | P1 | R2 | Qualify compatibility and dependency changes. Owner: Hermes independent reviewer. | HA-03 | Tests, dependency checks and migration risks support an explicit go/no-go. | Issue association pending; check existing repo issues | planned; completion proof pending |
| HA-05 | P1 | R3 | Coordinate exact installed selection through the existing operations owner. Owner: Hermes operations owner. | R2 | Installed build/ref and selected instance identity are independently read back. | Issue association pending; check existing repo issues | planned; completion proof pending |
| HA-06 | P1 | R3 | Accept one delivery and a contained rollback exercise. Owner: Hermes operations tester. | HA-05 | Useful result and recovery preserve existing state; retained receipts match the selected version. | Issue association pending; check existing repo issues | planned; completion proof pending |

## Evidence gaps and publication ledger

| Gap | Observed state | Owner and next action | Effect |
|---|---|---|---|
| Full original audit | Only listed source files and bounded issue readbacks used. Original per-item audit coverage not proved. | Existing audit owner recovers returns and records exact unassessed ranges. | Planning can publish; audit stays partial. |
| Owner acceptance | Role routing proposed; no new native acceptance claimed. | Chief binds existing owner identity before execution transfer. | No competing author created. |
| Current product proof | No product tests, native process, provider or live workflow run in this documentation pass. | Existing repo owner runs milestone checks through its qualified route. | Product milestones remain planned. |
| Source and remote drift | File hashes and local HEAD are recorded separately. | Publisher refreshes destination identity and source custody. | No clean-tree or remote-parity claim. |
| Documentation delivery | Prepared artifacts only. | Publisher records actual commit and independent development/primary branch readback hashes. | Close only after both destinations verified. |


## Current linked record observations

- New milestone rows require association with existing issues after a duplicate check; no issue is invented.

Closed historical records are context; current installed acceptance requires fresh outcome proof.

## Next work in order

1. HA-01 — Bind the exact core fork, upstream baseline and named consumer requirement.
2. HA-02 — Run focused positive/failure/regression checks for that need.
3. HA-03 — Inventory the required local delta and upstream update evidence.
4. HA-04 — Qualify compatibility and dependency changes.
5. HA-05 — Coordinate exact installed selection through the existing operations owner.
6. HA-06 — Accept one delivery and a contained rollback exercise.
