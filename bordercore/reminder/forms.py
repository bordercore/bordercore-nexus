"""Django forms for the reminder application."""

import json
from typing import Any

from django import forms
from django.core.exceptions import ValidationError
from django.forms import CheckboxInput, ModelForm, Select, Textarea, TextInput

from .models import Reminder


class ReminderForm(ModelForm):
    """Form for creating and updating reminders.

    Supports three schedule types:
    - Daily: Trigger every day at a specific time
    - Weekly: Trigger on specific days of the week
    - Monthly: Trigger on specific days of the month
    """

    # Custom field for days_of_week as comma-separated string from frontend
    days_of_week_input = forms.CharField(required=False, widget=forms.HiddenInput())
    # Custom field for days_of_month as comma-separated string from frontend
    days_of_month_input = forms.CharField(required=False, widget=forms.HiddenInput())

    class Meta:
        """Meta configuration for ReminderForm."""

        model = Reminder
        fields = (
            "name",
            "note",
            "is_active",
            "create_todo",
            "start_at",
            "schedule_type",
            "trigger_time",
            "days_of_week",
            "days_of_month",
            # Legacy fields (kept for backward compatibility)
            "interval_value",
            "interval_unit",
        )
        widgets = {
            "name": TextInput(
                attrs={"class": "form-control", "placeholder": "e.g., Water plants"}
            ),
            "note": Textarea(
                attrs={
                    "class": "form-control",
                    "rows": 3,
                    "placeholder": "Optional notes about this reminder",
                }
            ),
            "is_active": CheckboxInput(attrs={"class": "form-check-input"}),
            "create_todo": CheckboxInput(attrs={"class": "form-check-input"}),
            "start_at": TextInput(attrs={"class": "form-control", "type": "datetime-local"}),
            "schedule_type": Select(attrs={"class": "form-control form-select"}),
            "trigger_time": TextInput(attrs={"class": "form-control", "type": "time"}),
            "days_of_week": forms.HiddenInput(),
            "days_of_month": forms.HiddenInput(),
            # Legacy widgets
            "interval_value": TextInput(
                attrs={"class": "form-control", "type": "number", "min": "1"}
            ),
            "interval_unit": Select(attrs={"class": "form-control form-select"}),
        }
        labels = {
            "name": "Reminder Name",
            "note": "Notes",
            "is_active": "Active",
            "create_todo": "Create Todo Task",
            "start_at": "Start Date (optional)",
            "schedule_type": "Schedule Type",
            "trigger_time": "Time",
            "days_of_week": "Days of Week",
            "days_of_month": "Days of Month",
            "interval_value": "Repeat Every",
            "interval_unit": "Unit",
        }

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        """Initialize the form with custom handling for JSON fields."""
        super().__init__(*args, **kwargs)

        # Make legacy fields not required
        self.fields["interval_value"].required = False
        self.fields["interval_unit"].required = False

        # Make JSON fields not required (they're handled via custom inputs)
        self.fields["days_of_week"].required = False
        self.fields["days_of_month"].required = False

    def clean_days_of_week_input(self) -> list[int]:
        """Parse and validate days_of_week_input field.

        Returns:
            List of valid weekday indices (0-6).
        """
        value = self.cleaned_data.get("days_of_week_input", "")
        if not value:
            return []

        try:
            # Handle both JSON array and comma-separated formats
            if value.startswith("["):
                days = json.loads(value)
            else:
                days = [int(d.strip()) for d in value.split(",") if d.strip()]

            # Validate each day is in valid range
            valid_days = []
            for day in days:
                if isinstance(day, int) and 0 <= day <= 6:
                    valid_days.append(day)
                else:
                    raise ValidationError(f"Invalid day of week: {day}")

            return sorted(set(valid_days))
        except (json.JSONDecodeError, ValueError) as e:
            raise ValidationError(f"Invalid days of week format: {e}")

    def clean_days_of_month_input(self) -> list[int]:
        """Parse and validate days_of_month_input field.

        Returns:
            List of valid day numbers (1-31).
        """
        value = self.cleaned_data.get("days_of_month_input", "")
        if not value:
            return []

        try:
            # Handle both JSON array and comma-separated formats
            if value.startswith("["):
                days = json.loads(value)
            else:
                days = [int(d.strip()) for d in value.split(",") if d.strip()]

            # Validate each day is in valid range
            valid_days = []
            for day in days:
                if isinstance(day, int) and 1 <= day <= 31:
                    valid_days.append(day)
                else:
                    raise ValidationError(f"Invalid day of month: {day}")

            return sorted(set(valid_days))
        except (json.JSONDecodeError, ValueError) as e:
            raise ValidationError(f"Invalid days of month format: {e}"                )

    def clean(self) -> dict[str, Any]:
        """Validate the form based on schedule_type.

        Ensures required fields are present for each schedule type:
        - Daily: trigger_time recommended
        - Weekly: days_of_week required, trigger_time recommended
        - Monthly: days_of_month required, trigger_time recommended
        """
        cleaned_data: dict[str, Any] | None = super().clean()
        if cleaned_data is None:
            return {}

        schedule_type = cleaned_data.get("schedule_type")

        # Copy parsed days from custom input fields to model fields
        if "days_of_week_input" in cleaned_data:
            cleaned_data["days_of_week"] = cleaned_data.get("days_of_week_input", [])
        if "days_of_month_input" in cleaned_data:
            cleaned_data["days_of_month"] = cleaned_data.get("days_of_month_input", [])

        # Validate based on schedule type
        if schedule_type == Reminder.SCHEDULE_TYPE_WEEKLY:
            days_of_week = cleaned_data.get("days_of_week", [])
            if not days_of_week:
                self.add_error(
                    "days_of_week_input",
                    "Please select at least one day of the week."
                )

        elif schedule_type == Reminder.SCHEDULE_TYPE_MONTHLY:
            days_of_month = cleaned_data.get("days_of_month", [])
            if not days_of_month:
                self.add_error(
                    "days_of_month_input",
                    "Please select at least one day of the month."
                )

        return cleaned_data
