"""MCP (Model Context Protocol) server exposing the Django ORM over stdio.

Run via:
    DJANGO_SETTINGS_MODULE=config.settings.dev python manage.py mcp_server

Registered tools:
    - list_models: enumerate installed models
    - describe_model: fields, relations, and indexes for a model
    - django_shell: run arbitrary Python with Django set up
    - raw_sql: run a raw SQL statement against the default connection
"""

from __future__ import annotations

import asyncio
import builtins
import io
import json
import sys
import textwrap
import traceback
from contextlib import redirect_stdout
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from django.apps import apps
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.models import Model

MAX_RESULT_CHARS = 50_000


def _json_default(obj: Any) -> Any:
    if isinstance(obj, (datetime, date, time)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, set):
        return list(obj)
    if isinstance(obj, Model):
        return {"_model": obj._meta.label, "pk": obj.pk, "str": str(obj)}
    if hasattr(obj, "__iter__"):
        try:
            return list(obj)
        except TypeError:
            pass
    return repr(obj)


def _to_json(value: Any) -> str:
    text = json.dumps(value, default=_json_default, indent=2, ensure_ascii=False)
    if len(text) > MAX_RESULT_CHARS:
        text = text[:MAX_RESULT_CHARS] + f"\n\n[truncated - {len(text)} chars total]"
    return text


def _resolve_model(label: str) -> type[Model]:
    """Resolve `app_label.ModelName` or bare `ModelName` to a model class."""
    if "." in label:
        return apps.get_model(label)
    for model in apps.get_models():
        if model.__name__ == label or model._meta.model_name == label.lower():
            return model
    raise LookupError(f"No model matching {label!r}")


def tool_list_models() -> str:
    grouped: dict[str, list[str]] = {}
    for model in apps.get_models():
        grouped.setdefault(model._meta.app_label, []).append(model.__name__)
    for names in grouped.values():
        names.sort()
    return _to_json(dict(sorted(grouped.items())))


def tool_describe_model(label: str) -> str:
    model = _resolve_model(label)
    meta = model._meta
    fields: list[dict[str, Any]] = []
    for field in meta.get_fields():
        entry: dict[str, Any] = {
            "name": field.name,
            "type": field.__class__.__name__,
        }
        if hasattr(field, "null"):
            entry["null"] = field.null
        if getattr(field, "is_relation", False):
            related = getattr(field, "related_model", None)
            if related is not None:
                entry["related_model"] = related._meta.label
            entry["many_to_many"] = getattr(field, "many_to_many", False)
            entry["many_to_one"] = getattr(field, "many_to_one", False)
            entry["one_to_many"] = getattr(field, "one_to_many", False)
            entry["one_to_one"] = getattr(field, "one_to_one", False)
        if hasattr(field, "choices") and field.choices:
            entry["choices"] = list(field.choices)
        fields.append(entry)
    return _to_json(
        {
            "label": meta.label,
            "db_table": meta.db_table,
            "pk": meta.pk.name if meta.pk else None,
            "ordering": list(meta.ordering) if meta.ordering else [],
            "verbose_name": str(meta.verbose_name),
            "fields": fields,
            "indexes": [list(idx.fields) for idx in meta.indexes],
            "unique_together": [list(group) for group in meta.unique_together],
        }
    )


def tool_django_shell(code: str) -> str:
    """Run Python with Django apps loaded.

    The value of the final expression (or a bare `result = ...` assignment)
    is serialized to JSON. Anything printed to stdout is captured and
    returned alongside the value.
    """
    code = textwrap.dedent(code).strip("\n")
    namespace: dict[str, Any] = {"apps": apps, "connection": connection}
    for model in apps.get_models():
        namespace.setdefault(model.__name__, model)

    buffer = io.StringIO()
    result: Any = None
    try:
        with redirect_stdout(buffer):
            try:
                compiled = compile(code, "<mcp>", "eval")
                result = eval(compiled, namespace)  # noqa: S307
            except SyntaxError:
                compiled = compile(code, "<mcp>", "exec")
                builtins.exec(compiled, namespace)  # noqa: S102
                result = namespace.get("result")
    except Exception:
        return _to_json(
            {
                "error": traceback.format_exc(),
                "stdout": buffer.getvalue(),
            }
        )
    return _to_json({"result": result, "stdout": buffer.getvalue()})


def tool_raw_sql(sql: str, params: list[Any] | None = None) -> str:
    with connection.cursor() as cursor:
        cursor.execute(sql, params or [])
        if cursor.description is None:
            return _to_json({"rowcount": cursor.rowcount})
        columns = [col[0] for col in cursor.description]
        rows = [dict(zip(columns, row)) for row in cursor.fetchall()]
    return _to_json({"columns": columns, "rowcount": len(rows), "rows": rows})


def build_server() -> Any:
    from mcp.server.fastmcp import FastMCP

    server = FastMCP("bordercore-django")

    @server.tool()
    async def list_models() -> str:
        """List all installed Django models, grouped by app label."""
        return await asyncio.to_thread(tool_list_models)

    @server.tool()
    async def describe_model(label: str) -> str:
        """Describe a model's fields, relations, and indexes.

        Accepts `app_label.ModelName` or a bare `ModelName`.
        """
        return await asyncio.to_thread(tool_describe_model, label)

    @server.tool()
    async def django_shell(code: str) -> str:
        """Run Python with the Django ORM loaded.

        All installed model classes are injected into the namespace by name
        (e.g. `Exercise`, `Workout`). Return the final expression's value or
        assign to `result`. Prefer `.values()` / `.values_list()` to keep
        output compact.
        """
        return await asyncio.to_thread(tool_django_shell, code)

    @server.tool()
    async def raw_sql(sql: str, params: list[Any] | None = None) -> str:
        """Run a raw SQL statement. Use `%s` placeholders for params."""
        return await asyncio.to_thread(tool_raw_sql, sql, params)

    return server


class Command(BaseCommand):
    help = "Run an MCP stdio server that exposes the Django ORM."

    def handle(self, *args: Any, **opts: Any) -> None:
        try:
            server = build_server()
        except ImportError:
            sys.stderr.write(
                "The `mcp` package is not installed. Run `uv sync` to install it.\n"
            )
            sys.exit(1)
        server.run()
