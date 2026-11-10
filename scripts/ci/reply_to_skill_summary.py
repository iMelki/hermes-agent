#!/usr/bin/env python3
"""Read the run_tests.sh summary line for the Reply-To skill-test job.

The runner prints one ``=== Summary:`` line. Fields that line omits count
as zero so an older line with only passed and failed does not pretend the
other counters were measured as something else.
"""

from __future__ import annotations

import re
import sys

COUNT_FIELDS = ("passed", "failed", "skipped", "errors", "xfailed", "xpassed")

# Longer names first. ``failed`` must not be read out of ``xfailed``.
_FIELD_PATTERNS = (
    ("xfailed", re.compile(r"(\d+) xfailed\b")),
    ("xpassed", re.compile(r"(\d+) xpassed\b")),
    ("passed", re.compile(r"(\d+) tests passed\b")),
    ("failed", re.compile(r"(\d+) failed\b")),
    ("skipped", re.compile(r"(\d+) skipped\b")),
    ("errors", re.compile(r"(\d+) errors?\b")),
)


def parse_summary_counts(text: str) -> dict[str, int]:
    """Return passed/failed/skipped/errors/xfailed/xpassed from the summary.

    Only the last ``=== Summary:`` line is consulted. A missing field, or a
    missing summary line, is 0.
    """
    counts = {name: 0 for name in COUNT_FIELDS}
    summary_line = ""
    for line in text.splitlines():
        if line.startswith("=== Summary:"):
            summary_line = line
    if not summary_line:
        return counts
    for name, pattern in _FIELD_PATTERNS:
        match = pattern.search(summary_line)
        if match:
            counts[name] = int(match.group(1))
    return counts


def format_count_line(
    *,
    github_sha: str,
    pr_head_sha: str,
    collected: str,
    counts: dict[str, int],
) -> str:
    fields = " ".join(f"{name}={counts[name]}" for name in COUNT_FIELDS)
    return (
        f"reply-to-skill-tests github_sha={github_sha} pr_head_sha={pr_head_sha} "
        f"collected={collected} {fields}"
    )


def _write_step_summary(
    path: str,
    *,
    github_sha: str,
    pr_head_sha: str,
    collected: str,
    counts: dict[str, int],
) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8") as fh:
        fh.write("### Reply-To skill tests\n\n")
        fh.write(f"- github.sha: `{github_sha}`\n")
        fh.write(f"- pr_head_sha: `{pr_head_sha}`\n")
        fh.write(f"- collected: {collected}\n")
        for name in COUNT_FIELDS:
            fh.write(f"- {name}: {counts[name]}\n")


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    log, github_sha, pr_head_sha, collected, rc, summary_path = args
    text = open(log, encoding="utf-8", errors="replace").read()
    counts = parse_summary_counts(text)
    print(
        format_count_line(
            github_sha=github_sha,
            pr_head_sha=pr_head_sha,
            collected=collected,
            counts=counts,
        )
    )
    _write_step_summary(
        summary_path,
        github_sha=github_sha,
        pr_head_sha=pr_head_sha,
        collected=collected,
        counts=counts,
    )
    return int(rc)


if __name__ == "__main__":
    raise SystemExit(main())
