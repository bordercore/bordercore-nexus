"""
Business logic for the Habit app.

This module provides service functions for retrieving and serializing habit
data, including list views with completion statistics and detail views with
recent log history.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta
from typing import Any

from django.contrib.auth.models import User

from habit.models import Habit, HabitLog


def create_habit(user: User, name: str, purpose: str, start_date: date) -> Habit:
    """Create a new habit for the given user.

    Args:
        user: The user who owns the habit.
        name: The name of the habit.
        purpose: Why the user is tracking this habit.
        start_date: The date habit tracking begins.

    Returns:
        The newly created Habit instance.
    """
    return Habit.objects.create(
        user=user,
        name=name,
        purpose=purpose,
        start_date=start_date,
    )


def deactivate_habit(habit: Habit) -> date:
    """Deactivate a habit by setting its end_date to yesterday.

    The is_active property treats end_date >= today as active, so we set
    end_date to yesterday for immediate deactivation.

    Args:
        habit: The Habit instance to deactivate.

    Returns:
        The end_date that was set (yesterday's date).
    """
    yesterday = date.today() - timedelta(days=1)
    habit.end_date = yesterday
    habit.save(update_fields=["end_date"])
    return yesterday


def _current_streak(completed_dates: set[date], today: date) -> int:
    """Return the length of the consecutive-completed run ending today or yesterday.

    A run of completed days that ends today counts the full run.  If today has
    not been completed yet, an unbroken run ending yesterday still counts so
    yesterday's progress is not visually lost between midnight and the user's
    first interaction with the app the next day.

    Args:
        completed_dates: Set of dates the habit was logged with completed=True.
        today: The date treated as "today" for the calculation.

    Returns:
        The streak length (0 if there is no eligible run).
    """
    cursor = today if today in completed_dates else today - timedelta(days=1)
    streak = 0
    while cursor in completed_dates:
        streak += 1
        cursor -= timedelta(days=1)
    return streak


def _longest_streak(completed_dates: set[date]) -> int:
    """Return the longest consecutive-completed run anywhere in the data.

    Args:
        completed_dates: Set of dates the habit was logged with completed=True.

    Returns:
        The longest run length (0 if `completed_dates` is empty).
    """
    if not completed_dates:
        return 0
    sorted_dates = sorted(completed_dates)
    longest = 1
    current = 1
    for i in range(1, len(sorted_dates)):
        if sorted_dates[i] - sorted_dates[i - 1] == timedelta(days=1):
            current += 1
            longest = max(longest, current)
        else:
            current = 1
    return longest


def get_habit_list(user: User) -> list[dict[str, Any]]:
    """Return a serialized list of the user's habits with completion stats.

    The payload powers the dashboard landing page: alongside the basic habit
    fields it includes a 7-day window of per-day completion (`recent_logs`),
    the user's `current_streak`, the habit's `unit` string, and the most
    recent logged numeric value (`last_value`).

    Args:
        user: The user whose habits to retrieve.

    Returns:
        List of dicts, each containing habit data and log statistics.
    """
    habits = Habit.objects.with_log_counts(user).prefetch_related("tags")

    today = date.today()
    week_start = today - timedelta(days=6)

    # Pull only the columns we need from HabitLog and bucket per habit, so the
    # whole serialization is two queries regardless of habit count.
    completed_by_habit: dict[int, set[date]] = defaultdict(set)
    for habit_id, log_date in HabitLog.objects.filter(
        habit__user=user, completed=True,
    ).values_list("habit_id", "date"):
        completed_by_habit[habit_id].add(log_date)

    week_by_habit: dict[int, dict[date, bool]] = defaultdict(dict)
    for habit_id, log_date, completed in HabitLog.objects.filter(
        habit__user=user, date__gte=week_start,
    ).values_list("habit_id", "date", "completed"):
        week_by_habit[habit_id][log_date] = completed

    # Most-recent non-null value per habit. Iterating in date desc order means
    # the first hit per habit is the answer; later rows are skipped.
    last_value_by_habit: dict[int, str] = {}
    for habit_id, value in HabitLog.objects.filter(
        habit__user=user, value__isnull=False,
    ).order_by("-date", "-created").values_list("habit_id", "value"):
        if habit_id not in last_value_by_habit:
            last_value_by_habit[habit_id] = str(value)

    week_dates = [week_start + timedelta(days=i) for i in range(7)]

    result = []
    for habit in habits:
        habit_week = week_by_habit[habit.pk]
        recent_logs = [
            {"date": d.isoformat(), "completed": habit_week.get(d, False)}
            for d in week_dates
        ]
        result.append({
            "uuid": str(habit.uuid),
            "name": habit.name,
            "purpose": habit.purpose,
            "start_date": habit.start_date.isoformat(),
            "end_date": habit.end_date.isoformat() if habit.end_date else None,
            "is_active": habit.is_active,
            "tags": [tag.name for tag in habit.tags.all()],
            "unit": habit.unit,
            "total_logs": habit.total_logs,
            "completed_logs": habit.completed_logs,
            "completed_today": habit_week.get(today, False),
            "current_streak": _current_streak(completed_by_habit[habit.pk], today),
            "last_value": last_value_by_habit.get(habit.pk),
            "recent_logs": recent_logs,
        })

    return result


def get_habit_detail(habit: Habit, user: User, days: int = 30) -> dict[str, Any]:
    """Return serialized habit data with recent log entries and streak stats.

    Args:
        habit: The Habit instance to serialize.
        user: The requesting user (for authorization context).
        days: Maximum number of recent log entries to include.  The dashboard
            detail page passes ``days=365`` so the year-long heatmap has
            enough data to render.

    Returns:
        Dict containing habit details, streak stats, and recent log entries.
    """
    logs = HabitLog.objects.filter(habit=habit).order_by("-date")[:days]

    # Streaks span all history, not just the windowed slice, so users don't
    # see a streak shorten when they look at a smaller window.
    completed_dates = set(
        HabitLog.objects.filter(habit=habit, completed=True)
        .values_list("date", flat=True)
    )
    today = date.today()

    return {
        "uuid": str(habit.uuid),
        "name": habit.name,
        "purpose": habit.purpose,
        "start_date": habit.start_date.isoformat(),
        "end_date": habit.end_date.isoformat() if habit.end_date else None,
        "is_active": habit.is_active,
        "tags": [tag.name for tag in habit.tags.all()],
        "unit": habit.unit,
        "current_streak": _current_streak(completed_dates, today),
        "longest_streak": _longest_streak(completed_dates),
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
