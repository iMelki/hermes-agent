"""Pure candidate guard for the known local Gemini CLI text-only route.

No network, provider lookup, configuration access or session-wide caching.
The caller must pass the actual current request payload, including message history.
"""
from urllib.parse import urlsplit
from collections.abc import Iterable, Mapping


def requires_tools(payload):
    if not isinstance(payload, Mapping):
        return False
    # OpenAI-compatible clients merge extra_body into the JSON request after
    # receiving kwargs. Inspect those effective top-level fields as well.
    extra_body = payload.get("extra_body")
    if isinstance(extra_body, Mapping):
        payload = {**payload, **extra_body}
    for key in ("tools", "functions"):
        value = payload.get(key)
        if isinstance(value, (list, tuple)):
            if value:
                return True
        elif isinstance(value, Iterable) and not isinstance(value, (str, bytes, Mapping)):
            # Do not consume a one-shot iterable just to inspect it.
            return True
    for key in ("tool_choice", "function_call"):
        value = payload.get(key)
        if isinstance(value, (dict, list, tuple)) or (isinstance(value, str) and value.lower() not in ("auto", "none")):
            return True
    # Both fields may be present before transport serialization. Until the
    # actual wire shape is known, inspect each list conservatively.
    for key in ("messages", "input"):
        items = payload.get(key)
        if not isinstance(items, (list, tuple)):
            if isinstance(items, Iterable) and not isinstance(items, (str, bytes, Mapping)):
                return True
            continue
        for item in items:
            if not isinstance(item, Mapping):
                continue
            if item.get("role") in ("tool", "function") or item.get("type") in ("function_call", "function_call_output"):
                return True
            calls = item.get("tool_calls")
            if isinstance(calls, (list, tuple)) and calls:
                return True
            if isinstance(calls, Iterable) and not isinstance(calls, (list, tuple, str, bytes, Mapping)):
                return True
            if item.get("function_call") is not None or item.get("tool_call_id") is not None:
                return True
    return False


def known_text_only_local_gemini(entry):
    if not isinstance(entry, Mapping) or not isinstance(entry.get("provider"), str) or entry["provider"].lower() != "custom":
        return False
    try:
        if not isinstance(entry.get("base_url"), str):
            return False
        url = urlsplit(entry["base_url"])
        return (url.scheme.lower() == "http" and url.hostname in ("127.0.0.1", "localhost")
                and url.port == 4141 and url.username is None and url.password is None
                and not url.query and not url.fragment
                and url.path.rstrip("/") == "/v1/gemini-cli")
    except ValueError:
        return False


def reject_fallback(entry, request_payload):
    return known_text_only_local_gemini(entry) and requires_tools(request_payload)
