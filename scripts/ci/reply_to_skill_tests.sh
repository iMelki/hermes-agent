#!/usr/bin/env bash
# Run the Reply-To skill tests through scripts/run_tests.sh, log the
# collected count and every outcome count, and fail when no test ran.
#
# GitHub Actions checks out the pull request merge ref (github.sha).
# PR_HEAD_SHA is the pull request head, logged beside github.sha.
# A local run omits both and logs the working tree commit.
#
# Extra arguments replace the default file list (used to prove the
# zero-collected failure). With no arguments the two CTO-named files run:
#   tests/skills/test_google_workspace_api.py
#   tests/skills/test_reply_to_primitive_conformance.py

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT"

SHA="$(git rev-parse HEAD)"
# Actions sets GITHUB_SHA to the merge ref on pull_request. The checkout
# must be that commit, not a fork head override.
if [ -n "${GITHUB_SHA:-}" ] && [ "$SHA" != "$GITHUB_SHA" ]; then
  echo "::error::checked out ${SHA}, expected github.sha ${GITHUB_SHA}"
  exit 1
fi
GITHUB_SHA_VALUE="${GITHUB_SHA:-$SHA}"
PR_HEAD_SHA_VALUE="${PR_HEAD_SHA:-}"

if [ "$#" -gt 0 ]; then
  FILES=("$@")
else
  FILES=(
    tests/skills/test_google_workspace_api.py
    tests/skills/test_reply_to_primitive_conformance.py
  )
fi

write_summary() {
  local collected="$1" passed="$2" failed="$3" skipped="$4" errors="$5"
  local xfailed="${6:-0}" xpassed="${7:-0}"
  echo "reply-to-skill-tests github_sha=${GITHUB_SHA_VALUE} pr_head_sha=${PR_HEAD_SHA_VALUE} collected=${collected} passed=${passed} failed=${failed} skipped=${skipped} errors=${errors} xfailed=${xfailed} xpassed=${xpassed}"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Reply-To skill tests"
      echo
      echo "- github.sha: \`${GITHUB_SHA_VALUE}\`"
      echo "- pr_head_sha: \`${PR_HEAD_SHA_VALUE}\`"
      echo "- collected: ${collected}"
      echo "- passed: ${passed}"
      echo "- failed: ${failed}"
      echo "- skipped: ${skipped}"
      echo "- errors: ${errors}"
      echo "- xfailed: ${xfailed}"
      echo "- xpassed: ${xpassed}"
    } >>"$GITHUB_STEP_SUMMARY"
  fi
}

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "::error::missing test file ${f} at ${SHA}"
    write_summary 0 0 0 0 0
    exit 1
  fi
done

PYTHON=""
for candidate in "$REPO_ROOT/.venv" "$REPO_ROOT/venv" "$HOME/.hermes/hermes-agent/venv"; do
  if [ -x "$candidate/bin/python" ]; then
    PYTHON="$candidate/bin/python"
    break
  fi
  # Same Git Bash fallback as scripts/run_tests.sh: a Windows venv has
  # Scripts/python.exe, not bin/python. Scoped to MSYS so Linux and WSL
  # keep the POSIX layout.
  if [ -n "${MSYSTEM:-}" ] && [ -x "$candidate/Scripts/python.exe" ]; then
    PYTHON="$candidate/Scripts/python.exe"
    break
  fi
done
if [ -z "$PYTHON" ]; then
  echo "error: no virtualenv found in $REPO_ROOT/.venv or $REPO_ROOT/venv" >&2
  exit 1
fi

RUN_LOG="$(mktemp)"
trap 'rm -f "$RUN_LOG"' EXIT

# Collection and execution both go through the canonical runner
# (scripts/run_tests.sh, one isolated process per file). The runner maps
# pytest exit 5 to success, so the zero-test check is made on the
# runner's own summary: reply_to_skill_summary.py adds every outcome
# (passed, failed, skipped, errors, xfailed, xpassed) and fails on 0.
set +e
scripts/run_tests.sh "${FILES[@]}" -q >"$RUN_LOG" 2>&1
RUN_RC=$?
set -e

echo "----- scripts/run_tests.sh (exit ${RUN_RC}) -----"
cat "$RUN_LOG"

"$PYTHON" "$REPO_ROOT/scripts/ci/reply_to_skill_summary.py" \
  "$RUN_LOG" "$GITHUB_SHA_VALUE" "$PR_HEAD_SHA_VALUE" "$RUN_RC" \
  "${GITHUB_STEP_SUMMARY:-}"
