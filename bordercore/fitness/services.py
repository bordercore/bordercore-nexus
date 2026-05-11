"""Fitness service-layer utilities.

This module provides pure-Python helpers that sit between Django views and
ORM models. The functions compute per-user summaries of exercises (including
overdue status) and return data suitable for rendering UI lists and badges.
"""

from __future__ import annotations

import datetime
from collections import defaultdict
from typing import Any, cast

from django.contrib.auth.models import User
from django.db.models import F, Max, OuterRef, Q, Subquery
from django.urls import reverse
from django.utils import timezone

from fitness.models import Data, Exercise, ExerciseUser

OVERDUE_THRESHOLD_DAYS = 6

# How many recent set-level data points to surface for each card's sparkline.
SPARKLINE_LIMIT = 20

# Map of MuscleGroup.name (lower-case) to the slug + theme-token name used by
# the card grid. Unknown groups fall back to GROUP_UNKNOWN.
GROUP_TOKENS: dict[str, dict[str, str]] = {
    "chest":      {"slug": "chest",      "color_token": "--muscle-chest"},
    "back":       {"slug": "back",       "color_token": "--muscle-back"},
    "legs":       {"slug": "legs",       "color_token": "--muscle-legs"},
    "arms":       {"slug": "arms",       "color_token": "--muscle-arms"},
    "shoulders":  {"slug": "shoulders",  "color_token": "--muscle-shoulders"},
    "abdominals": {"slug": "abdominals", "color_token": "--muscle-abs"},
    "abs":        {"slug": "abdominals", "color_token": "--muscle-abs"},
}
GROUP_UNKNOWN = {"slug": "other", "color_token": "--muscle-other"}


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


# ---------------------------------------------------------------------------
# Card-grid summary
# ---------------------------------------------------------------------------
# The card-grid landing page renders one card per ExerciseUser, branching on a
# computed status (today / overdue / on_track). Inactive exercises are also
# returned with is_active=False so the page can hide them behind a toggle.


def _last_scheduled_day_before(
    schedule: list[bool] | None, today: datetime.date,
) -> datetime.date | None:
    """Return the date of the most recent past scheduled day, or None.

    ``schedule`` is the seven-element Monday-first boolean array stored on
    :class:`ExerciseUser`. The search walks back up to seven days from
    yesterday and returns the first day whose schedule slot is ``True``.
    """
    if not schedule:
        return None
    for offset in range(1, 8):
        day = today - datetime.timedelta(days=offset)
        slot = day.weekday()
        if slot < len(schedule) and schedule[slot]:
            return day
    return None


def _pick_sparkline_metric(
    has_weight: bool, has_duration: bool, series_by_metric: dict[str, list[float]],
) -> tuple[str | None, list[float]]:
    """Choose which metric to graph for an exercise.

    Priority is ``weight > reps > duration``, but we only return a series the
    exercise actually records numerics for. A series of all-zero values is
    treated as unavailable so reps-only exercises don't render a flat line.
    """
    def has_signal(values: list[float]) -> bool:
        return any(v > 0 for v in values)

    if has_weight and has_signal(series_by_metric.get("weight", [])):
        return "weight", series_by_metric["weight"]
    if has_signal(series_by_metric.get("reps", [])):
        return "reps", series_by_metric["reps"]
    if has_duration and has_signal(series_by_metric.get("duration", [])):
        return "duration", series_by_metric["duration"]
    return None, []


def _recent_data_by_exercise(
    user: User, exercise_ids: list[int], limit: int = SPARKLINE_LIMIT,
) -> dict[int, list[Data]]:
    """Return up to ``limit`` recent :class:`Data` rows per exercise.

    Single query, sorted newest-first, sliced in Python. Cards never need
    more than ~20 points, so the row count stays small even for prolific
    users.
    """
    if not exercise_ids:
        return {}

    rows = (
        Data.objects
        .filter(workout__user=user, workout__exercise_id__in=exercise_ids)
        .select_related("workout")
        .order_by("workout__exercise_id", "-date")
    )

    bucketed: dict[int, list[Data]] = defaultdict(list)
    for d in rows:
        eid = d.workout.exercise_id
        if len(bucketed[eid]) < limit:
            bucketed[eid].append(d)
    return bucketed


def _resolve_group(exercise: Exercise) -> tuple[str, str, str]:
    """Return (slug, label, color_token) for an exercise's primary group.

    Falls back to GROUP_UNKNOWN when the exercise has no muscles attached.
    """
    muscles = list(exercise.muscle.all())
    if not muscles:
        return GROUP_UNKNOWN["slug"], "Other", GROUP_UNKNOWN["color_token"]
    label = str(muscles[0].muscle_group)
    info = GROUP_TOKENS.get(label.lower(), GROUP_UNKNOWN)
    return info["slug"], label, info["color_token"]


def _card_status(
    is_today: bool, overdue_days: int,
) -> str:
    """Map (is_today, overdue_days) to the card's status string."""
    if is_today:
        return "today"
    if overdue_days > 0:
        return "overdue"
    return "on_track"


def get_fitness_card_summary(user: User) -> dict[str, Any]:
    """Build the payload for the card-grid landing page.

    Returns a dict with:
        - ``today_dow``: int, Monday-first weekday index for today.
        - ``groups``: ordered list of ``{slug, label, color_token}`` for the
          filter chip row, derived from the user's active exercises.
        - ``exercises``: list of card dicts (active first, sorted today →
          overdue → on-track; inactive cards appended at the end).
    """
    active, inactive = get_fitness_summary(user)
    today = timezone.localdate()
    today_dow = today.weekday()

    all_exercise_ids = [e.id for e in active] + [e.id for e in inactive]
    recent_data = _recent_data_by_exercise(user, all_exercise_ids)

    def build_card(e: Exercise, *, is_active: bool) -> dict[str, Any]:
        slug, label, color_token = _resolve_group(e)
        schedule = list(getattr(e, "schedule", None) or [])
        # Normalize to a 7-element list of booleans (None → False) so the
        # frontend can index freely.
        schedule_bool = [bool(s) for s in (schedule + [False] * 7)[:7]]

        is_today = bool(is_active and schedule_bool[today_dow])

        last_active = getattr(e, "last_active", None)
        last_days = None
        if last_active is not None:
            last_days = (today - timezone.localtime(last_active).date()).days

        # Overdue: the most recent past scheduled day pre-dates last workout.
        overdue_days = 0
        if is_active and not is_today and last_active is not None:
            missed_day = _last_scheduled_day_before(schedule_bool, today)
            if missed_day is not None:
                last_date = timezone.localtime(last_active).date()
                if last_date < missed_day:
                    overdue_days = (today - missed_day).days

        # Recent data → sparkline series (oldest → newest for plotting).
        rows = list(reversed(recent_data.get(e.id, [])))
        series_by_metric = {
            "weight": [float(d.weight or 0) for d in rows],
            "reps": [float(d.reps or 0) for d in rows],
            "duration": [float(d.duration or 0) for d in rows],
        }
        metric, sparkline = _pick_sparkline_metric(
            e.has_weight, e.has_duration, series_by_metric,
        )

        # Last-workout meta — pull from the newest grouped row per exercise.
        last_set = recent_data.get(e.id, [None])[0] if recent_data.get(e.id) else None
        last_weight = float(last_set.weight) if last_set and last_set.weight else None
        last_reps = int(last_set.reps) if last_set and last_set.reps else None

        return {
            "uuid": str(e.uuid),
            "name": e.name,
            "exercise_url": reverse("fitness:exercise_detail", args=[e.uuid]),
            "is_active": is_active,
            "status": _card_status(is_today, overdue_days),
            "is_today": is_today,
            "overdue_days": overdue_days,
            "group": slug,
            "group_label": label,
            "group_color_token": color_token,
            "schedule": schedule_bool,
            "last_workout_days_ago": last_days,
            "last_weight": last_weight,
            "last_reps": last_reps,
            "sparkline": sparkline,
            "sparkline_metric": metric,
        }

    cards = [build_card(e, is_active=True) for e in active]
    cards += [build_card(e, is_active=False) for e in inactive]

    # Sort: today first, then overdue, then on-track; inactive cards stay at
    # the end. Stable secondary order keeps the underlying last-active sort.
    status_rank = {"today": 0, "overdue": 1, "on_track": 2}
    cards.sort(key=lambda c: (
        0 if c["is_active"] else 1,
        status_rank.get(c["status"], 99),
    ))

    # Build the filter-chip group list from active cards only — chips for
    # groups the user actually trains. Ordered by slug for stability.
    seen_groups: dict[str, dict[str, str]] = {}
    for c in cards:
        if not c["is_active"]:
            continue
        if c["group"] not in seen_groups:
            seen_groups[c["group"]] = {
                "slug": c["group"],
                "label": c["group_label"],
                "color_token": c["group_color_token"],
            }
    groups = sorted(seen_groups.values(), key=lambda g: g["slug"])

    return {
        "today_dow": today_dow,
        "groups": groups,
        "exercises": cards,
    }
