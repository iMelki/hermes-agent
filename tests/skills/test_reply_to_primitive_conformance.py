"""Hermes adoption proof for the pinned provider-free reply primitive."""

import hashlib
import importlib.util
import json
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
COPY = ROOT / "skills/productivity/google-workspace/scripts/_email_reply_preview.py"
PROVENANCE = (
    ROOT
    / "skills/productivity/google-workspace/scripts/reply_to_preview.provenance.json"
)
CONSUMER = ROOT / "skills/productivity/google-workspace/scripts/google_api.py"
GUARD = ROOT / "scripts/check_reply_to_primitive_conformance.py"


def _guard_module():
    spec = importlib.util.spec_from_file_location("reply_to_conformance", GUARD)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def _fixture_consumer() -> str:
    return '''
import base64
from _email_reply_preview import ReplyPreviewError, build_reply_preview

def gmail_reply(args):
    metadata_headers = ["From", "Reply-To", "Subject", "Message-ID", "References"]
    use_gws = args.use_gws
    if use_gws:
        original = _run_gws(
            ["gmail", "users", "messages", "get"],
            params={"metadataHeaders": metadata_headers},
        )
    else:
        original = service.users().messages().get(
            metadataHeaders=metadata_headers,
        ).execute()
    try:
        preview = build_reply_preview([], body=args.body)
    except ReplyPreviewError as exc:
        raise SystemExit(2) from exc
    body = {
        "raw": base64.urlsafe_b64encode(preview.raw_mime).decode(),
        "threadId": original["threadId"],
    }
    if use_gws:
        _run_gws(["gmail", "users", "messages", "send"], body=body)
    else:
        service.users().messages().send(body=body).execute()
'''


def _write_fixture(tmp_path: Path):
    copy_path = tmp_path / "_email_reply_preview.py"
    copy_path.write_bytes(COPY.read_bytes())
    consumer_path = tmp_path / "google_api.py"
    consumer_path.write_text(_fixture_consumer(), encoding="utf-8")
    provenance_path = tmp_path / "reply_to_preview.provenance.json"
    provenance_path.write_text(
        json.dumps(
            {
                "version": 1,
                "canonicalRepository": "iMelki/agent-settings",
                "canonicalPath": "shared/tools/email_reply_preview.py",
                "canonicalCommit": "2126c39abd048588985f62daa5d057b520349b75",
                "canonicalSha256": hashlib.sha256(copy_path.read_bytes()).hexdigest(),
                "copyPath": "skills/productivity/google-workspace/scripts/_email_reply_preview.py",
            }
        ),
        encoding="utf-8",
    )
    return copy_path, provenance_path, consumer_path


def test_live_hermes_adoption_conforms():
    result = _guard_module().verify(COPY, PROVENANCE, CONSUMER)
    assert result["status"] == "pass"
    assert result["findings"] == []


def test_guard_attributes_canonical_copy_drift(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    copy_path.write_text("CANONICAL = False\n", encoding="utf-8")

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "canonical-copy-drift" in result["findings"]


def test_guard_attributes_a_half_migrated_recipient_path(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            "        preview = build_reply_preview([], body=args.body)",
            '        message["To"] = headers.get("from", "")\n'
            "        preview = build_reply_preview([], body=args.body)",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "hand-rolled-to-assignment" in result["findings"]


def test_guard_attributes_missing_reply_to_metadata(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace('"Reply-To", ', ""),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "metadata-header-coverage" in result["findings"]


def test_guard_rejects_declared_but_unbound_metadata(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            'params={"metadataHeaders": metadata_headers}',
            "params={}",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "metadata-header-binding" in result["findings"]


def test_guard_rejects_unreachable_resolver_and_unchecked_poison_send(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        '''
from _email_reply_preview import ReplyPreviewError, build_reply_preview

def gmail_reply(args):
    metadata_headers = ["From", "Reply-To", "Subject", "Message-ID", "References"]
    original = args.original
    if False:
        preview = build_reply_preview([], body=args.body)
    body = {"raw": args.unchecked_raw, "threadId": original["threadId"]}
    if use_gws:
        _run_gws(["gmail", "users", "messages", "send"], body=body)
    else:
        service.users().messages().send(body=body).execute()
''',
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-flow-not-approved" in result["findings"]
    assert "reply-body-not-approved" in result["findings"]


def test_guard_rejects_trailing_unpack_override(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            '        "threadId": original["threadId"],',
            '        "threadId": original["threadId"],\n'
            "        **args.payload,",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "reply-body-not-approved" in result["findings"]


def test_guard_rejects_computed_key_override(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            '        "threadId": original["threadId"],',
            '        "threadId": original["threadId"],\n'
            "        args.key: args.unchecked_raw,",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "reply-body-not-approved" in result["findings"]


def test_guard_rejects_duplicate_literal_key(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            '        "raw": base64.urlsafe_b64encode(preview.raw_mime).decode(),',
            '        "raw": args.unchecked_raw,\n'
            '        "raw": base64.urlsafe_b64encode(preview.raw_mime).decode(),',
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "reply-body-not-approved" in result["findings"]


def test_guard_rejects_attribute_resolver_callee(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            "        preview = build_reply_preview([], body=args.body)",
            "        preview = helpers.build_reply_preview([], body=args.body)",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-binding-not-approved" in result["findings"]


@pytest.mark.parametrize(
    "rebinding",
    [
        "def build_reply_preview(headers, **kwargs):\n    return kwargs['raw']\n",
        "class build_reply_preview:\n    pass\n",
        "build_reply_preview = lambda headers, **kwargs: kwargs\n",
        "from evil_helpers import build_reply_preview\n",
        "import evil_helpers as build_reply_preview\n",
        "from _email_reply_preview import ReplyPreviewError as build_reply_preview\n",
        "from evil_helpers import *\n",
        "class ReplyPreviewError(Exception):\n    pass\n",
        "import _email_reply_preview\n"
        "_email_reply_preview.build_reply_preview = print\n",
        # CodeRabbit 4516103910: writes through a namespace mapping or by name.
        'globals()["build_reply_preview"] = print\n',
        'globals()["ReplyPreviewError"] = Exception\n',
        'del globals()["build_reply_preview"]\n',
        'globals().update(build_reply_preview=print)\n',
        'globals().__setitem__("build_reply_preview", print)\n',
        'vars()["build_" + "reply_preview"] = print\n',
        "import sys\n"
        'setattr(sys.modules[__name__], "build_reply_preview", print)\n',
        "import sys\n"
        "sys.modules[__name__].__dict__['build_reply_preview'] = print\n",
        'exec("build_reply_preview = print")\n',
        "import sys\n"
        "sys.modules[__name__].__dict__.update(build_reply_preview=print)\n",
        'namespace = {}\nnamespace["build_reply_preview"] = print\n',
    ],
)
def test_guard_rejects_module_level_rebinding_of_pinned_names(tmp_path, rebinding):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            "\ndef gmail_reply(args):",
            f"\n{rebinding}\ndef gmail_reply(args):",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-binding-not-approved" in result["findings"]


@pytest.mark.parametrize(
    "replacement",
    [
        "def gmail_reply(args, build_reply_preview=None):",
        "def gmail_reply(args):\n    build_reply_preview = args.resolver",
        "def gmail_reply(args):\n    global build_reply_preview",
    ],
)
def test_guard_rejects_local_rebinding_of_resolver(tmp_path, replacement):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace("def gmail_reply(args):", replacement),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-binding-not-approved" in result["findings"]


@pytest.mark.parametrize(
    "import_line",
    [
        # CodeRabbit 4516103928: aliased imports leave the bare call unbound.
        "from _email_reply_preview import ReplyPreviewError, build_reply_preview as resolve",
        "from _email_reply_preview import ReplyPreviewError as PreviewError, build_reply_preview",
        "from _email_reply_preview import build_reply_preview",
    ],
)
def test_guard_requires_exactly_one_approved_binding_per_pinned_name(tmp_path, import_line):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            "from _email_reply_preview import ReplyPreviewError, build_reply_preview",
            import_line,
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-binding-not-approved" in result["findings"]


def test_guard_rejects_duplicate_approved_import(tmp_path):
    copy_path, provenance_path, consumer_path = _write_fixture(tmp_path)
    consumer_path.write_text(
        _fixture_consumer().replace(
            "\ndef gmail_reply(args):",
            "\nfrom _email_reply_preview import build_reply_preview\n\ndef gmail_reply(args):",
        ),
        encoding="utf-8",
    )

    result = _guard_module().verify(copy_path, provenance_path, consumer_path)

    assert result["status"] == "fail"
    assert "resolver-binding-not-approved" in result["findings"]
