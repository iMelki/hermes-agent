"""Parser for the Reply-To skill-test summary line.

The count job reads the last ``=== Summary:`` line from scripts/run_tests.sh.
A field the line does not mention is 0.
"""

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import pytest

_PATH = Path(__file__).resolve().parents[2] / "scripts" / "ci" / "reply_to_skill_summary.py"
_spec = importlib.util.spec_from_file_location("reply_to_skill_summary", _PATH)
if _spec is None or _spec.loader is None:
    raise ImportError("Failed to load reply_to_skill_summary.py")
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
parse_summary_counts = _mod.parse_summary_counts

_FULL_LINE = (
    "=== Summary: 2 files, 10 tests passed, 3 failed, 4 skipped, "
    "1 errors, 2 xfailed, 5 xpassed (100% complete) in 1.2s (8 workers) ==="
)


def test_summary_line_parses_every_count():
    counts = parse_summary_counts("noise\n" + _FULL_LINE + "\ntrailer\n")
    assert counts == {
        "passed": 10,
        "failed": 3,
        "skipped": 4,
        "errors": 1,
        "xfailed": 2,
        "xpassed": 5,
    }


def test_missing_summary_fields_default_to_zero():
    """The old line only named passed and failed. The rest stay 0."""
    text = (
        "=== Summary: 1 files, 99 tests passed, 0 failed "
        "(100% complete) in 3.0s (8 workers) ===\n"
    )
    counts = parse_summary_counts(text)
    assert counts["passed"] == 99
    assert counts["failed"] == 0
    assert counts["skipped"] == 0
    assert counts["errors"] == 0
    assert counts["xfailed"] == 0
    assert counts["xpassed"] == 0


def test_runner_summary_counts_skip_xfail_xpass_and_error(tmp_path: Path):
    """The suite summary the parser reads includes every outcome, not only pass/fail."""
    probe = tmp_path / "probe"
    probe.mkdir()
    (probe / "test_outcomes.py").write_text(
        "import pytest\n"
        "\n"
        "def test_ok():\n"
        "    assert True\n"
        "\n"
        "@pytest.mark.skip(reason='nope')\n"
        "def test_skip():\n"
        "    assert False\n"
        "\n"
        "@pytest.mark.xfail\n"
        "def test_xfail():\n"
        "    assert False\n"
        "\n"
        "@pytest.mark.xfail\n"
        "def test_xpass():\n"
        "    assert True\n"
        "\n"
        "def test_error(missing_fixture):\n"
        "    assert True\n"
    )
    repo_root = Path(__file__).resolve().parents[2]
    runner = repo_root / "scripts" / "run_tests_parallel.py"
    proc = subprocess.run(
        [sys.executable, str(runner), str(probe), "-j", "1", "--file-timeout", "30", "-q"],
        cwd=repo_root,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        timeout=60,
    )
    counts = parse_summary_counts(proc.stdout)
    assert counts == {
        "passed": 1,
        "failed": 0,
        "skipped": 1,
        "errors": 1,
        "xfailed": 1,
        "xpassed": 1,
    }, proc.stdout
    assert proc.returncode != 0
