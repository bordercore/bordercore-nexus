"""
Business logic for the Habit app.

This module provides service functions for retrieving and serializing habit
data, including list views with completion statistics and detail views with
recent log history.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from django.contrib.auth.models import User

from habit.models import Habit, HabitLog


def get_habit_list(user: User) -> list[dict[str, Any]]:
    """Return a serialized list of the user's habits with completion stats.

    Args:
        user: The user whose habits to retrieve.

    Returns:
        List of dicts, each containing habit data and log statistics.
    """
    habits = Habit.objects.with_log_counts(user).prefetch_related("tags")

    today = date.today()
    today_logs = {
        log.habit_id: log.completed
        for log in HabitLog.objects.filter(habit__user=user, date=today)
    }

    result = []
    for habit in habits:
        result.append({
            "uuid": str(habit.uuid),
            "name": habit.name,
            "purpose": habit.purpose,
            "start_date": habit.start_date.isoformat(),
            "end_date": habit.end_date.isoformat() if habit.end_date else None,
            "is_active": habit.is_active,
            "tags": [tag.name for tag in habit.tags.all()],
            "total_logs": habit.total_logs,
            "completed_logs": habit.completed_logs,
            "completed_today": today_logs.get(habit.pk, False),
        })

    return result


def get_habit_detail(habit: Habit, user: User) -> dict[str, Any]:
    """Return serialized habit data with recent log entries.

    Args:
        habit: The Habit instance to serialize.
        user: The requesting user (for authorization context).

    Returns:
        Dict containing habit details and a list of recent log entries.
    """
    logs = HabitLog.objects.filter(habit=habit).order_by("-date")[:30]

    return {
        "uuid": str(habit.uuid),
        "name": habit.name,
        "purpose": habit.purpose,
        "start_date": habit.start_date.isoformat(),
        "end_date": habit.end_date.isoformat() if habit.end_date else None,
        "is_active": habit.is_active,
        "tags": [tag.name for tag in habit.tags.all()],
        "logs": [
            {
                "uuid": str(log_entry.uuid),
                "date": log_entry.date.isoformat(),
                "completed": log_entry.completed,
                "value": str(log_entry.value) if log_entry.value is not None else None,
                "note": log_entry.note,
            }
            for log_entry in logs
        ],
    }
