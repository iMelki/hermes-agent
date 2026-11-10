#!/usr/bin/env bash
# Run the Reply-To skill tests, log collected/passed/failed counts, and
# fail when pytest collects nothing.
#
# GitHub Actions calls this with EXPECTED_SHA set to the pull request
# head. A local run omits that variable and just executes the suite.
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
if [ -n "${EXPECTED_SHA:-}" ] && [ "$SHA" != "$EXPECTED_SHA" ]; then
  echo "::error::checked out ${SHA}, expected PR head ${EXPECTED_SHA}"
  exit 1
fi

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
  echo "reply-to-skill-tests sha=${SHA} collected=${collected} passed=${passed} failed=${failed} skipped=${skipped} errors=${errors}"
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
      echo "### Reply-To skill tests"
      echo
      echo "- sha: \`${SHA}\`"
      echo "- collected: ${collected}"
      echo "- passed: ${passed}"
      echo "- failed: ${failed}"
      echo "- skipped: ${skipped}"
      echo "- errors: ${errors}"
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

"$PYTHON" - "$RUN_LOG" "$SHA" "$COLLECTED" "$RUN_RC" "${GITHUB_STEP_SUMMARY:-}" <<'PY'
import re
import sys

log, sha, collected, rc, summary_path = sys.argv[1:]
text = open(log, encoding="utf-8", errors="replace").read()
passed = failed = skipped = errors = 0
summary = re.search(r"=== Summary:.*?(\d+) tests passed, (\d+) failed", text)
if summary:
    passed = int(summary.group(1))
    failed = int(summary.group(2))
else:
    def last(word: str) -> int:
        found = re.findall(rf"(\d+) {word}\b", text)
        return int(found[-1]) if found else 0

    passed = last("passed")
    failed = last("failed")
    skipped = last("skipped")
    errors = last("errors")

print(
    f"reply-to-skill-tests sha={sha} collected={collected} "
    f"passed={passed} failed={failed} skipped={skipped} errors={errors}"
)
if summary_path:
    with open(summary_path, "a", encoding="utf-8") as fh:
        fh.write("### Reply-To skill tests\n\n")
        fh.write(f"- sha: `{sha}`\n")
        fh.write(f"- collected: {collected}\n")
        fh.write(f"- passed: {passed}\n")
        fh.write(f"- failed: {failed}\n")
        fh.write(f"- skipped: {skipped}\n")
        fh.write(f"- errors: {errors}\n")
raise SystemExit(int(rc))
PY
