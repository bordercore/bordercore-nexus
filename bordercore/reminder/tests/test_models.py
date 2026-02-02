"""Unit tests for reminder models."""

from datetime import datetime, time, timedelta

import pytest
from django.utils import timezone

from reminder.models import Reminder
from reminder.tests.factories import ReminderFactory

pytestmark = pytest.mark.django_db


def test_reminder_str():
    """__str__ returns the reminder name."""
    reminder = ReminderFactory(name="Water plants")
    assert str(reminder) == "Water plants"


def test_get_days_of_week_display():
    """get_days_of_week_display returns human-readable day names."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        days_of_week=[0, 2],
    )
    assert reminder.get_days_of_week_display() == ["Monday", "Wednesday"]


def test_get_days_of_week_display_empty():
    """get_days_of_week_display returns empty list when no days set."""
    reminder = ReminderFactory(days_of_week=[])
    assert reminder.get_days_of_week_display() == []


def test_get_schedule_description_daily():
    """get_schedule_description for daily returns 'Daily at ...'."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_DAILY,
        trigger_time=time(9, 0),
    )
    assert "Daily at" in reminder.get_schedule_description()
    assert "9:00 AM" in reminder.get_schedule_description()


def test_get_schedule_description_weekly_with_days():
    """get_schedule_description for weekly with days lists the days."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(8, 0),
        days_of_week=[0, 2],
    )
    desc = reminder.get_schedule_description()
    assert "Every Monday, Wednesday at" in desc
    assert "8:00 AM" in desc


def test_get_schedule_description_weekly_no_days():
    """get_schedule_description for weekly with no days selected."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(8, 0),
        days_of_week=[],
    )
    assert "Weekly (no days selected)" in reminder.get_schedule_description()


def test_get_schedule_description_monthly_with_days():
    """get_schedule_description for monthly with days uses ordinals."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(12, 0),
        days_of_month=[1, 15],
    )
    desc = reminder.get_schedule_description()
    assert "Monthly on the 1st, 15th at" in desc


def test_get_schedule_description_monthly_no_days():
    """get_schedule_description for monthly with no days selected."""
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(12, 0),
        days_of_month=[],
    )
    assert "Monthly (no days selected)" in reminder.get_schedule_description()


def test_ordinal_1st_2nd_3rd():
    """_ordinal returns correct suffix for 1, 2, 3."""
    assert Reminder._ordinal(1) == "1st"
    assert Reminder._ordinal(2) == "2nd"
    assert Reminder._ordinal(3) == "3rd"


def test_ordinal_4th():
    """_ordinal returns 'th' for 4."""
    assert Reminder._ordinal(4) == "4th"


def test_ordinal_11th_12th_13th():
    """_ordinal returns 'th' for 11, 12, 13 (special case)."""
    assert Reminder._ordinal(11) == "11th"
    assert Reminder._ordinal(12) == "12th"
    assert Reminder._ordinal(13) == "13th"


def test_ordinal_21st_22nd_23rd():
    """_ordinal returns correct suffix for 21, 22, 23."""
    assert Reminder._ordinal(21) == "21st"
    assert Reminder._ordinal(22) == "22nd"
    assert Reminder._ordinal(23) == "23rd"


def test_calculate_next_trigger_at_daily_today():
    """Daily: if trigger time has not passed today, next trigger is today."""
    tz = timezone.get_current_timezone()
    # Monday 8:00
    from_dt = timezone.make_aware(
        datetime(2025, 2, 3, 8, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_DAILY,
        trigger_time=time(9, 0),
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.date() == from_dt.date()
    assert result.hour == 9
    assert result.minute == 0


def test_calculate_next_trigger_at_daily_tomorrow():
    """Daily: if trigger time has passed, next trigger is tomorrow."""
    tz = timezone.get_current_timezone()
    from_dt = timezone.make_aware(
        datetime(2025, 2, 3, 10, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_DAILY,
        trigger_time=time(9, 0),
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.date() == from_dt.date() + timedelta(days=1)
    assert result.hour == 9
    assert result.minute == 0


def test_calculate_next_trigger_at_daily_default_trigger_time():
    """Daily with trigger_time None defaults to 9:00."""
    tz = timezone.get_current_timezone()
    from_dt = timezone.make_aware(
        datetime(2025, 2, 3, 7, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_DAILY,
        trigger_time=None,
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.hour == 9
    assert result.minute == 0


def test_calculate_next_trigger_at_weekly_empty_days():
    """Weekly with no days: next trigger is same weekday next week."""
    tz = timezone.get_current_timezone()
    # Monday 8:00
    from_dt = timezone.make_aware(
        datetime(2025, 2, 3, 8, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(9, 0),
        days_of_week=[],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.date() == from_dt.date() + timedelta(days=7)
    assert result.weekday() == 0
    assert result.hour == 9


def test_calculate_next_trigger_at_weekly_next_day_this_week():
    """Weekly with days: next trigger can be later same week."""
    tz = timezone.get_current_timezone()
    # Tuesday 8:00, days = [0, 2] (Mon, Wed)
    from_dt = timezone.make_aware(
        datetime(2025, 2, 4, 8, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(9, 0),
        days_of_week=[0, 2],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    # Next matching day is Wednesday (weekday 2)
    assert result.weekday() == 2
    assert result.date() == datetime(2025, 2, 5).date()
    assert result.hour == 9


def test_calculate_next_trigger_at_weekly_same_day_time_future():
    """Weekly: if today is a matching day and time hasn't passed, today."""
    tz = timezone.get_current_timezone()
    # Wednesday 8:00, days = [0, 2]
    from_dt = timezone.make_aware(
        datetime(2025, 2, 5, 8, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(9, 0),
        days_of_week=[0, 2],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.date() == from_dt.date()
    assert result.weekday() == 2
    assert result.hour == 9


def test_calculate_next_trigger_at_weekly_next_week():
    """Weekly: if no matching day this week, first day next week."""
    tz = timezone.get_current_timezone()
    # Thursday 10:00, days = [0, 2] (Mon, Wed)
    from_dt = timezone.make_aware(
        datetime(2025, 2, 6, 10, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_WEEKLY,
        trigger_time=time(9, 0),
        days_of_week=[0, 2],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    # Next Monday
    assert result.weekday() == 0
    assert result.date() == datetime(2025, 2, 10).date()
    assert result.hour == 9


def test_calculate_next_trigger_at_monthly_empty_days():
    """Monthly with no days: next trigger is same day next month."""
    tz = timezone.get_current_timezone()
    from_dt = timezone.make_aware(
        datetime(2025, 2, 15, 9, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(10, 0),
        days_of_month=[],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.month == 3
    assert result.day == 15
    assert result.hour == 10


def test_calculate_next_trigger_at_monthly_later_this_month():
    """Monthly with days: next trigger can be later this month."""
    tz = timezone.get_current_timezone()
    # Feb 10 8:00, days = [1, 15]
    from_dt = timezone.make_aware(
        datetime(2025, 2, 10, 8, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(9, 0),
        days_of_month=[1, 15],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.month == 2
    assert result.day == 15
    assert result.hour == 9


def test_calculate_next_trigger_at_monthly_next_month():
    """Monthly with days: if no matching day this month, first day next month."""
    tz = timezone.get_current_timezone()
    # Feb 20 10:00, days = [1, 15]
    from_dt = timezone.make_aware(
        datetime(2025, 2, 20, 10, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(9, 0),
        days_of_month=[1, 15],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    assert result.month == 3
    assert result.day == 1
    assert result.hour == 9


def test_calculate_next_trigger_at_monthly_day_31_february():
    """Monthly: day 31 in February uses last day of month."""
    tz = timezone.get_current_timezone()
    # Jan 31 10:00 (after trigger 9:00), days = [31] -> next is Feb (28th)
    from_dt = timezone.make_aware(
        datetime(2025, 1, 31, 10, 0, 0),
        tz,
    )
    reminder = ReminderFactory(
        schedule_type=Reminder.SCHEDULE_TYPE_MONTHLY,
        trigger_time=time(9, 0),
        days_of_month=[31],
    )
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is not None
    # Feb has 28 days in 2025
    assert result.month == 2
    assert result.day == 28
    assert result.hour == 9


def test_calculate_next_trigger_at_unknown_schedule_type_returns_none():
    """Unknown schedule_type returns None."""
    reminder = ReminderFactory(schedule_type=Reminder.SCHEDULE_TYPE_DAILY)
    reminder.schedule_type = "invalid"
    tz = timezone.get_current_timezone()
    from_dt = timezone.make_aware(datetime(2025, 2, 3, 8, 0, 0), tz)
    result = reminder.calculate_next_trigger_at(from_datetime=from_dt)
    assert result is None
