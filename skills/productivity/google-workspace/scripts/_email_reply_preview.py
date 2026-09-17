#!/usr/bin/env python3
"""Resolve and preview one RFC 5322 reply without provider or send authority.

The CLI accepts one JSON object on stdin. The only supported message input is a
structured ``headers`` list; raw MIME and provider message identifiers are not
accepted. Allowed previews include the normalized recipient, but never include
the generated MIME bytes. Denials emit only a stable reason code.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.parser import BytesParser, Parser
from email.policy import SMTP, default
from typing import Any, Iterable, Mapping, Sequence


_CONTROL_RE = re.compile(r"[\x00-\x1f\x7f]")
_HEADER_NAME_RE = re.compile(r"^[!-9;-~]+$")
_ADDR_SPEC_RE = re.compile(
    r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@"
    r"[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?$"
)
_MESSAGE_ID_RE = re.compile(r"^<[^<>\s\x00-\x1f\x7f]+@[^<>\s\x00-\x1f\x7f]+>$")
_REFERENCES_RE = re.compile(r"<[^<>\s\x00-\x1f\x7f]+@[^<>\s\x00-\x1f\x7f]+>")
_REPLY_HEADERS = ("reply-to", "from", "subject", "message-id", "references")


class ReplyPreviewError(ValueError):
    """A fail-closed preview denial with a privacy-safe reason code."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass
class InvocationAudit:
    """Caller-owned poisonable counters used to derive no-provider proof."""

    provider_calls: list[str] = field(default_factory=list)
    send_calls: list[str] = field(default_factory=list)

    def record_provider_call(self, label: str) -> None:
        self.provider_calls.append(label)

    def record_send_call(self, label: str) -> None:
        self.send_calls.append(label)

    def proof(self) -> dict[str, bool]:
        return {
            "providerCalled": bool(self.provider_calls),
            "messageSent": bool(self.send_calls),
        }


@dataclass(frozen=True)
class ReplyPreview:
    selected_source: str
    recipient: str
    subject: str
    in_reply_to: str
    references: str
    raw_mime: bytes
    mime_assertions: Mapping[str, Any]
    audit_proof: Mapping[str, bool]

    def as_dict(self) -> dict[str, Any]:
        """Return the structured preview while intentionally omitting raw MIME."""

        return {
            "allowed": True,
            "reason": "reply-preview-allowed",
            "selectedSource": self.selected_source,
            "recipient": self.recipient,
            "subject": self.subject,
            "threadHeaders": {
                "inReplyTo": self.in_reply_to,
                "references": self.references,
            },
            "mimeAssertions": dict(self.mime_assertions),
            **dict(self.audit_proof),
        }


def _require_safe_text(value: Any, reason: str, *, allow_empty: bool = False) -> str:
    if not isinstance(value, str):
        raise ReplyPreviewError(reason)
    if (not allow_empty and not value.strip()) or _CONTROL_RE.search(value):
        raise ReplyPreviewError(reason)
    return value.strip()


def _collect_headers(headers: Sequence[Mapping[str, Any]]) -> dict[str, list[str]]:
    if not isinstance(headers, list):
        raise ReplyPreviewError("headers-invalid")

    collected: dict[str, list[str]] = {}
    for item in headers:
        if not isinstance(item, Mapping):
            raise ReplyPreviewError("headers-invalid")
        name = item.get("name")
        value = item.get("value")
        if not isinstance(name, str) or not _HEADER_NAME_RE.fullmatch(name):
            raise ReplyPreviewError("header-name-invalid")
        if not isinstance(value, str):
            raise ReplyPreviewError("header-value-invalid")
        lowered = name.casefold()
        if lowered in _REPLY_HEADERS:
            collected.setdefault(lowered, []).append(value)

    for name, values in collected.items():
        if len(values) > 1:
            raise ReplyPreviewError(f"{name}-duplicated")
    return collected


def _one_header(
    collected: Mapping[str, Sequence[str]],
    name: str,
    *,
    required: bool = False,
) -> str | None:
    values = collected.get(name, ())
    if not values:
        if required:
            raise ReplyPreviewError(f"{name}-missing")
        return None
    return values[0]


def _parse_mailbox(value: Any, reason_prefix: str) -> str:
    safe_value = _require_safe_text(value, f"{reason_prefix}-invalid")
    try:
        header = Parser(policy=default).parsestr(f"To: {safe_value}\n\n")["To"]
    except Exception as exc:  # email parser errors must fail closed and stay private.
        raise ReplyPreviewError(f"{reason_prefix}-invalid") from exc

    if header is None or header.defects or len(header.groups) != 1:
        raise ReplyPreviewError(f"{reason_prefix}-invalid")
    group = header.groups[0]
    if group.display_name is not None or len(group.addresses) != 1:
        raise ReplyPreviewError(f"{reason_prefix}-ambiguous")
    address = group.addresses[0]
    if address.display_name and _CONTROL_RE.search(address.display_name):
        raise ReplyPreviewError(f"{reason_prefix}-invalid")

    normalized = address.addr_spec.casefold()
    if not normalized.isascii() or not _ADDR_SPEC_RE.fullmatch(normalized):
        raise ReplyPreviewError(f"{reason_prefix}-invalid")
    return normalized


def _normalize_policy_entries(entries: Any, label: str) -> frozenset[str]:
    if entries is None:
        return frozenset()
    if not isinstance(entries, list):
        raise ReplyPreviewError("policy-invalid")
    try:
        return frozenset(_parse_mailbox(entry, label) for entry in entries)
    except ReplyPreviewError as exc:
        raise ReplyPreviewError("policy-invalid") from exc


def _resolve_recipient(
    collected: Mapping[str, Sequence[str]],
    policy: Mapping[str, Any],
) -> tuple[str, str]:
    reply_to = _one_header(collected, "reply-to")
    if reply_to is not None:
        source = "Reply-To"
        recipient = _parse_mailbox(reply_to, "reply-to")
    else:
        source = "From"
        recipient = _parse_mailbox(
            _one_header(collected, "from", required=True),
            "from",
        )

    allow = _normalize_policy_entries(policy.get("allowRecipients"), "allow-recipient")
    deny = _normalize_policy_entries(policy.get("denyRecipients"), "deny-recipient")
    if recipient in deny:
        raise ReplyPreviewError("recipient-denied")
    if allow and recipient not in allow:
        raise ReplyPreviewError("recipient-not-allowed")
    return source, recipient


def _reply_subject(value: Any) -> str:
    subject = _require_safe_text(value, "subject-invalid")
    return subject if re.match(r"(?i)^re\s*:", subject) else f"Re: {subject}"


def _message_id(value: Any) -> str:
    message_id = _require_safe_text(value, "message-id-invalid")
    if not _MESSAGE_ID_RE.fullmatch(message_id):
        raise ReplyPreviewError("message-id-invalid")
    return message_id


def _references(value: Any, source_message_id: str) -> str:
    if value is None:
        ids: list[str] = []
    else:
        safe_value = _require_safe_text(value, "references-invalid", allow_empty=True)
        if not safe_value:
            ids = []
        else:
            ids = _REFERENCES_RE.findall(safe_value)
            if " ".join(ids) != " ".join(safe_value.split()):
                raise ReplyPreviewError("references-invalid")
            if any(not _MESSAGE_ID_RE.fullmatch(item) for item in ids):
                raise ReplyPreviewError("references-invalid")

    deduplicated: list[str] = []
    for item in [*ids, source_message_id]:
        if item not in deduplicated:
            deduplicated.append(item)
    return " ".join(deduplicated)


def _round_trip_assertions(raw_mime: bytes, expected: Mapping[str, str]) -> dict[str, Any]:
    parsed = BytesParser(policy=default).parsebytes(raw_mime)
    to_header = parsed["To"]
    to_addresses = [] if to_header is None else list(to_header.addresses)
    cc_header = parsed["Cc"]
    bcc_header = parsed["Bcc"]
    references = str(parsed["References"] or "")

    assertions = {
        "toCount": len(to_addresses),
        "exactTo": len(to_addresses) == 1
        and to_addresses[0].addr_spec.casefold() == expected["recipient"],
        "ccCount": 0 if cc_header is None else len(cc_header.addresses),
        "bccCount": 0 if bcc_header is None else len(bcc_header.addresses),
        "inReplyToMatches": str(parsed["In-Reply-To"] or "") == expected["message_id"],
        "referencesSourceCount": _REFERENCES_RE.findall(references).count(
            expected["message_id"]
        ),
        "subjectMatches": str(parsed["Subject"] or "") == expected["subject"],
    }
    if assertions != {
        "toCount": 1,
        "exactTo": True,
        "ccCount": 0,
        "bccCount": 0,
        "inReplyToMatches": True,
        "referencesSourceCount": 1,
        "subjectMatches": True,
    }:
        raise ReplyPreviewError("mime-round-trip-failed")
    return assertions


def _build_message(
    *,
    recipient: str,
    subject: str,
    source_message_id: str,
    references: str,
    body: str,
    from_header: str | None,
) -> bytes:
    message = EmailMessage(policy=SMTP)
    message["To"] = recipient
    message["Subject"] = subject
    message["In-Reply-To"] = source_message_id
    message["References"] = references
    if from_header is not None:
        message["From"] = _parse_mailbox(from_header, "from-header")
    message.set_content(body)
    return message.as_bytes()


def _validated_options(
    body: Any,
    policy: Mapping[str, Any] | None,
    audit: InvocationAudit | None,
) -> tuple[str, Mapping[str, Any], InvocationAudit]:
    if not isinstance(body, str):
        raise ReplyPreviewError("body-invalid")
    if policy is None:
        policy = {}
    if not isinstance(policy, Mapping):
        raise ReplyPreviewError("policy-invalid")
    return body, policy, audit or InvocationAudit()


def build_reply_preview(
    headers: Sequence[Mapping[str, Any]],
    *,
    body: str = "",
    from_header: str | None = None,
    policy: Mapping[str, Any] | None = None,
    audit: InvocationAudit | None = None,
) -> ReplyPreview:
    """Build a no-send reply and prove its emitted headers by parse-back."""

    body, policy, audit = _validated_options(body, policy, audit)

    collected = _collect_headers(headers)
    selected_source, recipient = _resolve_recipient(collected, policy)
    subject = _reply_subject(_one_header(collected, "subject", required=True))
    source_message_id = _message_id(
        _one_header(collected, "message-id", required=True)
    )
    references = _references(
        _one_header(collected, "references"),
        source_message_id,
    )

    raw_mime = _build_message(
        recipient=recipient,
        subject=subject,
        source_message_id=source_message_id,
        references=references,
        body=body,
        from_header=from_header,
    )

    assertions = _round_trip_assertions(
        raw_mime,
        {
            "recipient": recipient,
            "subject": subject,
            "message_id": source_message_id,
        },
    )
    return ReplyPreview(
        selected_source=selected_source,
        recipient=recipient,
        subject=subject,
        in_reply_to=source_message_id,
        references=references,
        raw_mime=raw_mime,
        mime_assertions=assertions,
        audit_proof=audit.proof(),
    )


def _denial(reason: str, audit: InvocationAudit) -> dict[str, Any]:
    return {"allowed": False, "reason": reason, **audit.proof()}


def main(argv: Iterable[str] | None = None) -> int:
    arguments = list(argv) if argv is not None else None
    parser = argparse.ArgumentParser(
        description="Preview one Reply-To-first reply from structured headers on stdin."
    )
    parser.add_argument("--pretty", action="store_true")
    args = parser.parse_args(arguments)
    audit = InvocationAudit()

    try:
        payload = json.load(sys.stdin)
        if not isinstance(payload, Mapping):
            raise ReplyPreviewError("input-invalid")
        preview = build_reply_preview(
            payload.get("headers"),
            body=payload.get("body", ""),
            from_header=payload.get("fromHeader"),
            policy=payload.get("policy"),
            audit=audit,
        )
        result = preview.as_dict()
        exit_code = 0
    except (json.JSONDecodeError, ReplyPreviewError) as exc:
        reason = exc.reason if isinstance(exc, ReplyPreviewError) else "input-json-invalid"
        result = _denial(reason, audit)
        exit_code = 2

    indent = 2 if args.pretty else None
    print(json.dumps(result, indent=indent, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
