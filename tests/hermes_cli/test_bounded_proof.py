from __future__ import annotations

import json

import pytest


def _install_runtime_stubs(monkeypatch, *, effective_tools=None):
    import hermes_cli.oneshot as oneshot

    captured = {}

    class FakeAgent:
        def __init__(self, **kwargs):
            captured.update(kwargs)
            self.suppress_status_output = False
            self.stream_delta_callback = object()
            self.tool_gen_callback = object()
            self.valid_tool_names = set(effective_tools or [])
            self.provider = kwargs["provider"]
            self.model = kwargs["model"]
            self.api_mode = kwargs["api_mode"]
            self.session_id = "proof-session"
            self.session_output_tokens = 17
            self._fallback_activated = False
            self._api_max_retries = 3

        def run_conversation(self, prompt):
            captured["prompt"] = prompt
            self._proof_provider_attempt_count = 1
            self._proof_provider_attempt_events.append({"sequence": 1, "type": "provider_attempt"})
            return {"final_response": "bounded report", "failed": False, "partial": False}

    monkeypatch.setattr(oneshot, "_create_session_db_for_oneshot", lambda: object())
    monkeypatch.setattr(oneshot, "get_fallback_chain", lambda _cfg: [{"provider": "fallback"}])
    monkeypatch.setattr("hermes_cli.config.load_config", lambda: {"model": {"default": "configured"}})
    monkeypatch.setattr("hermes_cli.models.detect_provider_for_model", lambda *_a, **_k: None)
    monkeypatch.setattr(
        "hermes_cli.runtime_provider.resolve_runtime_provider",
        lambda **_kwargs: {
            "api_key": "fixture",
            "base_url": "https://example.invalid",
            "provider": "fixture-provider",
            "api_mode": "chat_completions",
            "credential_pool": object(),
        },
    )
    monkeypatch.setattr("hermes_cli.tools_config._get_platform_tools", lambda *_a, **_k: {"all"})
    monkeypatch.setattr("run_agent.AIAgent", FakeAgent)
    return captured


def test_bounded_proof_forces_one_attempt_no_fallback_and_no_tools(monkeypatch):
    from hermes_cli.oneshot import _run_agent

    captured = _install_runtime_stubs(monkeypatch)
    response, result = _run_agent(
        "fixed input",
        model="fixture-model",
        provider="fixture-provider",
        proof_controls={
            "max_provider_attempts": 1,
            "allow_fallback": False,
            "force_no_tools": True,
            "max_output_tokens": 2000,
        },
    )

    assert response == "bounded report"
    assert captured["enabled_toolsets"] == []
    assert captured["fallback_model"] is None
    assert captured["credential_pool"] is None
    assert captured["max_tokens"] == 2000
    assert result["proof"]["provider_attempt_count"] == 1
    assert result["proof"]["tool_event_count"] == 0
    assert result["proof"]["effective_tools"] == []
    assert result["proof"]["fallback_allowed"] is False


@pytest.mark.parametrize(
    "controls, message",
    [
        ({"max_provider_attempts": 2, "force_no_tools": True, "max_output_tokens": 1}, "max_provider_attempts=1"),
        ({"max_provider_attempts": 1, "allow_fallback": True, "force_no_tools": True, "max_output_tokens": 1}, "does not allow fallback"),
        ({"max_provider_attempts": 1, "force_no_tools": False, "max_output_tokens": 1}, "force_no_tools=true"),
        ({"max_provider_attempts": 1, "force_no_tools": True, "max_output_tokens": 0}, "positive max_output_tokens"),
    ],
)
def test_bounded_proof_rejects_relaxed_controls(monkeypatch, controls, message):
    from hermes_cli.oneshot import _run_agent

    _install_runtime_stubs(monkeypatch)
    with pytest.raises(ValueError, match=message):
        _run_agent("fixed input", proof_controls=controls)


def test_bounded_proof_rejects_any_effective_tool_before_provider(monkeypatch):
    from hermes_cli.oneshot import _run_agent

    _install_runtime_stubs(monkeypatch, effective_tools={"write_file"})
    with pytest.raises(RuntimeError, match="expected zero effective tools"):
        _run_agent(
            "fixed input",
            proof_controls={
                "max_provider_attempts": 1,
                "allow_fallback": False,
                "force_no_tools": True,
                "max_output_tokens": 10,
            },
        )


def test_provider_attempt_guard_blocks_a_second_dispatch():
    from agent.conversation_loop import _record_bounded_proof_provider_attempt

    agent = type("ProofAgent", (), {})()
    agent.provider = "fixture-provider"
    agent.model = "fixture-model"
    agent.api_mode = "chat_completions"
    agent._proof_provider_attempt_limit = 1
    agent._proof_provider_attempt_count = 0
    agent._proof_blocked_provider_attempt_count = 0
    agent._proof_provider_attempt_events = []

    _record_bounded_proof_provider_attempt(agent)
    assert agent._proof_provider_attempt_count == 1
    assert len(agent._proof_provider_attempt_events) == 1

    with pytest.raises(RuntimeError, match="before request dispatch"):
        _record_bounded_proof_provider_attempt(agent)
    assert agent._proof_blocked_provider_attempt_count == 1


def test_bounded_proof_cli_writes_complete_create_once_result(monkeypatch, tmp_path):
    import hermes_cli.bounded_proof as bounded_proof

    input_path = tmp_path / "input.md"
    result_path = tmp_path / "result.json"
    input_path.write_text("fixed input", encoding="utf-8")
    monkeypatch.setattr(
        bounded_proof,
        "_run_agent",
        lambda *_args, **_kwargs: (
            "bounded report",
            {
                "proof": {
                    "provider": "fixture-provider",
                    "model": "fixture-model",
                    "session_id": "proof-session",
                    "provider_attempt_count": 1,
                    "fallback_activated": False,
                    "tool_event_count": 0,
                    "effective_tools": [],
                    "reported_output_tokens": 17,
                }
            },
        ),
    )

    exit_code = bounded_proof.main([
        "--input-file", str(input_path),
        "--result-file", str(result_path),
        "--provider", "fixture-provider",
        "--model", "fixture-model",
        "--max-output-tokens", "2000",
    ])

    payload = json.loads(result_path.read_text(encoding="utf-8"))
    assert exit_code == 0
    assert payload["status"] == "pass"
    assert payload["exit_status"] == 0
    assert payload["duration_ms"] >= 0
    assert payload["evidence_paths"]["input"] == str(input_path.resolve())
    assert payload["evidence_paths"]["result"] == str(result_path.resolve())
