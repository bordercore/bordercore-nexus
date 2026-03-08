from django.contrib import admin

from .models import Reminder


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
    """Admin configuration for the Reminder model."""

    list_display = ("id", "name", "user", "is_active", "schedule_type", "trigger_time", "next_trigger_at")
    list_filter = ("is_active", "schedule_type")
    search_fields = ("name", "note")
