"""Models for the reminder system.

This module defines the Reminder model, which represents user-created reminders
that trigger on a fixed interval schedule. Reminders can be set to repeat hourly,
daily, weekly, or monthly.
"""

import uuid

from django.contrib.auth.models import User
from django.db import models

from lib.mixins import TimeStampedModel


class Reminder(TimeStampedModel):
    """A user-owned reminder that repeats on a fixed interval.

    Reminders track recurring tasks or notifications that need to be triggered
    at regular intervals. The interval is represented as (interval_value, interval_unit),
    allowing flexible scheduling from hours to months.

    Examples:
        - every hour: interval_value=1, interval_unit="hour"
        - every 2 days: interval_value=2, interval_unit="day"
        - every week: interval_value=1, interval_unit="week"
        - every month: interval_value=1, interval_unit="month"

    Attributes:
        uuid: Stable UUID identifier for this reminder.
        user: ForeignKey to the User who owns this reminder.
        name: The title/name of the reminder.
        note: Optional free-form text annotation or description.
        is_active: Whether the reminder is currently active and should trigger.
        create_todo: Whether to automatically create a Todo task when the reminder triggers.
        start_at: Optional datetime indicating when the schedule begins.
            If unset, the scheduler can use the created timestamp.
        interval_value: The numeric value for the interval (e.g., 1, 2, 7).
        interval_unit: The time unit for the interval (hour, day, week, month).
        last_triggered_at: Timestamp of when the reminder last triggered.
        next_trigger_at: Calculated timestamp for when the reminder should next trigger.
    """

    INTERVAL_UNIT_HOUR = "hour"
    INTERVAL_UNIT_DAY = "day"
    INTERVAL_UNIT_WEEK = "week"
    INTERVAL_UNIT_MONTH = "month"

    INTERVAL_UNIT_CHOICES = [
        (INTERVAL_UNIT_HOUR, "Hour"),
        (INTERVAL_UNIT_DAY, "Day"),
        (INTERVAL_UNIT_WEEK, "Week"),
        (INTERVAL_UNIT_MONTH, "Month"),
    ]

    uuid: models.UUIDField = models.UUIDField(default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    name = models.TextField()
    note = models.TextField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    create_todo = models.BooleanField(default=False)

    # When the schedule begins. If unset, the scheduler can treat created time as the start.
    start_at = models.DateTimeField(null=True, blank=True)

    interval_value = models.PositiveSmallIntegerField(default=1)
    interval_unit = models.CharField(
        max_length=10,
        choices=INTERVAL_UNIT_CHOICES,
        default=INTERVAL_UNIT_DAY,
    )

    last_triggered_at = models.DateTimeField(null=True, blank=True)
    next_trigger_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:
        """Return string representation of the reminder.

        Returns:
            The name of the reminder.
        """
        return self.name
