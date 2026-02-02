"""Unit tests for reminder forms."""

import pytest

from reminder.forms import ReminderForm
from reminder.models import Reminder

pytestmark = pytest.mark.django_db


def _base_form_data():
    """Minimal valid form data for reminder (daily)."""
    return {
        "name": "Test Reminder",
        "schedule_type": Reminder.SCHEDULE_TYPE_DAILY,
        "trigger_time": "09:00",
    }


def test_clean_days_of_week_input_empty():
    """clean_days_of_week_input: empty string returns [] and copies to days_of_week."""
    data = _base_form_data()
    data["days_of_week_input"] = ""
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_week") == []


def test_clean_days_of_week_input_json_array():
    """clean_days_of_week_input: valid JSON array parses to sorted unique list."""
    data = _base_form_data()
    data["days_of_week_input"] = "[0, 2, 2]"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_week") == [0, 2]


def test_clean_days_of_week_input_comma_separated():
    """clean_days_of_week_input: comma-separated string parses to sorted unique list."""
    data = _base_form_data()
    data["days_of_week_input"] = "2, 0, 2"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_week") == [0, 2]


def test_clean_days_of_week_input_invalid_day_raises():
    """clean_days_of_week_input: invalid day (e.g. 7) raises ValidationError."""
    data = _base_form_data()
    data["days_of_week_input"] = "[0, 7]"
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_week_input" in form.errors


def test_clean_days_of_week_input_malformed_json_raises():
    """clean_days_of_week_input: malformed JSON raises ValidationError."""
    data = _base_form_data()
    data["days_of_week_input"] = "[0, 2"
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_week_input" in form.errors


def test_clean_days_of_week_input_non_numeric_raises():
    """clean_days_of_week_input: non-numeric value raises ValidationError."""
    data = _base_form_data()
    data["days_of_week_input"] = "[0, x]"
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_week_input" in form.errors


def test_clean_days_of_month_input_empty():
    """clean_days_of_month_input: empty string returns [] and copies to days_of_month."""
    data = _base_form_data()
    data["days_of_month_input"] = ""
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_month") == []


def test_clean_days_of_month_input_json_array():
    """clean_days_of_month_input: valid JSON array parses to sorted unique list."""
    data = _base_form_data()
    data["days_of_month_input"] = "[1, 15, 15]"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_month") == [1, 15]


def test_clean_days_of_month_input_comma_separated():
    """clean_days_of_month_input: comma-separated string parses to sorted unique list."""
    data = _base_form_data()
    data["days_of_month_input"] = "15, 1, 15"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_month") == [1, 15]


def test_clean_days_of_month_input_invalid_day_zero_raises():
    """clean_days_of_month_input: day 0 raises ValidationError."""
    data = _base_form_data()
    data["days_of_month_input"] = "[0, 15]"
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_month_input" in form.errors


def test_clean_days_of_month_input_invalid_day_32_raises():
    """clean_days_of_month_input: day 32 raises ValidationError."""
    data = _base_form_data()
    data["days_of_month_input"] = "[15, 32]"
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_month_input" in form.errors


def test_clean_weekly_requires_days_of_week():
    """clean(): schedule_type weekly with no days adds error on days_of_week_input."""
    data = _base_form_data()
    data["schedule_type"] = Reminder.SCHEDULE_TYPE_WEEKLY
    data["days_of_week_input"] = ""
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_week_input" in form.errors
    assert "at least one day" in form.errors["days_of_week_input"][0].lower()


def test_clean_weekly_with_days_valid():
    """clean(): schedule_type weekly with days_of_week is valid."""
    data = _base_form_data()
    data["schedule_type"] = Reminder.SCHEDULE_TYPE_WEEKLY
    data["days_of_week_input"] = "[0, 2]"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_week") == [0, 2]


def test_clean_monthly_requires_days_of_month():
    """clean(): schedule_type monthly with no days adds error on days_of_month_input."""
    data = _base_form_data()
    data["schedule_type"] = Reminder.SCHEDULE_TYPE_MONTHLY
    data["days_of_month_input"] = ""
    form = ReminderForm(data=data)
    assert not form.is_valid()
    assert "days_of_month_input" in form.errors
    assert "at least one day" in form.errors["days_of_month_input"][0].lower()


def test_clean_monthly_with_days_valid():
    """clean(): schedule_type monthly with days_of_month is valid."""
    data = _base_form_data()
    data["schedule_type"] = Reminder.SCHEDULE_TYPE_MONTHLY
    data["days_of_month_input"] = "[1, 15]"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data.get("days_of_month") == [1, 15]


def test_clean_copies_days_to_model_fields():
    """clean(): copies days_of_week_input to days_of_week, days_of_month_input to days_of_month."""
    data = _base_form_data()
    data["schedule_type"] = Reminder.SCHEDULE_TYPE_DAILY
    data["days_of_week_input"] = "[1, 3]"
    data["days_of_month_input"] = "[5, 20]"
    form = ReminderForm(data=data)
    assert form.is_valid()
    assert form.cleaned_data["days_of_week"] == [1, 3]
    assert form.cleaned_data["days_of_month"] == [5, 20]
