"""Fitness service-layer utilities.

This module provides pure-Python helpers that sit between Django views and
ORM models. The functions compute per-user summaries of exercises (including
overdue status) and return data suitable for rendering UI lists and badges.
"""

from __future__ import annotations

import datetime
from typing import cast

from django.contrib.auth.models import User
from django.db.models import F, Max, OuterRef, Q, Subquery
from django.utils import timezone

from fitness.models import Exercise, ExerciseUser

OVERDUE_THRESHOLD_DAYS = 6

def get_fitness_summary(
    user: User, count_only: bool = False, prefetch_muscles: bool = True,
) -> tuple[list[Exercise], list[Exercise]]:
    """Return active and inactive exercises for a user, annotated with status.

    ``prefetch_muscles`` controls whether ``muscle`` / ``muscle__muscle_group``
    are eagerly loaded. Callers that don't need muscle data (e.g. the homepage
    overdue list) should pass ``False`` to avoid an unnecessary eager load.
    """

    newest = ExerciseUser.objects.filter(
        exercise=OuterRef("pk"), user=user
    )

    exercises = Exercise.objects.annotate(
        last_active=Max(
            "workout__data__date",
            filter=Q(workout__user=user) | Q(workout__isnull=True),
        ),
        is_active=Subquery(newest.values("started")[:1]),
        schedule=Subquery(newest.values("schedule")[:1]),
        frequency=Subquery(newest.values("frequency")[:1]),
    ).order_by(F("last_active"))

    if not count_only and prefetch_muscles:
        exercises = exercises.prefetch_related("muscle", "muscle__muscle_group")

    active_exercises = []
    inactive_exercises = []
    current_weekday = datetime.date.today().weekday()
    now_date = timezone.localdate()

    for e in exercises:
        last_active = getattr(e, "last_active", None)
        is_active_marker = getattr(e, "is_active", None)
        schedule_val = getattr(e, "schedule", None)

        e.overdue = 0  # type: ignore[attr-defined]
        e.schedule_days = ExerciseUser.schedule_days(schedule_val) if schedule_val is not None else ""  # type: ignore[attr-defined]

        if last_active:
            # Calculate days since last activity (date-only comparison)
            last_date = timezone.localtime(last_active).date()
            days_since = (now_date - last_date).days
            e.delta_days = days_since  # type: ignore[attr-defined]

            # Check if exercise is scheduled for today and wasn't done today
            is_scheduled_today = (
                schedule_val is not None
                and 0 <= current_weekday < len(schedule_val)
                and schedule_val[current_weekday] is True
            )

            if is_scheduled_today and days_since > 0:
                e.overdue = 1  # type: ignore[attr-defined]  # Due today
            elif days_since > OVERDUE_THRESHOLD_DAYS:
                e.overdue = 2  # type: ignore[attr-defined]  # Overdue

        if is_active_marker is not None:
            active_exercises.append(e)
        else:
            inactive_exercises.append(e)

    active_exercises.sort(
        key=lambda x: (
            x.overdue,  # type: ignore[attr-defined]
            getattr(x, "last_active", None) or timezone.make_aware(datetime.datetime.min),
        ),
        reverse=True,
    )

    return cast(tuple[list[Exercise], list[Exercise]], (active_exercises, inactive_exercises))


def get_overdue_exercises(
    user: User, count_only: bool = False, prefetch_muscles: bool = True,
) -> int | list[Exercise]:
    """Return overdue (or due today) exercises for a user, or just the count.

    An exercise is considered:
      - ``1`` (due today) if it's scheduled for the current weekday and the
        last activity was not today; or
      - ``2`` (overdue) if the last activity was more than
        ``OVERDUE_THRESHOLD_DAYS`` days ago.
    These flags are computed in :func:`get_fitness_summary`.

    Args:
        user: The Django user whose overdue items to compute.
        count_only: If ``True``, return only the integer count; otherwise
            return the list of overdue/due-today :class:`Exercise` objects.
        prefetch_muscles: If ``False``, skip eager-loading muscle data. Use
            this when the caller only needs basic exercise fields.

    Returns:
        int | list[Exercise]: Either a count (when ``count_only`` is ``True``)
        or the list of exercises with ``overdue`` in ``(1, 2)``.
    """
    overdue_exercises = [
        x
        for x in get_fitness_summary(user, count_only, prefetch_muscles)[0]
        if x.overdue in (1, 2)  # type: ignore[attr-defined]
    ]

    if count_only:
        return len(overdue_exercises)
    return overdue_exercises
