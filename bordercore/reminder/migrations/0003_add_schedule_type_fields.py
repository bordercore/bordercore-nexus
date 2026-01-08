"""Migration to add schedule type fields to Reminder model.

This migration adds support for three schedule types:
- Daily: Trigger every day at a specific time
- Weekly: Trigger on specific days of the week
- Monthly: Trigger on specific days of the month
"""

from django.db import migrations, models


def migrate_existing_reminders(apps, schema_editor):
    """Migrate existing reminders to use the new schedule_type field.

    Existing reminders with interval_unit="day" become daily reminders.
    Other interval types are also mapped to daily for simplicity.
    The trigger_time is extracted from start_at if available.
    """
    Reminder = apps.get_model("reminder", "Reminder")

    for reminder in Reminder.objects.all():
        # Default to daily schedule
        reminder.schedule_type = "daily"

        # Extract time from start_at if available
        if reminder.start_at:
            reminder.trigger_time = reminder.start_at.time()

        reminder.save()


def reverse_migration(apps, schema_editor):
    """Reverse the migration - no action needed as fields will be removed."""
    pass


class Migration(migrations.Migration):
    """Add schedule_type, trigger_time, days_of_week, days_of_month fields."""

    dependencies = [
        ("reminder", "0002_add_create_todo_field"),
    ]

    operations = [
        migrations.AddField(
            model_name="reminder",
            name="schedule_type",
            field=models.CharField(
                choices=[
                    ("daily", "Daily"),
                    ("weekly", "Weekly"),
                    ("monthly", "Monthly"),
                ],
                default="daily",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="reminder",
            name="trigger_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="reminder",
            name="days_of_week",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="reminder",
            name="days_of_month",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(migrate_existing_reminders, reverse_migration),
    ]
