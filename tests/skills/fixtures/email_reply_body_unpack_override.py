"""Hostile fixture: trailing dict unpack must not override approved MIME."""

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
        **args.payload,
    }
    if use_gws:
        _run_gws(["gmail", "users", "messages", "send"], body=body)
    else:
        service.users().messages().send(body=body).execute()
