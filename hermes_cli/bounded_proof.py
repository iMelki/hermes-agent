"""Fail-closed one-shot entry point for externally approved proof runs."""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path

from hermes_cli.oneshot import _run_agent


def _write_create_new(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", encoding="utf-8", newline="\n") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input-file", required=True)
    parser.add_argument("--result-file", required=True)
    parser.add_argument("--provider", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--max-output-tokens", required=True, type=int)
    args = parser.parse_args(argv)

    input_path = Path(args.input_file).resolve(strict=True)
    result_path = Path(args.result_file).resolve()
    if args.max_output_tokens < 1:
        parser.error("--max-output-tokens must be positive")
    if result_path.exists():
        parser.error("--result-file already exists; proof results are create-once")

    prompt = input_path.read_text(encoding="utf-8")
    started = time.monotonic()
    response, result = _run_agent(
        prompt,
        model=args.model,
        provider=args.provider,
        toolsets=[],
        use_config_toolsets=False,
        proof_controls={
            "max_provider_attempts": 1,
            "allow_fallback": False,
            "force_no_tools": True,
            "max_output_tokens": args.max_output_tokens,
        },
    )
    proof = result.get("proof") or {}
    duration_ms = round((time.monotonic() - started) * 1000)
    status = "pass"
    failures: list[str] = []
    checks = {
        "exactly_one_provider_attempt": proof.get("provider_attempt_count") == 1,
        "fallback_not_activated": proof.get("fallback_activated") is False,
        "no_tool_events": proof.get("tool_event_count") == 0,
        "zero_effective_tools": proof.get("effective_tools") == [],
        "output_within_cap": int(proof.get("reported_output_tokens") or 0)
        <= args.max_output_tokens,
        "nonempty_response": bool(response.strip()),
    }
    for name, passed in checks.items():
        if not passed:
            failures.append(name)
    if failures:
        status = "fail"

    payload = {
        "schema_version": "hermes.bounded-proof-result/v1",
        "status": status,
        "exit_status": 0 if status == "pass" else 10,
        "duration_ms": duration_ms,
        "provider": proof.get("provider"),
        "model": proof.get("model"),
        "session_id": proof.get("session_id"),
        "response": response,
        "evidence_paths": {
            "input": str(input_path),
            "result": str(result_path),
        },
        "proof": proof,
        "checks": checks,
        "failures": failures,
    }
    _write_create_new(result_path, payload)
    print(json.dumps(payload, sort_keys=True, ensure_ascii=False))
    return payload["exit_status"]


if __name__ == "__main__":
    raise SystemExit(main())
