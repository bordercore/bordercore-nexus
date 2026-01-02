"""Django forms for the reminder application."""

from django.forms import CheckboxInput, ModelForm, Select, Textarea, TextInput

from .models import Reminder


class ReminderForm(ModelForm):
    """Form for creating and updating reminders."""

    class Meta:
        """Meta configuration for ReminderForm."""

        model = Reminder
        fields = (
            "name",
            "note",
            "is_active",
            "create_todo",
            "start_at",
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
            "interval_value": "Repeat Every",
            "interval_unit": "Unit",
        }
