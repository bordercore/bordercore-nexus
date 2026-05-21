"""Tests for the Anthropic-backed Django ORM chat service."""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any
from unittest.mock import MagicMock, patch

import pytest

from blob import services_django_chat
from blob.services_django_chat import (MAX_TOOL_ITERATIONS,
                                       MAX_TOOL_OUTPUT_CHARS, _run_tool,
                                       stream_django_chat)

pytestmark = [pytest.mark.django_db]


class _FakeAPIStatusError(Exception):
    """Stand-in for anthropic.APIStatusError in tests where we don't trigger it."""


# ---------- _run_tool ----------


def test_run_tool_dispatches_to_list_models():
    output = _run_tool("list_models", {})
    parsed = json.loads(output)
    assert isinstance(parsed, dict)
    # Should contain at least one app
    assert parsed


def test_run_tool_dispatches_to_django_shell():
    output = _run_tool("django_shell", {"code": "result = 1 + 1"})
    parsed = json.loads(output)
    assert parsed["result"] == 2


def test_run_tool_returns_error_for_unknown_tool():
    output = _run_tool("not_a_tool", {})
    parsed = json.loads(output)
    assert "error" in parsed
    assert "not_a_tool" in parsed["error"]


def test_run_tool_returns_error_when_helper_raises():
    output = _run_tool("describe_model", {"label": "DoesNotExist"})
    parsed = json.loads(output)
    assert "error" in parsed


def test_run_tool_truncates_large_output():
    with patch.object(
        services_django_chat,
        "tool_list_models",
        return_value="x" * (MAX_TOOL_OUTPUT_CHARS + 500),
    ):
        output = _run_tool("list_models", {})
    assert len(output) <= MAX_TOOL_OUTPUT_CHARS + len("\n\n[truncated]")
    assert output.endswith("[truncated]")


# ---------- stream_django_chat ----------


def _fake_event(type_: str, **kwargs: Any) -> SimpleNamespace:
    return SimpleNamespace(type=type_, **kwargs)


def _text_delta(text: str) -> SimpleNamespace:
    return _fake_event(
        "content_block_delta",
        delta=SimpleNamespace(type="text_delta", text=text),
    )


def _fake_final_message(stop_reason: str, content: list[Any] | None = None) -> SimpleNamespace:
    return SimpleNamespace(
        stop_reason=stop_reason,
        content=content or [],
        usage=SimpleNamespace(
            input_tokens=10,
            output_tokens=5,
            cache_read_input_tokens=0,
            cache_creation_input_tokens=0,
        ),
    )


class _FakeStreamContext:
    """Stand-in for the SDK's `messages.stream(...)` context manager."""

    def __init__(self, events: list[Any], final: SimpleNamespace):
        self._events = events
        self._final = final

    def __enter__(self) -> "_FakeStreamContext":
        return self

    def __exit__(self, *_: Any) -> None:
        return None

    def __iter__(self):
        return iter(self._events)

    def get_final_message(self) -> SimpleNamespace:
        return self._final


def _fake_client(turns: list[tuple[list[Any], SimpleNamespace]]) -> MagicMock:
    """Build a fake anthropic.Anthropic() client.

    `turns` is a list of (events, final_message) — one per loop iteration.
    """
    contexts = [_FakeStreamContext(events, final) for events, final in turns]
    client = MagicMock()
    client.messages.stream.side_effect = contexts
    return client


def _parse_sse(chunks: list[str]) -> list[dict[str, Any]]:
    events = []
    for chunk in chunks:
        for line in chunk.splitlines():
            if line.startswith("data: "):
                events.append(json.loads(line[len("data: "):]))
    return events


def test_stream_emits_text_then_done():
    client = _fake_client(
        [
            (
                [_text_delta("Hello "), _text_delta("world.")],
                _fake_final_message("end_turn"),
            )
        ]
    )
    with patch.object(services_django_chat, "anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = client
        mock_anthropic.APIStatusError = _FakeAPIStatusError
        out = list(stream_django_chat([{"role": "user", "content": "hi"}]))

    events = _parse_sse(out)
    assert [e["type"] for e in events] == ["text", "text", "done"]
    assert events[0]["delta"] == "Hello "
    assert events[1]["delta"] == "world."


def test_stream_handles_tool_loop():
    tool_use_block = SimpleNamespace(
        type="tool_use",
        id="toolu_1",
        name="django_shell",
        input={"code": "result = 1 + 1"},
    )
    client = _fake_client(
        [
            ([], _fake_final_message("tool_use", content=[tool_use_block])),
            ([_text_delta("Answer is 2.")], _fake_final_message("end_turn")),
        ]
    )
    with patch.object(services_django_chat, "anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = client
        mock_anthropic.APIStatusError = _FakeAPIStatusError
        out = list(stream_django_chat([{"role": "user", "content": "what is 1+1?"}]))

    events = _parse_sse(out)
    types = [e["type"] for e in events]
    assert types == ["tool_call", "tool_result", "text", "done"]
    assert events[0]["name"] == "django_shell"
    assert events[0]["input"] == {"code": "result = 1 + 1"}
    assert json.loads(events[1]["output"])["result"] == 2

    # Second messages.stream() call should include the tool_result we returned
    second_call_messages = client.messages.stream.call_args_list[1].kwargs["messages"]
    assert second_call_messages[-1]["role"] == "user"
    assert second_call_messages[-1]["content"][0]["tool_use_id"] == "toolu_1"


def test_stream_caps_at_max_iterations():
    tool_use_block = SimpleNamespace(
        type="tool_use",
        id="toolu_runaway",
        name="list_models",
        input={},
    )
    # Always return tool_use to simulate an infinite loop
    turns = [
        ([], _fake_final_message("tool_use", content=[tool_use_block]))
        for _ in range(MAX_TOOL_ITERATIONS)
    ]
    client = _fake_client(turns)
    with patch.object(services_django_chat, "anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = client
        mock_anthropic.APIStatusError = _FakeAPIStatusError
        out = list(stream_django_chat([{"role": "user", "content": "loop"}]))

    events = _parse_sse(out)
    assert client.messages.stream.call_count == MAX_TOOL_ITERATIONS
    # Final two events should be a stop notice + done
    assert events[-1]["type"] == "done"
    assert events[-2]["type"] == "text"
    assert "Stopped after" in events[-2]["delta"]


def test_stream_yields_error_event_on_exception():
    client = MagicMock()
    client.messages.stream.side_effect = RuntimeError("boom")
    with patch.object(services_django_chat, "anthropic") as mock_anthropic:
        mock_anthropic.Anthropic.return_value = client
        mock_anthropic.APIStatusError = _FakeAPIStatusError
        out = list(stream_django_chat([{"role": "user", "content": "hi"}]))

    events = _parse_sse(out)
    assert events[-1]["type"] == "error"
    assert "boom" in events[-1]["message"]
