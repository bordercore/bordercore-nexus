"""Anthropic-backed chat with access to the Django ORM via tool use.

The user types a question; Claude streams a reply, calling into Django
through the same helpers the project's MCP server exposes
(`list_models`, `describe_model`, `django_shell`, `raw_sql`).

The generator yields Server-Sent Events as JSON-encoded lines:

    {"type": "text", "delta": "..."}
    {"type": "tool_call", "id": "...", "name": "...", "input": {...}}
    {"type": "tool_result", "id": "...", "output": "..."}
    {"type": "done"}
    {"type": "error", "message": "..."}
"""

from __future__ import annotations

import json
import logging
from collections.abc import Generator
from typing import Any, Literal, cast

import anthropic

from lib.management.commands.mcp_server import (tool_describe_model,
                                                tool_django_shell,
                                                tool_list_models, tool_raw_sql)

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-6"
EFFORT: Literal["low", "medium", "high", "xhigh", "max"] = "medium"
MAX_TOOL_ITERATIONS = 8
MAX_TOOL_OUTPUT_CHARS = 20_000

SYSTEM_PROMPT = (
    "You are a data assistant for Jerrell's personal Bordercore Django app. "
    "Use the provided tools to inspect models and run queries against the live "
    "database whenever a question requires actual data. The signed-in user is "
    "available as `User.objects.get(email=\"jerrell@bordercore.com\")` (also "
    "`pk=1`) - scope queries to that user where relevant. "
    "Prefer .values() / .values_list() over full model instances to keep "
    "results compact. Keep prose answers concise and let the data speak. "
    "When presenting tabular data (multiple rows of records, sets of related "
    "values, comparisons across columns) format the answer as a GitHub-flavored "
    "markdown table. For a single value or a short paragraph of prose, plain "
    "text is fine."
)

TOOLS: list[dict[str, Any]] = [
    {
        "name": "list_models",
        "description": "List all installed Django models, grouped by app label. "
                       "Cheap to call - use this first when you're unsure what's available.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "describe_model",
        "description": "Describe one model's fields, relations, and indexes. "
                       "Accepts `app_label.ModelName` or a bare `ModelName`.",
        "input_schema": {
            "type": "object",
            "properties": {"label": {"type": "string"}},
            "required": ["label"],
        },
    },
    {
        "name": "django_shell",
        "description": (
            "Execute Python in the Django ORM context. All installed model "
            "classes are pre-bound by name (Blob, Workout, Exercise, ...). "
            "Return the final expression's value or assign to `result`. "
            "Prefer .values() / .values_list() to keep output compact."
        ),
        "input_schema": {
            "type": "object",
            "properties": {"code": {"type": "string"}},
            "required": ["code"],
        },
    },
    {
        "name": "raw_sql",
        "description": "Run a raw SQL statement against the default database connection. "
                       "Use %s placeholders for params.",
        "input_schema": {
            "type": "object",
            "properties": {
                "sql": {"type": "string"},
                "params": {"type": "array", "items": {}},
            },
            "required": ["sql"],
        },
    },
]


def _run_tool(name: str, tool_input: dict[str, Any]) -> str:
    """Dispatch a tool call to the corresponding MCP helper.

    Output is capped at ``MAX_TOOL_OUTPUT_CHARS`` and any raised
    exception is returned as a JSON ``{"error": ...}`` string so the
    failure flows back to Claude as a tool result rather than aborting
    the stream.

    Args:
        name: Tool name from Claude's ``tool_use`` block. One of
            ``list_models``, ``describe_model``, ``django_shell``,
            ``raw_sql``; unknown names return an error payload.
        tool_input: Arguments supplied by Claude. Required keys depend
            on the tool (see ``TOOLS``).

    Returns:
        The tool helper's JSON-encoded output, possibly truncated with a
        trailing ``[truncated]`` marker, or a JSON ``{"error": ...}``
        string on failure.
    """
    try:
        if name == "list_models":
            output = tool_list_models()
        elif name == "describe_model":
            output = tool_describe_model(tool_input["label"])
        elif name == "django_shell":
            output = tool_django_shell(tool_input["code"])
        elif name == "raw_sql":
            output = tool_raw_sql(tool_input["sql"], tool_input.get("params"))
        else:
            return json.dumps({"error": f"Unknown tool: {name}"})
    except Exception as exc:  # noqa: BLE001 - return the failure to Claude as a tool result
        return json.dumps({"error": f"{type(exc).__name__}: {exc}"})

    if len(output) > MAX_TOOL_OUTPUT_CHARS:
        output = output[:MAX_TOOL_OUTPUT_CHARS] + "\n\n[truncated]"
    return output


def _sse(payload: dict[str, Any]) -> str:
    """Format ``payload`` as a single Server-Sent Events ``data:`` frame."""
    return f"data: {json.dumps(payload)}\n\n"


def stream_django_chat(messages: list[dict[str, Any]]) -> Generator[str, None, None]:
    """Run the Claude agentic loop and stream the reply as SSE frames.

    Each iteration calls ``client.messages.stream(...)`` and forwards
    ``text_delta`` events to the client. When Claude returns
    ``stop_reason="tool_use"``, the requested tools are dispatched via
    ``_run_tool`` and their outputs are appended to ``messages`` so the
    next iteration can resume. The loop terminates when Claude stops on
    something other than ``tool_use`` or after ``MAX_TOOL_ITERATIONS``
    rounds.

    Args:
        messages: Anthropic-format conversation history. On the first
            turn this is ``[{"role": "user", "content": "..."}]``;
            subsequent turns include the prior assistant content
            (text + ``tool_use`` blocks) and the user's ``tool_result``
            blocks so the loop can resume mid-conversation.

    Yields:
        SSE ``data: <json>\\n\\n`` frames. Event ``type`` is one of:

            - ``text`` — incremental text token from Claude.
            - ``tool_call`` — Claude requested a tool (``id``, ``name``,
              ``input``).
            - ``tool_result`` — output of a ``tool_call`` (``id``,
              ``output``).
            - ``done`` — terminal frame, no further events follow.
            - ``error`` — API or runtime failure (``message``); also
              terminal.

        On reaching ``MAX_TOOL_ITERATIONS`` an extra ``text`` frame
        announces the cap before the final ``done``.
    """
    client = anthropic.Anthropic()
    system_blocks = [
        {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
    ]

    try:
        for _iteration in range(MAX_TOOL_ITERATIONS):
            with client.messages.stream(
                model=MODEL,
                max_tokens=16000,
                thinking={"type": "adaptive"},
                output_config={"effort": EFFORT},
                system=cast(Any, system_blocks),
                tools=cast(Any, TOOLS),
                messages=cast(Any, messages),
            ) as stream:
                for event in stream:
                    if (
                        event.type == "content_block_delta"
                        and event.delta.type == "text_delta"
                    ):
                        yield _sse({"type": "text", "delta": event.delta.text})

                final = stream.get_final_message()

            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(
                    "django chat usage: input=%s output=%s cache_read=%s cache_write=%s",
                    final.usage.input_tokens,
                    final.usage.output_tokens,
                    getattr(final.usage, "cache_read_input_tokens", 0),
                    getattr(final.usage, "cache_creation_input_tokens", 0),
                )

            if final.stop_reason != "tool_use":
                yield _sse({"type": "done"})
                return

            tool_uses = [b for b in final.content if b.type == "tool_use"]
            tool_results: list[dict[str, Any]] = []
            for tu in tool_uses:
                tool_input = dict(tu.input) if isinstance(tu.input, dict) else {}
                yield _sse(
                    {
                        "type": "tool_call",
                        "id": tu.id,
                        "name": tu.name,
                        "input": tool_input,
                    }
                )
                output = _run_tool(tu.name, tool_input)
                yield _sse({"type": "tool_result", "id": tu.id, "output": output})
                tool_results.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": tu.id,
                        "content": output,
                    }
                )

            messages = [
                *messages,
                {"role": "assistant", "content": final.content},
                {"role": "user", "content": tool_results},
            ]

        yield _sse(
            {
                "type": "text",
                "delta": f"\n\n[Stopped after {MAX_TOOL_ITERATIONS} tool calls. "
                         "Ask me to continue if you'd like more.]",
            }
        )
        yield _sse({"type": "done"})

    except anthropic.APIStatusError as exc:
        logger.exception("Anthropic API error in django chat")
        yield _sse({"type": "error", "message": f"API error: {exc.message}"})
    except Exception as exc:  # noqa: BLE001 - surface anything else to the client
        logger.exception("Unexpected error in django chat")
        yield _sse({"type": "error", "message": f"{type(exc).__name__}: {exc}"})
