"""
Managers for the Habit app.

This module provides a custom manager for the `Habit` model, offering methods
to retrieve active habits and annotate habits with log completion statistics.
"""

from __future__ import annotations

from datetime import date

from django.contrib.auth.models import User
from django.db import models
from django.db.models import Count, Q, QuerySet


class HabitManager(models.Manager):
    """Custom manager for `Habit` model with filtering and annotation utilities."""

    def active(self, user: User) -> QuerySet:
        """Return habits that are currently active for the given user.

        A habit is active if it has no end_date or its end_date is today or later.

        Args:
            user: The user whose active habits to retrieve.

        Returns:
            QuerySet of active Habit instances.
        """
        today = date.today()
        return self.filter(user=user).filter(
            Q(end_date__isnull=True) | Q(end_date__gte=today)
        )

    def with_log_counts(self, user: User) -> QuerySet:
        """Return habits annotated with total log count and completed count.

        Args:
            user: The user whose habits to annotate.

        Returns:
            QuerySet of Habit instances with `total_logs` and `completed_logs`
            annotations.
        """
        return self.filter(user=user).annotate(
            total_logs=Count("habitlog"),
            completed_logs=Count("habitlog", filter=Q(habitlog__completed=True)),
        )
