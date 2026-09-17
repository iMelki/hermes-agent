#!/usr/bin/env python3
"""Verify a pinned reply primitive and one deliberately narrow consumer shape.

The consumer claim is syntactic by design: one directly reachable resolver
assignment inside a fail-closed ``try``, one immutable body whose raw value is
derived from ``preview.raw_mime``, and exactly the two approved send branches.
Anything more dynamic is unproven rather than inferred safe.
"""

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


def _is_gws_operation(call: ast.AST | None, operation: str) -> bool:
    if not isinstance(call, ast.Call):
        return False
    if _call_name(call) != "_run_gws" or not call.args:
        return False
    first = call.args[0]
    if not isinstance(first, (ast.List, ast.Tuple)):
        return False
    values = [item.value for item in first.elts if isinstance(item, ast.Constant)]
    return values == ["gmail", "users", "messages", operation]


def _is_api_messages_method(call: ast.AST | None, method: str) -> bool:
    if not isinstance(call, ast.Call):
        return False
    if not isinstance(call.func, ast.Attribute) or call.func.attr != method:
        return False
    messages_call = call.func.value
    if not isinstance(messages_call, ast.Call) or messages_call.args or messages_call.keywords:
        return False
    if not isinstance(messages_call.func, ast.Attribute) or messages_call.func.attr != "messages":
        return False
    users_call = messages_call.func.value
    if not isinstance(users_call, ast.Call) or users_call.args or users_call.keywords:
        return False
    return (
        isinstance(users_call.func, ast.Attribute)
        and users_call.func.attr == "users"
        and isinstance(users_call.func.value, ast.Name)
        and users_call.func.value.id == "service"
    )


def _is_send_call(call: ast.Call) -> bool:
    return _is_gws_operation(call, "send") or _is_api_messages_method(call, "send")


def _send_kind(call: ast.Call) -> str:
    if _is_gws_operation(call, "send"):
        return "gws"
    if _is_api_messages_method(call, "send"):
        return "api"
    return ""


def _parent_map(node: ast.AST) -> dict[ast.AST, ast.AST]:
    return {child: parent for parent in ast.walk(node) for child in ast.iter_child_nodes(parent)}


def _nearest_parent(
    node: ast.AST,
    kind: type[ast.AST],
    parents: dict[ast.AST, ast.AST],
) -> ast.AST | None:
    current = parents.get(node)
    while current is not None and not isinstance(current, kind):
        current = parents.get(current)
    return current


def _assigned_name(node: ast.Assign, name: str) -> bool:
    return len(node.targets) == 1 and isinstance(node.targets[0], ast.Name) and node.targets[0].id == name


def _metadata_findings(
    reply_function: ast.FunctionDef,
    parents: dict[ast.AST, ast.AST],
) -> list[str]:
    assignments = [
        node
        for node in reply_function.body
        if isinstance(node, ast.Assign) and _assigned_name(node, "metadata_headers")
    ]
    if len(assignments) != 1 or not isinstance(assignments[0].value, (ast.List, ast.Tuple)):
        return ["metadata-header-coverage"]
    values = [
        item.value for item in assignments[0].value.elts if isinstance(item, ast.Constant)
    ]
    if values != ["From", "Reply-To", "Subject", "Message-ID", "References"]:
        return ["metadata-header-coverage"]
    uses = [
        node
        for node in ast.walk(reply_function)
        if isinstance(node, ast.Name)
        and node.id == "metadata_headers"
        and isinstance(node.ctx, ast.Load)
    ]
    api_uses = 0
    gws_uses = 0
    for node in uses:
        parent = parents.get(node)
        if isinstance(parent, ast.keyword) and parent.arg == "metadataHeaders":
            api_uses += int(_is_api_messages_method(parents.get(parent), "get"))
        if isinstance(parent, ast.Dict):
            matching_keys = [
                key for key, value in zip(parent.keys, parent.values) if value is node
            ]
            keyword = parents.get(parent)
            call = parents.get(keyword) if isinstance(keyword, ast.keyword) else None
            key_ok = len(matching_keys) == 1 and isinstance(matching_keys[0], ast.Constant)
            if key_ok and matching_keys[0].value == "metadataHeaders":
                bound = (
                    isinstance(keyword, ast.keyword)
                    and keyword.arg == "params"
                    and _is_gws_operation(call, "get")
                )
                gws_uses += int(bound)
    return [] if len(uses) == 2 and api_uses == 1 and gws_uses == 1 else ["metadata-header-binding"]


def _resolver_statement(
    reply_function: ast.FunctionDef,
    calls: Sequence[ast.Call],
    parents: dict[ast.AST, ast.AST],
    findings: list[str],
) -> ast.Assign | None:
    resolver_calls = [call for call in calls if _call_name(call) == "build_reply_preview"]
    if len(resolver_calls) != 1:
        findings.append("resolver-call-count")
        return None
    call = resolver_calls[0]
    assignment = parents.get(call)
    try_node = parents.get(assignment) if assignment is not None else None
    shape_ok = (
        isinstance(assignment, ast.Assign)
        and _assigned_name(assignment, "preview")
        and isinstance(try_node, ast.Try)
        and parents.get(try_node) is reply_function
        and try_node.body == [assignment]
    )
    handler_ok = isinstance(try_node, ast.Try) and any(
        isinstance(handler.type, ast.Name)
        and handler.type.id == "ReplyPreviewError"
        and any(isinstance(node, ast.Raise) for node in ast.walk(handler))
        for handler in try_node.handlers
    )
    if not shape_ok or not handler_ok:
        findings.append("resolver-flow-not-approved")
        return None
    return assignment


def _preview_raw_node(node: ast.AST) -> ast.Attribute | None:
    if not isinstance(node, ast.Call) or node.args or node.keywords:
        return None
    if not isinstance(node.func, ast.Attribute) or node.func.attr != "decode":
        return None
    encoder = node.func.value
    if not isinstance(encoder, ast.Call) or len(encoder.args) != 1 or encoder.keywords:
        return None
    if not isinstance(encoder.func, ast.Attribute) or encoder.func.attr != "urlsafe_b64encode":
        return None
    if not isinstance(encoder.func.value, ast.Name) or encoder.func.value.id != "base64":
        return None
    raw = encoder.args[0]
    if not isinstance(raw, ast.Attribute) or raw.attr != "raw_mime":
        return None
    if not isinstance(raw.value, ast.Name) or raw.value.id != "preview":
        return None
    return raw


def _is_original_thread_id(node: ast.AST) -> bool:
    return (
        isinstance(node, ast.Subscript)
        and isinstance(node.value, ast.Name)
        and node.value.id == "original"
        and isinstance(node.slice, ast.Constant)
        and node.slice.value == "threadId"
    )


def _strict_body_entries(node: ast.Dict) -> dict[str, ast.AST] | None:
    entries: dict[str, ast.AST] = {}
    for key, value in zip(node.keys, node.values):
        if not isinstance(key, ast.Constant) or not isinstance(key.value, str):
            return None
        if key.value in entries:
            return None
        entries[key.value] = value
    return entries


def _body_statement(
    reply_function: ast.FunctionDef,
    resolver: ast.Assign | None,
    findings: list[str],
) -> tuple[ast.Assign | None, ast.Attribute | None]:
    candidates = [
        node
        for node in reply_function.body
        if isinstance(node, ast.Assign) and _assigned_name(node, "body")
    ]
    if len(candidates) != 1 or resolver is None:
        findings.append("reply-body-not-approved")
        return None, None
    assignment = candidates[0]
    if not isinstance(assignment.value, ast.Dict) or assignment.lineno <= resolver.lineno:
        findings.append("reply-body-not-approved")
        return None, None
    entries = _strict_body_entries(assignment.value)
    exact_fields = entries is not None and set(entries) == {"raw", "threadId"}
    raw = _preview_raw_node(entries.get("raw")) if exact_fields else None
    thread_id = entries.get("threadId") if exact_fields else None
    if raw is None or not _is_original_thread_id(thread_id):
        findings.append("reply-body-not-approved")
        return None, None
    return assignment, raw


def _name_flow_findings(
    reply_function: ast.FunctionDef,
    body_assignment: ast.Assign,
    raw_node: ast.Attribute,
    body_names: Sequence[ast.Name],
) -> list[str]:
    findings: list[str] = []
    allowed_body_names = {id(body_assignment.targets[0])}
    allowed_body_names.update(id(node) for node in body_names)
    if any(
        id(node) not in allowed_body_names
        for node in ast.walk(reply_function)
        if isinstance(node, ast.Name) and node.id == "body"
    ):
        findings.append("reply-body-escapes-approved-flow")
    resolver_targets = [
        node
        for node in ast.walk(reply_function)
        if isinstance(node, ast.Name) and node.id == "preview" and isinstance(node.ctx, ast.Store)
    ]
    allowed_preview_names = {id(raw_node.value)}
    if len(resolver_targets) == 1:
        allowed_preview_names.add(id(resolver_targets[0]))
    if any(
        id(node) not in allowed_preview_names
        for node in ast.walk(reply_function)
        if isinstance(node, ast.Name) and node.id == "preview"
    ):
        findings.append("preview-escapes-approved-flow")
    return findings


def _send_flow_findings(
    reply_function: ast.FunctionDef,
    calls: Sequence[ast.Call],
    parents: dict[ast.AST, ast.AST],
    body_assignment: ast.Assign | None,
    raw_node: ast.Attribute | None,
) -> list[str]:
    findings: list[str] = []
    sends = [call for call in calls if _is_send_call(call)]
    kinds = sorted(_send_kind(call) for call in sends)
    if len(sends) != 2 or kinds != ["api", "gws"]:
        return ["send-path-count-or-kind"]
    body_names: list[ast.Name] = []
    for call in sends:
        values = [keyword.value for keyword in call.keywords if keyword.arg == "body"]
        if len(values) != 1 or not isinstance(values[0], ast.Name) or values[0].id != "body":
            findings.append("send-body-not-approved")
        else:
            body_names.append(values[0])
    branch = _nearest_parent(sends[0], ast.If, parents)
    same_branch = branch is not None and _nearest_parent(sends[1], ast.If, parents) is branch
    if not same_branch or parents.get(branch) is not reply_function:
        findings.append("send-branch-shape")
    elif not isinstance(branch.test, ast.Name) or branch.test.id != "use_gws":
        findings.append("send-branch-shape")
    else:
        gws_send = next(call for call in sends if _send_kind(call) == "gws")
        api_send = next(call for call in sends if _send_kind(call) == "api")
        gws_in_body = any(node is gws_send for statement in branch.body for node in ast.walk(statement))
        api_in_else = any(node is api_send for statement in branch.orelse for node in ast.walk(statement))
        if not gws_in_body or not api_in_else:
            findings.append("send-branch-shape")
    if body_assignment is None or raw_node is None:
        return findings
    findings.extend(_name_flow_findings(reply_function, body_assignment, raw_node, body_names))
    if any(body_assignment.lineno >= call.lineno for call in sends):
        findings.append("reply-body-does-not-precede-send")
    return findings


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

    if any(_is_to_assignment(node) for node in ast.walk(reply_function) if isinstance(node, ast.Assign)):
        findings.append("hand-rolled-to-assignment")

    calls = [node for node in ast.walk(reply_function) if isinstance(node, ast.Call)]
    parents = _parent_map(reply_function)
    findings.extend(_metadata_findings(reply_function, parents))
    resolver = _resolver_statement(reply_function, calls, parents, findings)
    body_assignment, raw_node = _body_statement(reply_function, resolver, findings)
    findings.extend(
        _send_flow_findings(
            reply_function,
            calls,
            parents,
            body_assignment,
            raw_node,
        )
    )
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
