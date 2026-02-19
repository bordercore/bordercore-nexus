"""
Views for the Habit app, including HTML list/detail pages and JSON-based APIs.

This module provides:
- `HabitListView`: Renders the main habit list page.
- `HabitDetailView`: Renders the habit detail page with log history.
- `get_habits`: Returns a JSON list of habits with completion stats.
- `log_habit`: Creates or updates a daily habit log entry via POST.
"""

from __future__ import annotations

import json
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, cast

from rest_framework.decorators import api_view
from rest_framework.request import Request
from rest_framework.response import Response

from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.views.generic.detail import DetailView
from django.views.generic.list import ListView

from habit.models import Habit, HabitLog
from habit.services import get_habit_detail, get_habit_list
from lib.decorators import validate_post_data
from lib.mixins import UserScopedQuerysetMixin, get_user_object_or_404


class HabitListView(LoginRequiredMixin, UserScopedQuerysetMixin, ListView):
    """Render the main Habit list page with habits and completion data."""

    model = Habit
    template_name = "habit/list.html"
    context_object_name = "habits"

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Add serialized habit data to template context.

        Args:
            **kwargs: Arbitrary keyword arguments passed from the base implementation.

        Returns:
            Context dict for rendering the template.
        """
        context = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        habits_data = get_habit_list(user)

        return {
            **context,
            "habits_json": json.dumps(habits_data),
            "title": "Habits",
        }


class HabitDetailView(LoginRequiredMixin, UserScopedQuerysetMixin, DetailView):
    """Render the detail page for a single Habit with log history."""

    model = Habit
    template_name = "habit/detail.html"
    slug_field = "uuid"
    slug_url_kwarg = "uuid"

    def get_context_data(self, **kwargs: Any) -> Dict[str, Any]:
        """Add serialized habit detail data to template context.

        Args:
            **kwargs: Arbitrary keyword arguments passed from the base implementation.

        Returns:
            Context dict for rendering the template.
        """
        context = super().get_context_data(**kwargs)
        user = cast(User, self.request.user)
        detail_data = get_habit_detail(self.object, user)

        return {
            **context,
            "habit_json": json.dumps(detail_data),
            "title": f"Habit :: {self.object.name}",
        }


@api_view(["GET"])
def get_habits(request: Request) -> Response:
    """Return a JSON list of the user's habits with completion stats.

    Args:
        request: The HTTP request object.

    Returns:
        Response containing habit list data.
    """
    user = cast(User, request.user)
    habits = get_habit_list(user)

    return Response({"status": "OK", "habits": habits})


@api_view(["POST"])
@validate_post_data("habit_uuid", "date", "completed")
def log_habit(request: Request) -> Response:
    """Create or update a daily habit log entry.

    Expects POST parameters:
      - 'habit_uuid': UUID of the habit.
      - 'date': Date string (YYYY-MM-DD).
      - 'completed': Whether the habit was completed ("true"/"false").
      - 'value' (optional): Numeric value.
      - 'note' (optional): Text note.

    Args:
        request: The HTTP request with POST data.

    Returns:
        Response with {"status": "OK"} and the log entry data.
    """
    user = cast(User, request.user)
    habit_uuid = request.POST["habit_uuid"]
    log_date_str = request.POST["date"]
    completed_str = request.POST["completed"]

    habit = get_user_object_or_404(user, Habit, uuid=habit_uuid)

    try:
        log_date = date.fromisoformat(log_date_str)
    except ValueError:
        return Response(
            {"status": "ERROR", "message": "Invalid date format. Use YYYY-MM-DD."},
            status=400,
        )

    completed = completed_str.lower() in ("true", "1", "yes")

    value = None
    value_str = request.POST.get("value", "").strip()
    if value_str:
        try:
            value = Decimal(value_str)
        except InvalidOperation:
            return Response(
                {"status": "ERROR", "message": "Invalid numeric value."},
                status=400,
            )

    note = request.POST.get("note", "")

    log, _created = HabitLog.objects.update_or_create(
        habit=habit,
        date=log_date,
        defaults={
            "completed": completed,
            "value": value,
            "note": note,
        },
    )

    return Response({
        "status": "OK",
        "log": {
            "uuid": str(log.uuid),
            "date": log.date.isoformat(),
            "completed": log.completed,
            "value": str(log.value) if log.value is not None else None,
            "note": log.note,
        },
    })
