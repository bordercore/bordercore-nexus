"""Django admin configuration for the Todo app."""

from django import forms
from django.contrib import admin
from django.db import models

from todo.models import Todo


class _EmptyNullJSONFormField(forms.JSONField):
    """Render a None JSONField value as an empty textarea, not the literal 'null'."""

    def prepare_value(self, value: object) -> str:
        if value is None:
            return ""
        return super().prepare_value(value)


@admin.register(Todo)
class TodoAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "priority", "due_date", "created")
    list_filter = ("priority", "user")
    search_fields = ("name", "note")
    filter_horizontal = ("tags",)
    readonly_fields = ("uuid", "created", "modified")
    formfield_overrides = {
        models.JSONField: {"form_class": _EmptyNullJSONFormField},
    }
