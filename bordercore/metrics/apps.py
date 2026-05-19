"""Django app configuration for the metrics app.

This module defines the MetricsConfig class, which configures the metrics
application for Django's app registry system.
"""

from django.apps import AppConfig


class MetricsConfig(AppConfig):
    name = "metrics"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        # Side-effect import: registers signal handlers.
        from metrics import signals  # noqa: F401
