from django.contrib import admin

from .models import Reminder


@admin.register(Reminder)
class ReminderAdmin(admin.ModelAdmin):
	list_display = ("id", "name", "user", "is_active", "interval_value", "interval_unit", "next_trigger_at")
	list_filter = ("is_active", "interval_unit")
	search_fields = ("name", "note")
