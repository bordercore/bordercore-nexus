"""
Models for the Habit app.

This module defines:
- `Habit`: A user-defined habit to track over time, with a name, purpose,
  start/end dates, and tags.
- `HabitLog`: A daily log entry for a habit, recording whether the habit was
  completed along with an optional numeric value and note.
- A signal handler (`tags_changed`) to keep `TagHabit` relations in sync when
  a habit's tags change.
"""

from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from django.contrib.auth.models import User
from django.db import models
from django.db.models.signals import m2m_changed

from lib.mixins import TimeStampedModel
from tag.models import Tag, TagHabit

from .managers import HabitManager


class Habit(TimeStampedModel):
    """A habit is a recurring behaviour that a user wants to track over time.

    Each habit has a name, optional purpose description, a start date, and an
    optional end date. Habits can be tagged for organization and filtered by
    active status.

    Attributes:
        uuid: Unique identifier for the habit.
        name: The name of the habit.
        purpose: Optional description of why the user is tracking this habit.
        start_date: The date the habit tracking began.
        end_date: Optional date the habit tracking ended.
        user: The user who owns this habit.
        tags: Tags associated with this habit.
    """

    uuid: models.UUIDField = models.UUIDField(default=uuid.uuid4, editable=False)
    name = models.TextField()
    purpose = models.TextField(blank=True)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    tags = models.ManyToManyField(Tag, blank=True)

    objects = HabitManager()

    class Meta:
        ordering = ("-modified", "-created")
        indexes = [
            models.Index(fields=["user", "-end_date"]),
        ]

    def __str__(self) -> str:
        return self.name

    @property
    def is_active(self) -> bool:
        """Whether this habit is currently active.

        A habit is active if it has no end_date or its end_date is today or later.

        Returns:
            True if the habit is active, False otherwise.
        """
        if self.end_date is None:
            return True
        return self.end_date >= date.today()


class HabitLog(TimeStampedModel):
    """A daily log entry for a habit.

    Records whether a habit was completed on a given date, with optional
    numeric value tracking and notes.

    Attributes:
        uuid: Unique identifier for the log entry.
        habit: The habit this log belongs to.
        date: The date of the log entry.
        completed: Whether the habit was completed.
        value: Optional numeric value (e.g., minutes, count).
        note: Optional text note about the log entry.
    """

    uuid: models.UUIDField = models.UUIDField(default=uuid.uuid4, editable=False)
    habit = models.ForeignKey(Habit, on_delete=models.CASCADE)
    date = models.DateField()
    completed = models.BooleanField(default=False)
    value = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    note = models.TextField(blank=True)

    def __str__(self) -> str:
        status = "done" if self.completed else "missed"
        return f"{self.habit.name} - {self.date} ({status})"

    class Meta:
        indexes = [
            models.Index(fields=["habit", "-date"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["habit", "date"], name="unique_habit_date"),
        ]
        ordering = ("-date", "-created")


def tags_changed(sender: type[Habit], **kwargs: Any) -> None:
    """Handle m2m 'tags' changes by adding/removing TagHabit relations.

    Triggered on post_add and post_remove of Habit.tags.

    Args:
        sender: The model class sending the signal.
        **kwargs: Contains 'action', 'instance', and 'pk_set'.
    """
    if kwargs["action"] == "post_add":
        habit = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            tag = Tag.objects.get(pk=tag_id)
            TagHabit.objects.get_or_create(tag=tag, habit=habit)

    elif kwargs["action"] == "post_remove":
        habit = kwargs["instance"]

        for tag_id in kwargs["pk_set"]:
            TagHabit.objects.filter(tag_id=tag_id, habit=habit).delete()


m2m_changed.connect(tags_changed, sender=Habit.tags.through)
