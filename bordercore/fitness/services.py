"""Fitness service-layer utilities.

This module provides pure-Python helpers that sit between Django views and
ORM models. The functions compute per-user summaries of exercises (including
overdue status) and return data suitable for rendering UI lists and badges.
"""

from __future__ import annotations

import datetime
from datetime import timedelta
from typing import List, Tuple, Union, cast

from django.contrib.auth.models import User
from django.db.models import F, Max, OuterRef, Q, Subquery
from django.db.models.query import QuerySet
from django.utils import timezone

from fitness.models import Exercise, ExerciseUser


def get_fitness_summary(user: User, count_only: bool = False) -> Tuple[List[Exercise], List[Exercise]]:
    """Return active and inactive exercises for a user, annotated with status.

    This computes, per exercise, the most recent activity date, whether the
    user has this exercise marked active, the user's schedule for it, and a
    lightweight "overdue" status (0 = not due, 1 = due today, 2 = overdue).
    For convenience in templates, it also attaches a human-readable
    ``schedule_days`` string to each object.

    Args:
        user: The Django user whose exercise summary to compute.
        count_only: If ``True``, skips prefetches for better performance;
            the return shape does not change.

    Returns:
        tuple[list[Exercise], list[Exercise]]: Two lists:
        ``(active_exercises, inactive_exercises)`` ordered so that active
        items are sorted by their ``overdue`` flag descending.
    """
    newest: QuerySet[ExerciseUser] = (
        ExerciseUser.objects.filter(exercise=OuterRef("pk")).filter(user=user)
    )

    exercises: QuerySet[Exercise] = (
        Exercise.objects.annotate(
            last_active=Max(
                "workout__data__date",
                filter=Q(workout__user=user) | Q(workout__isnull=True),
            ),
            is_active=Subquery(newest.values("started")[:1]),
            schedule=Subquery(newest.values("schedule")[:1]),
            frequency=Subquery(newest.values("frequency")[:1]),
        ).order_by(F("last_active"))
    )

    if not count_only:
        exercises = exercises.prefetch_related("muscle", "muscle__muscle_group")

    active_exercises: List[Exercise] = []
    inactive_exercises: List[Exercise] = []

    current_d_o_t_w: int = datetime.date.today().weekday()

    for e in exercises:
        # Pull annotated fields via getattr so mypy doesn’t think they’re missing.
        last_active: datetime.datetime | None = getattr(e, "last_active", None)
        # `started` from Subquery is typically a datetime, but treat as object | None for truthiness.
        is_active_marker: object | None = getattr(e, "is_active", None)
        # Subquery(schedule) is an array field (list[bool | None]); cast for type-checking.
        schedule_val: List[bool | None] | None = cast(
            List[bool | None] | None, getattr(e, "schedule", None)
        )

        # dynamic presentation attrs (ok to set at runtime)
        e.overdue = 0  # type: ignore[attr-defined]

        if last_active:
            delta = timezone.now() - last_active

            # Round up to the nearest day if >= 12 hours.
            if delta.seconds // 3600 >= 12:
                delta = delta + timedelta(days=1)

            e.delta_days = delta.days  # type: ignore[attr-defined]

            if schedule_val and current_d_o_t_w < len(schedule_val) and schedule_val[current_d_o_t_w] and e.delta_days != 0:  # type: ignore[attr-defined]
                # Exercise is due today
                e.overdue = 1  # type: ignore[attr-defined]
            else:
                days_since = (
                    (timezone.now() - datetime.datetime(1970, 1, 1).astimezone()).days
                    - (last_active - datetime.datetime(1970, 1, 1).astimezone()).days
                    + 1
                )
                if days_since > 8:
                    # Exercise is overdue
                    e.overdue = 2  # type: ignore[attr-defined]

            e.schedule_days = ExerciseUser.schedule_days(schedule_val)  # type: ignore[attr-defined]

        # Partition into active/inactive based on the annotated marker.
        if is_active_marker is not None:
            active_exercises.append(e)
        else:
            inactive_exercises.append(e)

    active_exercises = sorted(active_exercises, key=lambda x: x.overdue, reverse=True)  # type: ignore[attr-defined]

    return active_exercises, inactive_exercises


def get_overdue_exercises(user: User, count_only: bool = False) -> Union[int, List[Exercise]]:
    """Return overdue (or due today) exercises for a user, or just the count.

    An exercise is considered:
      - ``1`` (due today) if it's scheduled for the current weekday and the
        last activity was not today; or
      - ``2`` (overdue) if the last activity was more than 8 days ago.
    These flags are computed in :func:`get_fitness_summary`.

    Args:
        user: The Django user whose overdue items to compute.
        count_only: If ``True``, return only the integer count; otherwise
            return the list of overdue/due-today :class:`Exercise` objects.

    Returns:
        int | list[Exercise]: Either a count (when ``count_only`` is ``True``)
        or the list of exercises with ``overdue`` in ``(1, 2)``.
    """
    overdue_exercises: List[Exercise] = [
        x
        for x in get_fitness_summary(user, count_only)[0]
        if x.overdue in (1, 2)  # type: ignore[attr-defined]
    ]

    if count_only:
        return len(overdue_exercises)
    return overdue_exercises
