"""Models for the reminder system.

This module defines the Reminder model, which represents user-created reminders
that trigger on various schedules: daily at a specific time, weekly on specific
days, or monthly on specific dates.
"""

import calendar
import uuid
from datetime import datetime, time, timedelta
from typing import List, Optional

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone

from lib.mixins import TimeStampedModel


class Reminder(TimeStampedModel):
    """A user-owned reminder with flexible scheduling options.

    Reminders support three schedule types:
    - Daily: Trigger every day at a specific time
    - Weekly: Trigger on specific days of the week (e.g., every Monday)
    - Monthly: Trigger on specific days of the month (e.g., the 15th)

    Examples:
        - Daily at 9am: schedule_type="daily", trigger_time=09:00
        - Every Monday and Wednesday at 8am: schedule_type="weekly",
          days_of_week=[0, 2], trigger_time=08:00
        - 1st and 15th of each month at noon: schedule_type="monthly",
          days_of_month=[1, 15], trigger_time=12:00

    Attributes:
        uuid: Stable UUID identifier for this reminder.
        user: ForeignKey to the User who owns this reminder.
        name: The title/name of the reminder.
        note: Optional free-form text annotation or description.
        is_active: Whether the reminder is currently active and should trigger.
        create_todo: Whether to automatically create a Todo task when the reminder triggers.
        start_at: Optional datetime indicating when the schedule begins.
        schedule_type: The type of schedule (daily, weekly, monthly).
        trigger_time: Time of day when the reminder should trigger.
        days_of_week: List of weekday indices (0=Monday, 6=Sunday) for weekly reminders.
        days_of_month: List of day numbers (1-31) for monthly reminders.
        interval_value: (Deprecated) The numeric value for the interval.
        interval_unit: (Deprecated) The time unit for the interval.
        last_triggered_at: Timestamp of when the reminder last triggered.
        next_trigger_at: Calculated timestamp for when the reminder should next trigger.
    """

    # Deprecated interval unit constants (kept for backward compatibility)
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

    # Schedule type constants
    SCHEDULE_TYPE_DAILY = "daily"
    SCHEDULE_TYPE_WEEKLY = "weekly"
    SCHEDULE_TYPE_MONTHLY = "monthly"

    SCHEDULE_TYPE_CHOICES = [
        (SCHEDULE_TYPE_DAILY, "Daily"),
        (SCHEDULE_TYPE_WEEKLY, "Weekly"),
        (SCHEDULE_TYPE_MONTHLY, "Monthly"),
    ]

    # Day of week constants (Monday=0, Sunday=6, matching Python's weekday())
    MONDAY = 0
    TUESDAY = 1
    WEDNESDAY = 2
    THURSDAY = 3
    FRIDAY = 4
    SATURDAY = 5
    SUNDAY = 6

    DAY_OF_WEEK_CHOICES = [
        (MONDAY, "Monday"),
        (TUESDAY, "Tuesday"),
        (WEDNESDAY, "Wednesday"),
        (THURSDAY, "Thursday"),
        (FRIDAY, "Friday"),
        (SATURDAY, "Saturday"),
        (SUNDAY, "Sunday"),
    ]

    uuid: models.UUIDField = models.UUIDField(default=uuid.uuid4, editable=False)
    user = models.ForeignKey(User, on_delete=models.PROTECT)

    name = models.TextField()
    note = models.TextField(null=True, blank=True)

    is_active = models.BooleanField(default=True)
    create_todo = models.BooleanField(default=False)

    # When the schedule begins. If unset, the scheduler can treat created time as the start.
    start_at = models.DateTimeField(null=True, blank=True)

    # New schedule fields
    schedule_type = models.CharField(
        max_length=10,
        choices=SCHEDULE_TYPE_CHOICES,
        default=SCHEDULE_TYPE_DAILY,
    )
    trigger_time = models.TimeField(null=True, blank=True)
    days_of_week: models.JSONField = models.JSONField(default=list, blank=True)
    days_of_month: models.JSONField = models.JSONField(default=list, blank=True)

    # Deprecated fields (kept for backward compatibility)
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

    def get_days_of_week_display(self) -> List[str]:
        """Return human-readable names for the selected days of week.

        Returns:
            List of day names (e.g., ["Monday", "Wednesday"]).
        """
        day_map = dict(self.DAY_OF_WEEK_CHOICES)
        return [day_map[d] for d in self.days_of_week if d in day_map]

    def get_schedule_description(self) -> str:
        """Return a human-readable description of the schedule.

        Returns:
            A string describing when the reminder triggers.
        """
        time_str = self.trigger_time.strftime("%I:%M %p").lstrip("0") if self.trigger_time else "unset time"

        if self.schedule_type == self.SCHEDULE_TYPE_DAILY:
            return f"Daily at {time_str}"
        elif self.schedule_type == self.SCHEDULE_TYPE_WEEKLY:
            days = self.get_days_of_week_display()
            if not days:
                return f"Weekly (no days selected) at {time_str}"
            return f"Every {', '.join(days)} at {time_str}"
        elif self.schedule_type == self.SCHEDULE_TYPE_MONTHLY:
            if not self.days_of_month:
                return f"Monthly (no days selected) at {time_str}"
            day_strs = [self._ordinal(d) for d in sorted(self.days_of_month)]
            return f"Monthly on the {', '.join(day_strs)} at {time_str}"
        return "Unknown schedule"

    @staticmethod
    def _ordinal(n: int) -> str:
        """Convert an integer to its ordinal representation.

        Args:
            n: The integer to convert.

        Returns:
            The ordinal string (e.g., "1st", "2nd", "3rd", "4th").
        """
        if 11 <= (n % 100) <= 13:
            suffix = "th"
        else:
            suffix = {1: "st", 2: "nd", 3: "rd"}.get(n % 10, "th")
        return f"{n}{suffix}"

    def calculate_next_trigger_at(
        self, from_datetime: Optional[datetime] = None
    ) -> Optional[datetime]:
        """Calculate the next trigger datetime based on schedule settings.

        This method computes when the reminder should next trigger based on
        the schedule_type, trigger_time, and days_of_week/days_of_month settings.

        Args:
            from_datetime: The datetime to calculate from. If None, uses current time.

        Returns:
            The next trigger datetime, or None if schedule is invalid.
        """
        base_datetime: datetime = from_datetime if from_datetime is not None else timezone.now()
        trigger_time_val = self.trigger_time or time(9, 0)  # Default to 9am

        if self.schedule_type == self.SCHEDULE_TYPE_DAILY:
            return self._calculate_next_daily(base_datetime, trigger_time_val)
        elif self.schedule_type == self.SCHEDULE_TYPE_WEEKLY:
            return self._calculate_next_weekly(base_datetime, trigger_time_val)
        elif self.schedule_type == self.SCHEDULE_TYPE_MONTHLY:
            return self._calculate_next_monthly(base_datetime, trigger_time_val)

        # Fallback for unknown schedule type
        return None

    def _calculate_next_daily(
        self, from_datetime: datetime, trigger_time_val: time
    ) -> datetime:
        """Calculate next trigger for daily schedule.

        Args:
            from_datetime: The datetime to calculate from.
            trigger_time_val: Time of day to trigger.

        Returns:
            Next trigger datetime (today or tomorrow at trigger_time).
        """
        # Try today first
        today_trigger = timezone.make_aware(
            datetime.combine(from_datetime.date(), trigger_time_val),
            timezone.get_current_timezone()
        )

        # If today's trigger time hasn't passed yet, use it
        if today_trigger > from_datetime:
            return today_trigger

        # Otherwise, use tomorrow
        next_date = from_datetime.date() + timedelta(days=1)
        return timezone.make_aware(
            datetime.combine(next_date, trigger_time_val),
            timezone.get_current_timezone()
        )

    def _calculate_next_weekly(
        self, from_datetime: datetime, trigger_time_val: time
    ) -> datetime:
        """Calculate next trigger for weekly schedule.

        Args:
            from_datetime: The datetime to calculate from.
            trigger_time_val: Time of day to trigger.

        Returns:
            Next trigger datetime on a matching day of week.
        """
        days_of_week = self.days_of_week or []

        if not days_of_week:
            # No days selected, default to same day next week
            next_date = from_datetime.date() + timedelta(days=7)
            return timezone.make_aware(
                datetime.combine(next_date, trigger_time_val),
                timezone.get_current_timezone()
            )

        sorted_days = sorted(days_of_week)
        current_weekday = from_datetime.weekday()

        # Check if today is a matching day and the time hasn't passed
        if current_weekday in sorted_days:
            today_trigger = timezone.make_aware(
                datetime.combine(from_datetime.date(), trigger_time_val),
                timezone.get_current_timezone()
            )
            if today_trigger > from_datetime:
                return today_trigger

        # Find the next matching day
        for day in sorted_days:
            if day > current_weekday:
                # Found a day later this week
                days_ahead = day - current_weekday
                next_date = from_datetime.date() + timedelta(days=days_ahead)
                return timezone.make_aware(
                    datetime.combine(next_date, trigger_time_val),
                    timezone.get_current_timezone()
                )

        # No matching day found this week, use first day next week
        first_day = sorted_days[0]
        days_ahead = 7 - current_weekday + first_day
        next_date = from_datetime.date() + timedelta(days=days_ahead)
        return timezone.make_aware(
            datetime.combine(next_date, trigger_time_val),
            timezone.get_current_timezone()
        )

    def _calculate_next_monthly(
        self, from_datetime: datetime, trigger_time_val: time
    ) -> datetime:
        """Calculate next trigger for monthly schedule.

        Handles edge cases like day 31 in months with fewer days by
        using the last day of the month.

        Args:
            from_datetime: The datetime to calculate from.
            trigger_time_val: Time of day to trigger.

        Returns:
            Next trigger datetime on a matching day of month.
        """
        days_of_month = self.days_of_month or []

        if not days_of_month:
            # No days selected, default to same day next month
            return self._add_months(from_datetime, 1, trigger_time_val)

        sorted_days = sorted(days_of_month)
        current_day = from_datetime.day
        current_year = from_datetime.year
        current_month = from_datetime.month

        _, days_in_current_month = calendar.monthrange(current_year, current_month)

        # Check if today is a matching day and the time hasn't passed
        for day in sorted_days:
            actual_day = min(day, days_in_current_month)
            if actual_day == current_day:
                today_trigger = timezone.make_aware(
                    datetime.combine(from_datetime.date(), trigger_time_val),
                    timezone.get_current_timezone()
                )
                if today_trigger > from_datetime:
                    return today_trigger

        # Check if there's a matching day later this month
        for day in sorted_days:
            actual_day = min(day, days_in_current_month)
            if actual_day > current_day:
                next_date = from_datetime.date().replace(day=actual_day)
                return timezone.make_aware(
                    datetime.combine(next_date, trigger_time_val),
                    timezone.get_current_timezone()
                )

        # No matching day found this month, use first day next month
        next_month = current_month + 1
        next_year = current_year
        if next_month > 12:
            next_month = 1
            next_year += 1

        _, days_in_next_month = calendar.monthrange(next_year, next_month)
        first_day = min(sorted_days[0], days_in_next_month)

        next_date = from_datetime.date().replace(
            year=next_year, month=next_month, day=first_day
        )
        return timezone.make_aware(
            datetime.combine(next_date, trigger_time_val),
            timezone.get_current_timezone()
        )

    def _add_months(
        self, dt: datetime, months: int, trigger_time_val: time
    ) -> datetime:
        """Add months to a datetime, handling year rollover.

        Args:
            dt: Starting datetime.
            months: Number of months to add.
            trigger_time_val: Time of day for the result.

        Returns:
            Datetime with months added.
        """
        month = dt.month + months
        year = dt.year
        while month > 12:
            month -= 12
            year += 1

        # Handle day overflow (e.g., Jan 31 + 1 month)
        _, days_in_month = calendar.monthrange(year, month)
        day = min(dt.day, days_in_month)

        next_date = dt.date().replace(year=year, month=month, day=day)
        return timezone.make_aware(
            datetime.combine(next_date, trigger_time_val),
            timezone.get_current_timezone()
        )
