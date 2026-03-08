"""
Managers for the Todo app.

This module provides a custom manager for the `Todo` model, offering methods
to compute counts of todos by priority and by recent creation date ranges.
"""

from __future__ import annotations

from datetime import timedelta

from django.apps import apps
from django.contrib.auth.models import User
from django.db import models
from django.db.models import Count, Q
from django.utils import timezone


class TodoManager(models.Manager):
    """Custom manager for `Todo` model with aggregation utilities."""

    def priority_counts(self, user: User) -> list[tuple[int, str, int]]:
        """Return counts of todos grouped by priority for the given user.

        Args:
            user: The user whose todos to count.

        Returns:
            List of tuples `(priority_value, priority_label, count)`
            in the fixed order: High (1), Medium (2), Low (3).
        """
        Todo = apps.get_model("todo", "Todo")

        priority_counts = Todo.objects.values("priority") \
                                      .annotate(count=Count("priority")) \
                                      .filter(user=user) \
                                      .order_by("-count")

        cache: dict[int, int] = {}

        for entry in priority_counts:
            cache[entry["priority"]] = entry["count"]

        filter_priority_options: list[tuple[int, str, int]] = [
            (1, "High", cache.get(1, 0)),
            (2, "Medium", cache.get(2, 0)),
            (3, "Low", cache.get(3, 0))
        ]

        return filter_priority_options

    def created_counts(self, user: User) -> list[tuple[str, str, int]]:
        """Return counts of todos grouped by recent creation date ranges.

        Args:
            user: The user whose todos to count.

        Returns:
            List of tuples `(days_str, label, count)` for these ranges:
              - ("1", "Last Day")
              - ("3", "Last 3 Days")
              - ("7", "Last Week")
              - ("30", "Last Month")
        """
        Todo = apps.get_model("todo", "Todo")
        now = timezone.now()

        created_counts = Todo.objects.aggregate(
            last_day=Count(
                "pk",
                filter=Q(created__gt=now - timedelta(days=1)) & Q(user=user),
            ),
            last_3_days=Count(
                "pk",
                filter=Q(created__gt=now - timedelta(days=3)) & Q(user=user),
            ),
            last_week=Count(
                "pk",
                filter=Q(created__gt=now - timedelta(days=7)) & Q(user=user),
            ),
            last_month=Count(
                "pk",
                filter=Q(created__gt=now - timedelta(days=30)) & Q(user=user),
            ),
        )

        filter_created_options: list[tuple[str, str, int]] = [
            ("1", "Last Day", created_counts.get("last_day", 0)),
            ("3", "Last 3 Days", created_counts.get("last_3_days", 0)),
            ("7", "Last Week", created_counts.get("last_week", 0)),
            ("30", "Last Month", created_counts.get("last_month", 0)),
        ]

        return filter_created_options
