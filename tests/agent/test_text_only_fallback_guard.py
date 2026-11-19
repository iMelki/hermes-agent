import unittest
from types import MappingProxyType
from agent.text_only_fallback_guard import reject_fallback, requires_tools


class FallbackGuardTests(unittest.TestCase):
    def setUp(self):
        self.route = {"provider": "custom", "model": "gemini-3.8-flash-high", "base_url": "http://127.0.0.1:4141/v1/gemini-cli"}

    def test_tools_and_tool_history_are_refused(self):
        for payload in ({"tools": [{"type": "function"}]}, {"messages": [{"role": "tool"}]},
                        {"input": [{"type": "function_call_output"}]}, {"tool_choice": {"type": "function"}}):
            with self.subTest(payload=payload):
                self.assertTrue(reject_fallback(self.route, payload))

    def test_text_only_and_empty_tools_remain_allowed(self):
        self.assertFalse(reject_fallback(self.route, {"messages": [{"role": "user", "content": "hello"}], "tools": []}))
        self.assertFalse(reject_fallback(self.route, {"tool_choice": "none"}))

    def test_unknown_routes_are_not_assumed_unsupported(self):
        for url in ("https://example.org/v1/gemini-cli", "http://127.0.0.1:4142/v1/gemini-cli",
                    "http://127.0.0.1:4141/v1/codex", "http://127.0.0.1:bad/v1/gemini-cli"):
            with self.subTest(url=url):
                self.assertFalse(reject_fallback(dict(self.route, base_url=url), {"tools": [1]}))

    def test_null_messages_falls_back_to_input_and_array_choice_is_tool_bearing(self):
        self.assertTrue(requires_tools({"messages": None, "input": [{"role": "tool"}]}))
        self.assertTrue(requires_tools({"tool_choice": []}))
        self.assertTrue(requires_tools({"function_call": [1]}))

    def test_unknown_case_sensitive_path_and_nonstring_config_remain_unknown(self):
        self.assertFalse(reject_fallback(dict(self.route, base_url="http://127.0.0.1:4141/v1/GEMINI-CLI"), {"tools": [1]}))
        self.assertFalse(reject_fallback(dict(self.route, base_url=4141), {"tools": [1]}))

    def test_messages_cannot_hide_tool_bearing_input(self):
        payload = {"messages": [{"role": "user", "content": "hello"}],
                   "input": [{"type": "function_call_output", "output": "ok"}]}
        self.assertTrue(reject_fallback(self.route, payload))
        self.assertFalse(reject_fallback(self.route, {"messages": [], "input": [{"role": "user", "content": "hello"}]}))

    def test_tuple_and_one_shot_iterables_are_not_missed_or_consumed(self):
        self.assertTrue(requires_tools({"tools": ({"type": "function"},)}))
        self.assertTrue(requires_tools({"functions": ({"name": "f"},)}))
        self.assertTrue(requires_tools({"messages": ({"role": "tool"},)}))
        self.assertTrue(requires_tools({"messages": [{"tool_calls": iter([1])}]}))
        history = iter([{"role": "user"}])
        self.assertTrue(requires_tools({"messages": history}))
        self.assertEqual(next(history), {"role": "user"})
        self.assertFalse(requires_tools({"tools": (), "messages": ({"role": "user"},)}))

    def test_legacy_function_calls_are_tool_bearing(self):
        self.assertTrue(requires_tools({"messages": [{"function_call": {}}]}))
        self.assertTrue(requires_tools({"functions": [1]}))

    def test_extra_body_tools_match_effective_request(self):
        self.assertTrue(reject_fallback(self.route, {"extra_body": {"tools": [{"type": "function"}]}}))
        self.assertFalse(reject_fallback(self.route, {"tools": [{"type": "function"}], "extra_body": {"tools": []}}))
        self.assertTrue(reject_fallback(self.route, {"extra_body": {"messages": [{"role": "tool"}]}}))
        self.assertTrue(reject_fallback(self.route, {"extra_body": MappingProxyType({"tools": [1]})}))
        self.assertTrue(reject_fallback(self.route, {"messages": object(), "input": [{"role": "tool"}]}))


if __name__ == "__main__":
    unittest.main()
