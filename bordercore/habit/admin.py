"""Django admin configuration for the Habit app.

This module registers the Habit and HabitLog models with Django's admin
interface, providing inline log editing on the habit detail page and
filterable list views.
"""

from django.contrib import admin

from habit.models import Habit, HabitLog


class HabitLogInline(admin.TabularInline):
    """Inline admin for HabitLog entries on the Habit detail page."""

    model = HabitLog
    extra = 1


@admin.register(Habit)
class HabitAdmin(admin.ModelAdmin):
    """Admin configuration for the Habit model."""

    list_display = ("name", "user", "start_date", "end_date", "created")
    list_filter = ("user", "start_date")
    search_fields = ("name",)
    inlines = [HabitLogInline]


@admin.register(HabitLog)
class HabitLogAdmin(admin.ModelAdmin):
    """Admin configuration for the HabitLog model."""

    list_display = ("habit", "date", "completed", "value")
    list_filter = ("completed", "date", "habit")
    search_fields = ("habit__name",)
