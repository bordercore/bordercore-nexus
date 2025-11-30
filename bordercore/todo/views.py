"""
Views for managing Todo items, including HTML list display and JSON-based task APIs.

This module provides:
- `TodoListView`: Renders the main todo list page with filtering and context data.
- `TodoTaskList`: Returns a JSON list of todos based on query parameters or search.
- `sort_todo`, `move_to_top`, `reschedule_task`: Function-based views for AJAX task operations.
"""

import json
import re
from datetime import timedelta
from typing import Any, Dict, Iterable, Optional, Union, cast

from django.contrib.auth.decorators import login_required
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models.query import QuerySet
from django.http import HttpRequest, JsonResponse
from django.http.response import HttpResponseBase
from django.test import RequestFactory
from django.utils import dateformat, timezone
from django.views.decorators.http import require_POST
from django.views.generic.list import ListView

from lib.decorators import validate_post_data
from lib.util import get_field
from tag.models import Tag, TagTodo
from todo.models import Todo
from todo.services import search as search_service


def serialize_todo(todo: Union[Todo, Dict[str, Any]], sort_order: int = 0) -> Dict[str, Any]:
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

    def get_filter(self, tag: Optional[str] = None) -> Dict[str, Optional[str]]:
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

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
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

        # If a uuid is given in the url, store the associated task and
        #  set one of its tags to be the filter. Also reset priority and
        #  time filters so that the task isn't filtered out.
        if "uuid" in self.kwargs:
            context["uuid"] = self.kwargs["uuid"]
            todo = Todo.objects.get(uuid=self.kwargs["uuid"])
            tag = todo.tags.first()
            current_filter["todo_filter_tag"] = tag.name if tag else None
            current_filter["todo_filter_priority"] = None
            current_filter["todo_filter_time"] = None

        user = cast(User, self.request.user)

        return {
            **context,
            "tags": Todo.get_todo_counts(user),
            "filter": current_filter,
            "priority_list": json.dumps(Todo.PRIORITY_CHOICES),
            "title": "Todo"
        }


class TodoTaskList(LoginRequiredMixin, ListView):
    """Provide a JSON endpoint listing todos filtered by priority, time, tag, or search."""

    model = Todo
    context_object_name = "info"

    def get_queryset(self) -> QuerySet[Todo]:
        """Build a queryset of Todo objects based on GET parameters and session state.

        Reads 'priority', 'time', and 'tag' from request.GET, saves them in session,
        and filters the base Todo queryset accordingly.

        Returns:
            QuerySet of filtered and ordered Todo instances.
        """
        priority = self.request.GET.get("priority", None)
        if priority is not None:
            self.request.session["todo_filter_priority"] = priority

        time = self.request.GET.get("time", None)
        if time is not None:
            self.request.session["todo_filter_time"] = time

        tag_name = self.request.GET.get("tag", None)
        if tag_name is not None:
            self.request.session["todo_filter_tag"] = tag_name

        user = cast(User, self.request.user)

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

            queryset = Tag.objects.get(
                user=user,
                name=tag_name
            ).todos.filter(
                nodetodo__isnull=True
            ).order_by(
                "tagtodo__sort_order"
            )

        else:

            queryset = Todo.objects.filter(
                user=user
            ).filter(
                nodetodo__isnull=True
            ).order_by(
                "-created"
            )

        queryset = queryset.prefetch_related("tags")

        return queryset

    def get(self, request: HttpRequest, *args: Any, **kwargs: Any) -> JsonResponse:
        """Handle GET requests: return a JSON response with todo data and statistics.

        If 'search' is provided in request.GET, uses the search service; otherwise,
        uses the filtered queryset.

        Args:
            request: The HTTP request object.
            *args: Additional positional arguments.
            **kwargs: Additional keyword arguments.

        Returns:
            JsonResponse containing:
              - 'status': always "OK"
              - 'priority_counts': list of (priority, count) tuples
              - 'created_counts': list of (date, count) tuples
              - 'todo_list': list of dicts with fields for each todo
        """
        user = cast(User, self.request.user)
        search_term = self.request.GET.get("search", None)

        if search_term:
            tasks: Iterable[Todo | Dict[str, Any]] = search_service(user, search_term)
        else:
            tasks = self.get_queryset()

        todo_list = []
        for sort_order, todo in enumerate(tasks, 1):
            todo_list.append(serialize_todo(todo, sort_order))

        priority_counts = list(Todo.objects.priority_counts(user))
        created_counts = list(Todo.objects.created_counts(user))

        response = {
            "status": "OK",
            "priority_counts": priority_counts,
            "created_counts": created_counts,
            "todo_list": todo_list
        }

        return JsonResponse(response)


@login_required
@require_POST
@validate_post_data("tag", "todo_uuid", "position")
def sort_todo(request: HttpRequest) -> JsonResponse:
    """Reorder a Todo within its tag-specific list and return status.

    Expects POST parameters:
      - 'tag': name of the tag
      - 'todo_uuid': UUID of the todo
      - 'position': new integer position

    Args:
        request: The HTTP request with POST data.

    Returns:
        JsonResponse with {"status": "OK"}.
    """
    tag_name = request.POST.get("tag", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()
    position_str = request.POST.get("position", "").strip()

    try:
        new_position = int(position_str)
    except (ValueError, TypeError):
        return JsonResponse({
            "status": "ERROR",
            "message": "Position must be a valid integer"
        }, status=400)

    if new_position < 1:
        return JsonResponse({
            "status": "ERROR",
            "message": "Position must be a positive integer"
        }, status=400)

    with transaction.atomic():
        user = cast(User, request.user)
        tag_todo = TagTodo.objects.select_for_update().get(
            tag__name=tag_name,
            tag__user=user,
            todo__uuid=todo_uuid,
            todo__user=user
        )
        TagTodo.reorder(tag_todo, new_position)

    return JsonResponse({"status": "OK", "new_position": new_position})


@login_required
@require_POST
@validate_post_data("tag", "todo_uuid")
def move_to_top(request: HttpRequest) -> HttpResponseBase:
    """Move a Todo to the top position in its tag list.

    Modifies request.POST to set 'position' to 1 and delegates to `sort_todo`.

    Args:
        request: The HTTP request.

    Returns:
        JsonResponse from `sort_todo`, indicating success.
    """
    tag_name = request.POST.get("tag", "").strip()
    todo_uuid = request.POST.get("todo_uuid", "").strip()

    # Create a new HttpRequest with the modified POST data
    factory = RequestFactory()
    new_request = factory.post("/", {
        "tag": tag_name,
        "todo_uuid": todo_uuid,
        "position": "1"
    })
    new_request.user = request.user

    return sort_todo(new_request)


@login_required
@require_POST
@validate_post_data("todo_uuid")
def reschedule_task(request: HttpRequest) -> JsonResponse:
    """Set a Todo's due date to one day from now and save.

    Expects POST parameter:
      - 'todo_uuid': UUID of the todo to reschedule.

    Args:
        request: The HTTP request with POST data.

    Returns:
        JsonResponse with {"status": "OK"}.
    """
    todo_uuid = request.POST.get("todo_uuid", "").strip()

    user = cast(User, request.user)
    todo = Todo.objects.get(uuid=todo_uuid, user=user)
    todo.due_date = timezone.now() + timedelta(days=1)
    todo.save()

    return JsonResponse({"status": "OK"})
