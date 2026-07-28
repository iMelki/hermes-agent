"""Regression coverage for cache recovery after an inactivity timeout (#26)."""

import inspect
import sys
import threading
from pathlib import Path


sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def _make_runner():
    from gateway.run import GatewayRunner

    runner = GatewayRunner.__new__(GatewayRunner)
    runner._agent_cache = {}
    runner._agent_cache_lock = threading.Lock()
    runner._running_agents = {}
    return runner


def test_inactivity_timeout_evicts_only_the_timed_out_session_cache_entry():
    """The next turn must rebuild instead of inheriting the timeout interrupt."""
    runner = _make_runner()
    timed_out_agent = object()
    unaffected_agent = object()
    runner._agent_cache["discord:timed-out"] = (timed_out_agent, "sig-a")
    runner._agent_cache["discord:unaffected"] = (unaffected_agent, "sig-b")

    runner._evict_cached_agent("discord:timed-out")

    assert "discord:timed-out" not in runner._agent_cache
    assert runner._agent_cache["discord:unaffected"][0] is unaffected_agent


def test_gateway_timeout_branch_evicts_after_interrupt_without_general_failure_eviction():
    """Bind the cache reset to inactivity timeout, preserving #7130's failure rule."""
    from gateway.run import GatewayRunner

    source = inspect.getsource(GatewayRunner._run_agent_inner)
    timeout_branch = source[source.index("if _inactivity_timeout:"):]
    interrupt_at = timeout_branch.index("_timed_out_agent.interrupt(_INTERRUPT_REASON_TIMEOUT)")
    eviction_at = timeout_branch.index("self._evict_cached_agent(session_key)")
    generic_failure_guard = source.index("Skip eviction when the run failed")

    assert interrupt_at < eviction_at
    assert eviction_at < generic_failure_guard
