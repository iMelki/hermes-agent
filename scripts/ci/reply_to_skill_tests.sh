#!/usr/bin/env bash
# Run the Reply-To skill tests, log collected/passed/failed counts, and
# fail when pytest collects nothing.
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
done
if [ -z "$PYTHON" ]; then
  echo "error: no virtualenv found in $REPO_ROOT/.venv or $REPO_ROOT/venv" >&2
  exit 1
fi

COLLECT_LOG="$(mktemp)"
RUN_LOG="$(mktemp)"
trap 'rm -f "$COLLECT_LOG" "$RUN_LOG"' EXIT

set +e
env -i \
  PATH="$PATH" \
  HOME="$HOME" \
  TZ=UTC \
  LANG=C.UTF-8 \
  LC_ALL=C.UTF-8 \
  PYTHONUTF8=1 \
  PYTHONHASHSEED=0 \
  PYTHONDONTWRITEBYTECODE=1 \
  "$PYTHON" -m pytest --collect-only -q "${FILES[@]}" >"$COLLECT_LOG" 2>&1
COLLECT_RC=$?
set -e

echo "----- pytest --collect-only (exit ${COLLECT_RC}) -----"
cat "$COLLECT_LOG"

COLLECTED="$("$PYTHON" - "$COLLECT_LOG" <<'PY'
import re
import sys

text = open(sys.argv[1], encoding="utf-8", errors="replace").read()
if re.search(r"no tests collected", text):
    print(0)
    raise SystemExit
nums = [int(n) for n in re.findall(r"(?m)^(\d+) tests? collected\b", text)]
if not nums:
    nums = [int(n) for n in re.findall(r"collected (\d+) items?\b", text)]
print(nums[-1] if nums else 0)
PY
)"

echo "collected=${COLLECTED}"

if [ "$COLLECTED" -eq 0 ] || [ "$COLLECT_RC" -eq 5 ]; then
  echo "::error::0 tests collected at ${SHA}"
  write_summary 0 0 0 0 0
  exit 1
fi

if [ "$COLLECT_RC" -ne 0 ]; then
  echo "::error::test collection failed with exit ${COLLECT_RC}"
  write_summary "$COLLECTED" 0 0 0 1
  exit "$COLLECT_RC"
fi

set +e
scripts/run_tests.sh "${FILES[@]}" -q >"$RUN_LOG" 2>&1
RUN_RC=$?
set -e

echo "----- scripts/run_tests.sh (exit ${RUN_RC}) -----"
cat "$RUN_LOG"

"$PYTHON" "$REPO_ROOT/scripts/ci/reply_to_skill_summary.py" \
  "$RUN_LOG" "$GITHUB_SHA_VALUE" "$PR_HEAD_SHA_VALUE" "$COLLECTED" "$RUN_RC" \
  "${GITHUB_STEP_SUMMARY:-}"
