# Hermes Agent Core Fork — release plan

Date: 2026-10-23 (Asia/Jerusalem). Status: complete planning specification; product releases remain planned, not delivered. First usable means the first qualified milestone for this audit, not an invented version tag.

## Current baseline

The owned fork is locally identified separately from Hermes operations. README describes the upstream agent, gateway and provider surfaces; pyproject.toml and package metadata are present. This is not evidence that this checkout is the selected running version. No live runtime or provider route was changed.

Repository: `iMelki/hermes-agent`; observed branch `dev`; HEAD `e3cc61660b8ffefc529ee2979b8c76a8bd500322`; observation `2026-10-22T22:03:46.559Z`. [Provenance](fleet-release-provenance-2026-10-23.json) binds the actual working-tree files read. Clean status, remote parity, installed behavior and complete historical coverage are unverified.

## Ownership and tracking

Accountable routing role: **Existing Hermes core-fork maintainer**. Existing maintainer custody is preserved. This is proposed routing, not accepted reassignment. An independent repo reviewer owns source/test review; the existing product/runtime owner accepts the actual user outcome.

Keep core-fork source changes in this repository and operating-instance changes with Hermes Operations. Associate each required patch with an existing core issue; an operational issue is context, not a substitute source tracker.

- New milestone rows require association with existing issues after a duplicate check; no issue is invented.

## Ordered releases

### R1 — First usable: a reproducible core candidate

**Outcome:** An exact core version supports one existing required local workflow.

**Scope:** Core/source selection, pinned dependency graph and targeted compatibility proof; no feature expansion.

**Dependencies:** HA-01, HA-02.

**Acceptance:**

- The consumer requirement and exact fork/upstream revisions are recorded.
- Focused tests cover the required workflow and invalid inputs; no claim of installed adoption follows from a source checkout.

**Rollback:** Retain the last accepted upstream/fork ref and dependency lock; revert the patch without replacing user state.

### R2 — Maintainable upstream synchronization

**Outcome:** Required local changes survive a reviewed upstream update with a documented delta.

**Scope:** Minimal patch inventory, version constraints, compatibility tests and security review.

**Dependencies:** R1, HA-03, HA-04.

**Acceptance:**

- Every local delta has a purpose, owner and regression test or a reason it is removed.
- Selected upstream update passes source tests and dependency checks; no automatic latest-version rollout.

**Rollback:** Restore the prior reviewed ref/lock and preserve migration inputs; do not downgrade live data blindly.

### R3 — Accepted operating-runtime adoption

**Outcome:** The operations owner can prove the selected build actually serves its intended workflow.

**Scope:** Exact installed version, bounded startup and one authorized delivery under existing operations custody.

**Dependencies:** R2, HA-05, HA-06.

**Acceptance:**

- Installed source identity equals the accepted candidate and one useful workflow passes.
- Failure and rollback restore the prior selected core without losing conversations/configuration.

**Rollback:** Use the operations owner’s contained backup and previous build; preserve logs and state.

## Execution and quality

Follow the [ledger](fleet-release-ledger-2026-10-23.md) in dependency order, at most two active implementation/diagnostic items per owner lane. Missing historical evidence becomes a named gap rather than blocking publication of this plan. Reuse existing tests, runbooks and approved components. A nontrivial frontend replacement needs a local-first component-curator comparison and provenance/license evidence before implementation.

Bind every release decision to the exact candidate, destination, timestamp, relevant positive/failure/regression checks and rollback. Independently read back the requested result. Source tests or HTTP success alone do not prove installed behavior or useful delivery. Provider enrollment, paid calls, external publishing, account creation, process changes and destructive actions retain their separate task authority.

## Documentation publication

The operator requested these sanitized artifacts on development and primary release branches. The existing publisher resolves actual current branch names, preserves concurrent work, carries only reviewed documents, runs normal privacy/secret checks and reads back identical document bytes from each destination. Record missing/renamed branches explicitly. Preserve branch-specific architecture; do not merge product changes just to copy plans. Publication is pending until verified.
