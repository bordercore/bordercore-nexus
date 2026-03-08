"""
Views for managing Todo items, including HTML list display and JSON-based task APIs.

This module provides:
- `TodoListView`: Renders the main todo list page with filtering and context data.
- `TodoTaskList`: Returns a JSON list of todos based on query parameters or search.
- `sort_todo`, `move_to_top`, `snooze_task`: Function-based views for AJAX task operations.
"""
from __future__ import annotations

import json
import re
from datetime import timedelta
from typing import Any, Iterable, cast

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.query import QuerySet
from rest_framework.request import Request
from django.shortcuts import get_object_or_404

from lib.mixins import get_user_object_or_404
from django.utils import dateformat, timezone
from django.views.generic.list import ListView

from lib.decorators import validate_post_data
from lib.util import get_field
from tag.models import Tag, TagTodo
from todo.models import Todo
from todo.services import search as search_service


def serialize_todo(todo: Todo | dict[str, Any], sort_order: int = 0) -> dict[str, Any]:
    """Convert Todo instance or dict to standardized dict for JSON response.

    This function handles both Django model objects (from querysets) and
    dictionaries (from search results) by using the get_field() utility
    function for consistent field access.

    Args:
        todo: Either a Todo model instance or a dictionary containing todo data.
            When from search results, may contain string representations of
            dates and other fields.
        sort_order: The position/order number for this todo in the current
            list context. Defaults to 0.

    Returns:
        A dictionary containing standardized todo data
    """

    # Handle created date formatting
    created = get_field(todo, "created")
    created_formatted = dateformat.format(created, "Y-m-d") if created else ""
    created_unixtime = dateformat.format(created, "U") if created else ""

    return {
        "manual_order": "",
        "sort_order": sort_order,
        "name": re.sub(r'[\n\r"]', "", get_field(todo, "name") or ""),
        "priority": get_field(todo, "priority"),
        "priority_name": Todo.get_priority_name(get_field(todo, "priority")),
        "created": created_formatted,
        "created_unixtime": created_unixtime,
        "note": get_field(todo, "note") or "",
        "url": get_field(todo, "url") or "",
        "uuid": str(get_field(todo, "uuid")),
        "due_date": get_field(todo, "due_date"),
        "tags": get_field(todo, "tags"),  # get_field handles the tag name extraction
    }


class TodoListView(LoginRequiredMixin, ListView):
    """Render the main Todo page with filters, tags, and priority data."""

    model = Todo
    template_name = "todo/index.html"
    context_object_name = "info"

    def get_filter(self, tag: str | None = None) -> dict[str, str | None]:
        """Construct the current filter settings from session or URL tag.

        Args:
            tag: Optional tag name to force as the current filter.

        Returns:
            A dict with keys 'todo_filter_priority', 'todo_filter_time', and 'todo_filter_tag'.
        """
        return {
            "todo_filter_priority": self.request.session.get("todo_filter_priority", ""),
            "todo_filter_time": self.request.session.get("todo_filter_time", ""),
            "todo_filter_tag": tag or self.request.session.get("todo_filter_tag", ""),
        }

    def get_context_data(self, **kwargs: Any) -> dict[str, Any]:
        """Add filter settings, tag counts, and UI data to template context.

        Args:
            **kwargs: Arbitrary keyword arguments passed from the base implementation.

        Returns:
            Context dict for rendering the template, including:
              - 'tags': list of tag/count pairs
              - 'filter': current filter settings
              - 'priority_list': JSON-stringified priority choices
              - 'title': page title
        """
        context = super().get_context_data(**kwargs)

        current_filter = self.get_filter()
        user = cast(User, self.request.user)

        # If a uuid is given in the url, store the associated task and
        #  set one of its tags to be the filter. Also reset priority and
        #  time filters so that the task isn't filtered out.
        if "uuid" in self.kwargs:
            context["uuid"] = self.kwargs["uuid"]
            todo = get_user_object_or_404(user, Todo, uuid=self.kwargs["uuid"])
            tag = todo.tags.first()
            current_filter["todo_filter_tag"] = tag.name if tag else None
            current_filter["todo_filter_priority"] = None
            current_filter["todo_filter_time"] = None
        tags = Todo.get_todo_counts(user)
        # Convert tags to JSON format for React: list of {name, count} objects
        tags_json = json.dumps([{"name": tag["name"], "count": tag["count"]} for tag in tags])

        return {
            **context,
            "tags": tags,
            "tags_json": tags_json,
            "filter": current_filter,
            "priority_list": json.dumps(Todo.PRIORITY_CHOICES),
            "title": "Todo"
        }


class TodoTaskList(APIView):
    """Provide a JSON endpoint listing todos filtered by priority, time, tag, or search."""

    def get_queryset(self, request: Request) -> QuerySet[Todo]:
        """Build a queryset of Todo objects based on GET parameters and session state.

        Reads 'priority', 'time', and 'tag' from request.query_params, saves them
        in session, and filters the base Todo queryset accordingly.

        Args:
            request: The DRF request with query parameters.

        Returns:
            QuerySet of filtered and ordered Todo instances.
        """
        priority = request.query_params.get("priority", None)
        if priority is not None:
            request.session["todo_filter_priority"] = priority

        time = request.query_params.get("time", None)
        if time is not None:
            request.session["todo_filter_time"] = time

        tag_name = request.query_params.get("tag", None)
        if tag_name is not None:
            request.session["todo_filter_tag"] = tag_name

        user = cast(User, request.user)

        if priority or time:

            queryset = Todo.objects.filter(user=user)

            if priority:
                queryset = queryset.filter(priority=int(priority))
            if time:
                queryset = queryset.filter(created__gt=(timezone.now() - timedelta(days=int(time))))
            if tag_name:
                queryset = queryset.filter(tag__name=tag_name)

            queryset = queryset.filter(nodetodo__isnull=True)
            queryset = queryset.order_by("name")

        elif tag_name:

            queryset = get_user_object_or_404(
                user, Tag, name=tag_name
            ).todos.filter(
                nodetodo__isnull=True
            ).order_by(
                "tagtodo__sort_order"
            )

        else:

            queryset = Todo.objects.filter(
                user=user, nodetodo__isnull=True
            ).order_by(
                "-created"
            )

        queryset = queryset.prefetch_related("tags")

        return queryset

    def get(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        """Handle GET requests: return a JSON response with todo data and statistics.

        If 'search' is provided in request.query_params, uses the search service;
        otherwise, uses the filtered queryset.

        Args:
            request: The HTTP request object.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            Response containing:
              - 'status': always "OK"
              - 'priority_counts': list of (priority, count) tuples
              - 'created_counts': list of (date, count) tuples
              - 'todo_list': list of dicts with fields for each todo
        """
        user = cast(User, request.user)
        search_term = request.query_params.get("search", None)

        if search_term:
            tasks: Iterable[Todo | dict[str, Any]] = search_service(user, search_term)
        else:
            tasks = self.get_queryset(request)

        todo_list = []
        for sort_order, todo in enumerate(tasks, 1):
            todo_list.append(serialize_todo(todo, sort_order))

        priority_counts = list(Todo.objects.priority_counts(user))
        created_counts = list(Todo.objects.created_counts(user))

        return Response({
            "status": "OK",
            "priority_counts": priority_counts,
            "created_counts": created_counts,
            "todo_list": todo_list
        })


def _reorder_todo(user: User, tag_name: str, todo_uuid: str, new_position: int) -> dict:
    """Shared logic for reordering a Todo within its tag-specific list.

    Args:
        user: The authenticated user.
        tag_name: Name of the tag.
        todo_uuid: UUID of the todo.
        new_position: New integer position (must be >= 1).

    Returns:
        Dict with status and new_position.
    """
    with transaction.atomic():
        tag_todo = get_object_or_404(
            TagTodo.objects.select_for_update(),
            tag__name=tag_name,
            tag__user=user,
            todo__uuid=todo_uuid,
            todo__user=user,
        )
        TagTodo.reorder(tag_todo, new_position)

    return {"status": "OK", "new_position": new_position}


@api_view(["POST"])
@validate_post_data("tag", "todo_uuid", "position")
def sort_todo(request: Request) -> Response:
    """Reorder a Todo within its tag-specific list and return status.

    Expects POST parameters:
      - 'tag': name of the tag
      - 'todo_uuid': UUID of the todo
      - 'position': new integer position

    Args:
        request: The HTTP request with POST data.

    Returns:
        Response with {"status": "OK"}.
    """
    tag_name = request.POST.get("tag", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()
    position_str = request.POST.get("position", "").strip()

    try:
        new_position = int(position_str)
    except (ValueError, TypeError):
        return Response({
            "status": "ERROR",
            "message": "Position must be a valid integer"
        }, status=400)

    if new_position < 1:
        return Response({
            "status": "ERROR",
            "message": "Position must be a positive integer"
        }, status=400)

    user = cast(User, request.user)
    return Response(_reorder_todo(user, tag_name, todo_uuid, new_position))


@api_view(["POST"])
@validate_post_data("tag", "todo_uuid")
def move_to_top(request: Request) -> Response:
    """Move a Todo to the top position in its tag list.

    Args:
        request: The HTTP request.

    Returns:
        Response indicating success.
    """
    tag_name = request.POST.get("tag", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()

    user = cast(User, request.user)
    return Response(_reorder_todo(user, tag_name, todo_uuid, 1))


@api_view(["POST"])
@validate_post_data("todo_uuid")
def snooze_task(request: Request) -> Response:
    """Set a Todo's due date to one day from now and save.

    Expects POST parameter:
      - 'todo_uuid': UUID of the todo to snooze.

    Args:
        request: The HTTP request with POST data.

    Returns:
        Response with {"status": "OK"}.
    """
    todo_uuid = request.POST.get("todo_uuid", "").strip()

    user = cast(User, request.user)
    todo = get_user_object_or_404(user, Todo, uuid=todo_uuid)
    todo.due_date = timezone.now() + timedelta(days=1)
    todo.save()

    return Response({"status": "OK"})
