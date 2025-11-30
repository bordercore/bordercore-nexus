"""Models for fitness exercises, workouts, and user workout scheduling.

This module defines relational models to represent muscle groups, muscles,
exercises, workout records (with per-set data), and per-user exercise
scheduling preferences. It also includes convenience methods for reporting
and visualization data (e.g., recent performance and plotting payloads).
"""

from __future__ import annotations

import calendar
import uuid
from collections import defaultdict
from datetime import timedelta
from typing import Any, DefaultDict, Dict, List

from django.contrib.auth.models import User
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields.array import ArrayField
from django.core.paginator import Page, Paginator
from django.db import models
from django.db.models import F, Max, QuerySet
from django.utils import timezone

from lib.time_utils import get_relative_date_from_date


class MuscleGroup(models.Model):
    """A high-level grouping of muscles (e.g., Chest, Back)."""

    name: models.TextField = models.TextField(unique=True)

    def __str__(self) -> str:
        """Return string representation of the muscle group."""
        return self.name


class Muscle(models.Model):
    """An individual muscle (e.g., Pectoralis Major) belonging to a group."""

    name = models.TextField(unique=True)
    muscle_group = models.ForeignKey(MuscleGroup, on_delete=models.PROTECT)

    def __str__(self) -> str:
        """Return string representation of the muscle."""
        return self.name

    class Meta:
        ordering = ["name"]


class Exercise(models.Model):
    """An exercise definition with metadata and targeted muscles."""

    uuid = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField(unique=True)
    muscle: models.ManyToManyField = models.ManyToManyField(
        Muscle, through="ExerciseMuscle", related_name="exercises"
    )
    description = models.TextField(blank=True)
    note = models.TextField(blank=True)
    has_duration = models.BooleanField(default=True)
    has_weight = models.BooleanField(default=True)

    def __str__(self) -> str:
        """Return string representation of the exercise."""
        return self.name

    class Meta:
        ordering = ["name"]

    def get_targeted_muscles(self) -> DefaultDict[str, List[Muscle]]:
        """Return muscles targeted by this exercise, grouped by role.

        Returns:
            DefaultDict[str, List[Muscle]]: A mapping from target role
            (e.g., "primary", "secondary") to a list of muscles.
        """
        muscles = defaultdict(list)

        for x in ExerciseMuscle.objects.filter(exercise=self).select_related("muscle"):
            muscles[x.target].append(x.muscle)

        return muscles

    def last_workout(self, user: User) -> Dict[str, Any]:
        """Return summary stats for the user's most recent workout of this exercise.

        Args:
            user: The Django user to query for.

        Returns:
            Dict[str, Any]: A dictionary with keys:
                - "recent_data": list[Data] for that workout (order is the model’s default)
                - "latest_reps": list[int] (reps for each set, 0 when null)
                - "latest_weight": list[float] (weight for each set, 0.0 when null)
                - "latest_duration": list[int] (duration for each set, 0 when null)
                - "delta_days": int days since the most recent set in that workout
            If no workout exists, lists are empty and no delta is provided.
        """
        workout = (
            Workout.objects.filter(user=user, exercise=self).order_by("-date").first()
        )

        if not workout:
            return {
                "latest_duration": [],
                "latest_reps": [],
                "latest_weight": [],
            }

        recent_data = list(workout.data_set.all())  # realize for indexing below

        info = {
            "recent_data": recent_data,
            "latest_reps": [x.reps or 0 for x in recent_data],
            "latest_weight": [x.weight or 0 for x in recent_data],
            "latest_duration": [x.duration or 0 for x in recent_data],
            "delta_days": (timezone.now() - recent_data[0].date).days + 1,
        }
        return info

    def get_plot_info(self, count: int = 12, page_number: int = 1) -> Dict[str, Any]:
        """Build plotting payloads (labels, series, notes, pagination) for this exercise.

        Args:
            count: Number of workout entries per page.
            page_number: 1-based page to fetch.

        Returns:
            Dict[str, Any]: A dictionary with:
                - "labels": list[str] of date labels (newest first)
                - "plot_data": dict[str, list[list[int|float|None]]] keyed by "reps", "weight", "duration"
                - "notes": list[str|None] of workout notes
                - "initial_plot_type": str of preferred plot series ("reps", "weight", or "duration")
                - "paginator": dict with reversed paging semantics (we page newest → older):
        """
        raw_data = (
            Workout.objects.filter(exercise__id=self.id)
            .annotate(reps=ArrayAgg("data__reps", order_by="-date"))
            .annotate(weight=ArrayAgg("data__weight", order_by="-date"))
            .annotate(duration=ArrayAgg("data__duration", order_by="-date"))
            .order_by("-date")
        )

        page = Paginator(raw_data, count).page(page_number)
        page_data = list(reversed(page.object_list))

        initial_plot_type = "reps"
        plot_data = {}
        plot_data["reps"] = [x.reps for x in page_data]  # type: ignore[attr-defined]

        if any(getattr(x, "weight", None) and x.weight[0] > 0 for x in page_data):  # type: ignore[attr-defined]
            plot_data["weight"] = [x.weight for x in page_data]  # type: ignore[attr-defined]
            initial_plot_type = "weight"
        elif any(getattr(x, "duration", None) and x.duration[0] > 0 for x in page_data):  # type: ignore[attr-defined]
            plot_data["duration"] = [x.duration for x in page_data]  # type: ignore[attr-defined]
            initial_plot_type = "duration"

        labels = [x.date.strftime("%b %d") for x in page_data]
        notes= [x.note for x in page_data]

        # Note: has_previous and has_next are reversed because we want to show the last
        #  set of workout data first in the pagination.
        return {
            "labels": labels[::-1],
            "plot_data": plot_data,
            "notes": notes[::-1],
            "initial_plot_type": initial_plot_type,
            "paginator": {
                "page_number": page_number,
                "has_previous": page.has_next(),
                "has_next": page.has_previous(),
                "previous_page_number": page.next_page_number() if page.has_next() else None,
                "next_page_number": page.previous_page_number() if page.has_previous() else None,
            }
        }

    def get_related_exercises(self) -> QuerySet[Exercise]:
        """Return other exercises that target any of the same muscles.

        Ordering prioritizes the most recently active exercises (across all users).

        Returns:
            QuerySet[Exercise]: Related exercises, excluding this one.
        """
        return (
            Exercise.objects.annotate(last_active=Max("workout__data__date"))
            .filter(muscle__in=self.muscle.all())
            .exclude(pk=self.pk)
            .distinct()
            .order_by(F("last_active").desc(nulls_last=True))
        )


class ExerciseMuscle(models.Model):
    """Through-model linking an Exercise to a Muscle with a targeting role."""

    exercise = models.ForeignKey(Exercise, on_delete=models.CASCADE)
    muscle = models.ForeignKey(Muscle, on_delete=models.CASCADE)
    note = models.TextField(blank=True, null=True)

    TARGETS = [
        ("primary", "primary"),
        ("secondary", "secondary"),
    ]

    target = models.CharField(
        max_length=20,
        choices=TARGETS,
        default="primary",
    )

    def __str__(self) -> str:
        """Return string representation of the exercise muscle."""
        return f"ExerciseMuscle: {self.exercise}, {self.muscle}"

    class Meta:
        unique_together = (("exercise", "muscle"))


class Workout(models.Model):
    """A user's workout session for a specific exercise."""

    user = models.ForeignKey(User, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    date = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, null=True)


class Data(models.Model):
    """Per-set data recorded within a Workout."""

    workout = models.ForeignKey(Workout, on_delete=models.PROTECT)
    date = models.DateTimeField(auto_now_add=True)
    weight = models.FloatField(blank=True, null=True)
    reps = models.PositiveIntegerField()
    duration = models.PositiveIntegerField(blank=True, null=True)

    class Meta:
        verbose_name_plural = "Data"


class ExerciseUser(models.Model):
    """Per-user exercise enrollment and scheduling preferences."""

    user = models.ForeignKey(User, on_delete=models.PROTECT)
    exercise = models.ForeignKey(Exercise, on_delete=models.PROTECT)
    started = models.DateTimeField(auto_now_add=True)
    frequency = models.DurationField(
        default=timedelta(days=7), blank=False, null=False
    )
    rest_period = models.FloatField(blank=True, null=True)
    schedule = ArrayField(models.BooleanField(blank=True, null=True), size=7)

    class Meta:
        unique_together = ("user", "exercise")

    def __str__(self) -> str:
        """Return string representation of the exercise user."""
        return f"Exercise '{self.exercise.name}' for user {self.user.username}"

    def activity_info(self) -> Dict[str, Any]:
        """Return a small info bundle describing the user's cadence and start date.

        Returns:
            Dict[str, Any]: Includes:
                - "frequency": int day count of the frequency duration
                - "schedule": the raw schedule array
                - "relative_date": natural-language elapsed time since start
                - "started": formatted start date (e.g., 'Jan 02, 2023')
        """
        return {
            "frequency": self.frequency.days,
            "schedule": self.schedule,
            "relative_date": get_relative_date_from_date(self.started),
            "started": self.started.strftime("%b %d, %Y"),
        }

    @staticmethod
    def schedule_days(schedule: List[bool | None] | None) -> str:
        """Convert a 7-length boolean schedule to weekday abbreviations.

        The schedule is expected to be a list of seven truthy/falsey values,
        Monday-first. Truthy entries are mapped to weekday abbreviations.

        Args:
            schedule: A list of seven items where each item indicates whether
                the corresponding weekday is active. `None` is treated as false.

        Returns:
            str: Comma-separated weekday abbreviations (e.g., "Mon, Wed, Fri"),
            or an empty string if the schedule is not provided or has no active days.
        """
        if not schedule:
            return ""

        days = [calendar.day_abbr[i] for i, on in enumerate(schedule[:7]) if on]
        return ", ".join(days)
