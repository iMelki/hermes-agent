"""Loop-level regression for the text-only route guard (#13 review finding).

With ONE iteration left, a tool-bearing request on the known text-only local
Gemini route must be rejected without a provider call, and the compatible
fallback must still be called in that same iteration (the rejection must not
consume the last iteration).  Exercised through ``AIAgent.run_conversation``
against an in-process mock provider.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

_GEMINI_URL = "http://127.0.0.1:4141/v1/gemini-cli"


class _Handler(BaseHTTPRequestHandler):
    captured: list = []

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get("Content-Length", 0))
        req = json.loads(self.rfile.read(length).decode())
        type(self).captured.append(req)
        resp = {
            "id": "m",
            "choices": [{"index": 0, "message": {"role": "assistant", "content": "FALLBACK OK"},
                         "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 1, "completion_tokens": 1, "total_tokens": 2},
        }
        if req.get("stream") is True:
            chunks = [
                {"id": "m", "choices": [{"index": 0, "delta": {"role": "assistant", "content": "FALLBACK OK"},
                                         "finish_reason": None}]},
                {"id": "m", "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]},
            ]
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.end_headers()
            for c in chunks:
                self.wfile.write(f"data: {json.dumps(c)}\n\n".encode())
            self.wfile.write(b"data: [DONE]\n\n")
        else:
            body = json.dumps(resp).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def log_message(self, *a, **kw):
        pass


@pytest.fixture()
def env(monkeypatch):
    for var in ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy"):
        monkeypatch.delenv(var, raising=False)
    monkeypatch.setenv("NO_PROXY", "127.0.0.1,localhost")
    _Handler.captured = []
    srv = HTTPServer(("127.0.0.1", 0), _Handler)
    port = srv.server_address[1]
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    home = tempfile.mkdtemp(prefix="hermes_textonly_loop_")
    os.makedirs(os.path.join(home, ".hermes"))
    prev = os.environ.get("HERMES_HOME")
    os.environ["HERMES_HOME"] = os.path.join(home, ".hermes")
    for mod in list(sys.modules):
        if mod == "run_agent" or mod.startswith(("agent.", "tools.", "hermes_")):
            del sys.modules[mod]
    from run_agent import AIAgent

    agent = AIAgent(
        api_key="test-key", base_url=_GEMINI_URL, provider="custom", model="test-model",
        max_iterations=1, enabled_toolsets=[], quiet_mode=True, skip_context_files=True,
        skip_memory=True, save_trajectories=False, platform="cli",
    )
    try:
        yield agent, port
    finally:
        srv.shutdown()
        shutil.rmtree(home, ignore_errors=True)
        if prev is None:
            os.environ.pop("HERMES_HOME", None)
        else:
            os.environ["HERMES_HOME"] = prev


_TOOL_HISTORY = [
    {"role": "user", "content": "run it"},
    {"role": "assistant", "content": None, "tool_calls": [
        {"id": "c1", "type": "function", "function": {"name": "terminal", "arguments": "{}"}}]},
    {"role": "tool", "tool_call_id": "c1", "content": "done"},
]


def test_guard_rejection_does_not_consume_last_iteration(env):
    agent, port = env
    switched = []

    def fake_fallback():
        if switched:
            return False
        switched.append(True)
        agent.base_url = f"http://127.0.0.1:{port}/v1"
        agent.provider = "custom"
        agent._client_kwargs = {"api_key": "test-key", "base_url": agent.base_url}
        agent.client = agent._create_openai_client(
            agent._client_kwargs, reason="test_fallback", shared=True
        )
        return True

    agent._try_activate_fallback = fake_fallback

    result = agent.run_conversation("continue", conversation_history=list(_TOOL_HISTORY), task_id="t")

    assert switched, "guard never rejected the text-only route"
    # Zero calls reached the incompatible route (nothing listens on :4141) and
    # exactly one reached the compatible fallback, on the single remaining iteration.
    assert len(_Handler.captured) == 1
    assert result.get("error") != "unsupported_tool_calls"
    assert result.get("final_response") == "FALLBACK OK"


def test_no_compatible_fallback_fails_without_consuming_iteration(env):
    agent, _port = env
    agent._try_activate_fallback = lambda *a, **k: False
    used_before = agent.iteration_budget.used

    result = agent.run_conversation("continue", conversation_history=list(_TOOL_HISTORY), task_id="t")

    assert result["failed"] is True
    assert result["error"] == "unsupported_tool_calls"
    assert len(_Handler.captured) == 0
    # No provider call was dispatched: no attempt and no iteration consumed.
    assert result["api_calls"] == 0
    assert agent.iteration_budget.used == used_before
