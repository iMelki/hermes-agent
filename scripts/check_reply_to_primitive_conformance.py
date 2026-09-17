#!/usr/bin/env python3
"""Verify a pinned email-reply primitive copy and its complete consumer adoption."""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import re
import sys
from pathlib import Path
from typing import Any, Sequence


_SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
_REQUIRED_METADATA_HEADERS = {"From", "Reply-To", "Subject", "Message-ID", "References"}


class VerificationUnavailable(RuntimeError):
    pass


def _read_bytes(path: Path, label: str) -> bytes:
    try:
        return path.read_bytes()
    except OSError as exc:
        raise VerificationUnavailable(f"{label}-unreadable") from exc


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        parsed = json.loads(_read_bytes(path, label).decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise VerificationUnavailable(f"{label}-invalid-json") from exc
    if not isinstance(parsed, dict):
        raise VerificationUnavailable(f"{label}-invalid-json")
    return parsed


def _call_name(call: ast.Call) -> str:
    if isinstance(call.func, ast.Name):
        return call.func.id
    if isinstance(call.func, ast.Attribute):
        return call.func.attr
    return ""


def _is_to_assignment(node: ast.Assign) -> bool:
    for target in node.targets:
        if not isinstance(target, ast.Subscript):
            continue
        key = target.slice
        if isinstance(key, ast.Constant) and key.value == "To":
            return True
    return False


def _is_send_call(call: ast.Call) -> bool:
    if isinstance(call.func, ast.Attribute) and call.func.attr == "send":
        return True
    if _call_name(call) != "_run_gws" or not call.args:
        return False
    first = call.args[0]
    if not isinstance(first, (ast.List, ast.Tuple)):
        return False
    return any(isinstance(item, ast.Constant) and item.value == "send" for item in first.elts)


def _verify_consumer(path: Path) -> list[str]:
    try:
        tree = ast.parse(_read_bytes(path, "consumer").decode("utf-8"))
    except (UnicodeDecodeError, SyntaxError) as exc:
        raise VerificationUnavailable("consumer-invalid-python") from exc

    reply_functions = [
        node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name == "gmail_reply"
    ]
    if len(reply_functions) != 1:
        return ["gmail-reply-entrypoint-count"]
    reply_function = reply_functions[0]

    findings: list[str] = []
    imported_names: set[str] = set()
    for node in tree.body:
        if isinstance(node, ast.ImportFrom) and node.module == "_email_reply_preview":
            imported_names.update(alias.name for alias in node.names)
    required_imports = {"ReplyPreviewError", "build_reply_preview"}
    if not required_imports.issubset(imported_names):
        findings.append("canonical-import-missing")

    calls = [node for node in ast.walk(reply_function) if isinstance(node, ast.Call)]
    resolver_calls = [call for call in calls if _call_name(call) == "build_reply_preview"]
    if len(resolver_calls) != 1:
        findings.append("resolver-call-count")

    constants = {
        node.value
        for node in ast.walk(reply_function)
        if isinstance(node, ast.Constant) and isinstance(node.value, str)
    }
    if not _REQUIRED_METADATA_HEADERS.issubset(constants):
        findings.append("metadata-header-coverage")

    if any(_is_to_assignment(node) for node in ast.walk(reply_function) if isinstance(node, ast.Assign)):
        findings.append("hand-rolled-to-assignment")

    send_calls = [call for call in calls if _is_send_call(call)]
    if not send_calls:
        findings.append("send-path-not-observed")
    elif resolver_calls and any(resolver_calls[0].lineno >= call.lineno for call in send_calls):
        findings.append("resolver-does-not-precede-send")
    return findings


def verify(copy_path: Path, provenance_path: Path, consumer_path: Path) -> dict[str, Any]:
    provenance = _read_json(provenance_path, "provenance")
    findings: list[str] = []
    expected_keys = {
        "version",
        "canonicalRepository",
        "canonicalPath",
        "canonicalCommit",
        "canonicalSha256",
        "copyPath",
    }
    if set(provenance) != expected_keys or provenance.get("version") != 1:
        findings.append("provenance-schema")

    expected_digest = provenance.get("canonicalSha256")
    if not isinstance(expected_digest, str) or not _SHA256_RE.fullmatch(expected_digest):
        findings.append("provenance-digest-invalid")
        expected_digest = ""
    actual_digest = hashlib.sha256(_read_bytes(copy_path, "copy")).hexdigest()
    if expected_digest and actual_digest != expected_digest:
        findings.append("canonical-copy-drift")

    findings.extend(_verify_consumer(consumer_path))
    unique_findings = sorted(set(findings))
    return {
        "status": "pass" if not unique_findings else "fail",
        "reason": "reply-primitive-conformant" if not unique_findings else "reply-primitive-drift",
        "findings": unique_findings,
        "copySha256": actual_digest,
        "mutationIntent": "none",
    }


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--copy", required=True, type=Path)
    parser.add_argument("--provenance", required=True, type=Path)
    parser.add_argument("--consumer", required=True, type=Path)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    try:
        result = verify(args.copy, args.provenance, args.consumer)
        code = 0 if result["status"] == "pass" else 1
    except VerificationUnavailable as exc:
        result = {
            "status": "unproven",
            "reason": str(exc),
            "findings": [],
            "mutationIntent": "none",
        }
        code = 2
    print(json.dumps(result, indent=2 if args.json else None, sort_keys=True))
    return code


if __name__ == "__main__":
    raise SystemExit(main())
