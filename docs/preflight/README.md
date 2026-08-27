# Component sourcing preflight gate

This directory backs the mechanical component-sourcing gate for this fork
(fork-local governance; see iMelki/hermes#45 and iMelki/agent-settings#586). The gate
enforces the Required Preflight Record rule from the shared sourcing workflow before any
new UI component lands in `web/src/components`.

## Enforcement status: MANUAL (read this first)

**This fork has no hook infrastructure.** There is no `.pre-commit-config.yaml`, no
`.husky/`, no `core.hooksPath`, and no non-sample hook in `.git/hooks`. Unlike the fleet
siblings that run this gate from a pre-commit hook, here the gate is a script plus an
npm target and **nothing runs it automatically**. A commit that adds an unrecorded
component to `web/src/components` will succeed.

That is a deliberate honest partial, not an oversight: the fork tracks upstream
`NousResearch/hermes-agent`, and installing a hook framework it does not have would be a
heavy, merge-hostile change for a 26-component surface. Run the gate yourself:

```bash
npm run gate:component-sourcing
```

Exit code `0` = pass, `1` = fail with one line per failure. It has zero dependencies and
runs in well under a second, so it is cheap to run by hand before pushing UI work.

To promote this to real enforcement later, wire
`node scripts/verify-component-sourcing-preflight.mjs` into whichever hook or CI mechanism
the fork adopts first — the script is the stable part and needs no changes.

## Scope

Only `web/src/components/**/*.{tsx,jsx}` is gated. Other TSX-bearing trees in this repo
(`ui-tui`, `apps/*`, `website`) are **not** covered. Widen the scope by editing the
`CONFIG` block at the top of `scripts/verify-component-sourcing-preflight.mjs`, and
baseline the newly-in-scope files in the same change.

## How it works

`scripts/verify-component-sourcing-preflight.mjs` (zero dependencies):

1. It inventories every `.tsx`/`.jsx` file under `web/src/components`.
2. Files listed in `component-baseline.json` are grandfathered (`{file, reason}` entries).
   The baseline only ratchets down: an entry whose file no longer exists FAILS the gate
   until the entry is removed.
3. Every remaining file must be matched by a `Covers:` line (exact repo-relative path or
   glob) in at least one record under `records/*.md` that contains all 7 sourcing-record
   fields with non-placeholder values (TODO/TBD/n-a are rejected).

The initial baseline holds the 26 components that existed at the time the gate landed. It
is a starting line, not an approval of those 26 — anything new must carry a record.

## Writing a record

Copy the 7-field record from the shared prompt
`agent-settings/shared/prompts/frontend-component-sourcing.md` (resolve your local
`agent-settings` checkout via the `AGENT_SETTINGS_ROOT` environment variable; on the
canonical operator machine that is `S:\source\CCAI\Assistants\agent-settings`)
into `records/<date>-<slug>.md`, fill every field, and add a `Covers:` line naming the
component file(s). Validate the record body with the shared PowerShell checker:

```powershell
# Set AGENT_SETTINGS_ROOT to your local agent-settings checkout first, e.g.
#   $env:AGENT_SETTINGS_ROOT = 'S:\source\CCAI\Assistants\agent-settings'
pwsh -File $env:AGENT_SETTINGS_ROOT\shared\tools\Test-FrontendComponentSourcingPreflight.ps1 `
  -BodyFile docs\preflight\records\<date>-<slug>.md -RequireKnownPoolMention -Json
```

Reviewed exceptions go into `component-baseline.json` as `{file, reason}` — a reviewed
decision, not a convenience escape hatch.

## Honesty gap (named on purpose)

The gate enforces record EXISTENCE, structure, and coverage only. Record QUALITY — whether
the sourcing ladder was genuinely walked, whether the chosen lane is right — stays a review
concern. A mechanically green gate is not proof the sourcing decision was good. And in this
fork specifically, a green gate only means someone chose to run it.
