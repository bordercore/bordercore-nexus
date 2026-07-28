"""Django admin configuration for the Habit app.

This module registers the Habit, HabitLog, and HabitNote models with Django's
admin interface, providing inline log and note editing on the habit detail
page and filterable list views.
"""

from django.contrib import admin

from habit.models import Habit, HabitLog, HabitNote


class HabitLogInline(admin.TabularInline):
    """Inline admin for HabitLog entries on the Habit detail page."""

    model = HabitLog
    extra = 1


class HabitNoteInline(admin.TabularInline):
    """Inline admin for HabitNote entries on the Habit detail page."""

    model = HabitNote
    extra = 1


@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    """Admin configuration for the Habit model."""

    list_display = ("name", "user", "start_date", "end_date", "created")
    list_filter = ("user", "start_date")
    search_fields = ("name",)
    inlines = [HabitLogInline, HabitNoteInline]


@admin.register(HabitLog)
class HabitLogAdmin(admin.ModelAdmin):
    """Admin configuration for the HabitLog model."""

    list_display = ("habit", "date", "completed", "value")
    list_filter = ("completed", "date", "habit")
    search_fields = ("habit__name",)


@admin.register(HabitNote)
class HabitNoteAdmin(admin.ModelAdmin):
    """Admin configuration for the HabitNote model."""

    list_display = ("habit", "date", "note", "created")
    list_filter = ("date", "habit")
    search_fields = ("habit__name", "note")
